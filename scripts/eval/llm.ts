// 평가 하네스의 LLM 호출 계층 (Deno 2.x, #74)
//
// provider는 셋이다. 하네스는 인터페이스(LLMProvider)만 알고, 단계 코드는 provider를 직접 부르지 않는다
// (harness.ts의 ctx.call을 거쳐 토큰 집계·상한 검사·기록이 한 곳에서 이뤄진다).
//   claude : Anthropic Messages API (fetch 직접 호출, llm-fallback.ts와 같은 방식). ANTHROPIC_API_KEY 필요
//   ollama : 로컬 Ollama (http://localhost:11434). 단가 0
//   echo   : 호출 없이 마지막 user 메시지를 그대로 돌려준다. 키 없이 흐름·상한·compare를 확인하는 용도

const ROOT = new URL("../..", import.meta.url).pathname;

export interface LLMRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  // 구조화 출력이 필요하면 JSON Schema를 준다 (Claude: output_config.format, Ollama: format)
  jsonSchema?: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  usage: { input: number; output: number };
  latencyMs: number;
  model: string;
  // end_turn · max_tokens · refusal · stop 등 provider가 알려준 종료 사유
  stopReason: string;
  // 결과를 믿기 전에 사람이 볼 것 (예: Ollama 컨텍스트가 가득 차서 입력이 잘렸을 수 있음). 기록에 그대로 남는다
  warning?: string;
}

export interface Price {
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface LLMProvider {
  name: "claude" | "ollama" | "echo";
  model: string;
  price: Price;
  // 요청 밖에서 응답을 바꾸는 provider 설정 (예: Ollama num_ctx). 호출 캐시 키에 들어간다
  cacheTag?: string;
  // 지금 provider의 자원 사용 상태 (Ollama: 로드된 크기·GPU 비율). run 중간과 끝에 summary.json에 남는다
  snapshot?(): Promise<Record<string, unknown>>;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

export type LLMErrorKind =
  | "auth"
  | "rate_limit"
  | "http"
  | "timeout"
  | "network"
  | "invalid_output";

export class LLMError extends Error {
  constructor(
    readonly kind: LLMErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

// --- 토큰 · 비용 ---------------------------------------------------------------

// 한글은 글자 하나가 토큰 하나에 가깝다. dev 20건 실측에서 Claude(Haiku 5.5)는 호출마다 "글자 수 + 32" 이하,
// Qwen 2.5 7B는 글자 수 이하였다. 글자 ÷ 2로 잡았더니 Claude 실제 입력의 절반이라 상한 검사가 뚫릴 수 있었다.
// 영어 등은 토큰이 훨씬 적으므로 이 추정은 위쪽으로 틀린다 (상한 검사에는 그쪽이 안전하다)
const CHARS_PER_TOKEN = 1;
// 요청마다 붙는 형식 토큰 여유
const REQUEST_OVERHEAD_TOKENS = 40;

/** 요청의 입력 토큰 추정치. 호출 전 상한 검사와 dry-run이 쓴다 */
export function estimateTokens(req: LLMRequest): number {
  const chars =
    req.system.length +
    req.messages.reduce((n, m) => n + m.content.length, 0) +
    (req.jsonSchema ? JSON.stringify(req.jsonSchema).length : 0);
  return Math.ceil(chars / CHARS_PER_TOKEN) + REQUEST_OVERHEAD_TOKENS;
}

export function costUsd(
  price: Price,
  usage: { input: number; output: number },
): number {
  return (
    (usage.input * price.inputPerMTok + usage.output * price.outputPerMTok) /
    1_000_000
  );
}

// USD / 100만 토큰. 모델을 추가하면 공식 가격표를 확인하고 날짜를 남긴다
const CLAUDE_PRICES: Record<string, Price> = {
  // 프롬프트 10만 토큰 이하 단가. 2026-10-21 공식 가격표 확인 (llm-fallback.ts와 같은 값)
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
};

export const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";

// --- .env ----------------------------------------------------------------------

/** 셸 환경변수 → .env 순서로 키를 찾는다. 없으면 undefined */
export async function loadApiKey(): Promise<string | undefined> {
  const fromShell = Deno.env.get("ANTHROPIC_API_KEY");
  if (fromShell) return fromShell;
  let raw = "";
  try {
    raw = await Deno.readTextFile(`${ROOT}.env`);
  } catch {
    return undefined;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "") || undefined;
  }
  return undefined;
}

// --- Claude --------------------------------------------------------------------

const CLAUDE_TIMEOUT_MS = 60_000;
const RETRY_DEFAULT_WAIT_MS = 2_000;
const RETRY_MAX_WAIT_MS = 30_000;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

export function createClaudeProvider(opts: {
  apiKey: string;
  model?: string;
}): LLMProvider {
  const model = opts.model ?? DEFAULT_CLAUDE_MODEL;
  const price = CLAUDE_PRICES[model];
  if (!price) {
    throw new Error(
      `단가를 모르는 모델이에요: ${model}. scripts/eval/llm.ts의 CLAUDE_PRICES에 공식 단가를 추가하세요.`,
    );
  }

  const post = async (req: LLMRequest): Promise<Response> => {
    try {
      return await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
        },
        // temperature·top_p·top_k는 보내지 않는다 (Haiku 5.5는 400)
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: req.messages,
          ...(req.jsonSchema
            ? {
                output_config: {
                  format: { type: "json_schema", schema: req.jsonSchema },
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : String(err);
      throw new LLMError(
        name === "TimeoutError" || name === "AbortError"
          ? "timeout"
          : "network",
        message.slice(0, 160),
      );
    }
  };

  return {
    name: "claude",
    model,
    price,
    async complete(req) {
      const start = performance.now();
      let res = await post(req);
      // 429 · 529 · 5xx는 한 번만 기다렸다 다시 시도한다. 지연에는 대기 시간도 포함된다
      if (res.status === 429 || res.status === 529 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, RETRY_MAX_WAIT_MS)
            : RETRY_DEFAULT_WAIT_MS;
        await res.body?.cancel();
        await new Promise((r) => setTimeout(r, wait));
        res = await post(req);
      }

      let body: AnthropicResponse;
      try {
        body = (await res.json()) as AnthropicResponse;
      } catch {
        throw new LLMError("http", `http_${res.status}`, res.status);
      }
      if (!res.ok) {
        const detail = `http_${res.status}${body.error?.type ? ` ${body.error.type}` : ""}${body.error?.message ? `: ${body.error.message.slice(0, 160)}` : ""}`;
        const kind: LLMErrorKind =
          res.status === 401 || res.status === 403
            ? "auth"
            : res.status === 429 || res.status === 529
              ? "rate_limit"
              : "http";
        throw new LLMError(kind, detail, res.status);
      }

      // thinking 블록이 앞에 올 수 있으므로 위치가 아니라 type으로 찾는다
      const text = body.content?.find((b) => b.type === "text")?.text;
      if (text === undefined) {
        throw new LLMError(
          "invalid_output",
          `text 블록 없음 (stop_reason=${body.stop_reason ?? "?"})`,
        );
      }
      return {
        text,
        usage: {
          input: body.usage?.input_tokens ?? 0,
          output: body.usage?.output_tokens ?? 0,
        },
        latencyMs: Math.round(performance.now() - start),
        model,
        stopReason: body.stop_reason ?? "unknown",
      };
    },
  };
}

// --- Ollama --------------------------------------------------------------------

const OLLAMA_URL = "http://localhost:11434";
// 로컬 7~8B는 느리다. 긴 회고 한 편도 넉넉히 기다린다
const OLLAMA_TIMEOUT_MS = 300_000;
// Ollama 기본 컨텍스트는 VRAM 24GB 미만에서 4k라서, 명시하지 않으면 긴 회고(최대 약 12,000자)의 앞부분이
// 경고 없이 잘리고 근거 실패가 모델 탓으로 잡힌다. 본문 12,074자 + system·스키마 약 1,500 + 출력 2,048 < 16,384.
// 컨텍스트를 키우면 KV 캐시 메모리도 늘므로 메모리 측정은 이 값 기준이다
export const OLLAMA_NUM_CTX = 16_384;

interface OllamaResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  done_reason?: string;
  error?: string;
}

interface OllamaPsModel {
  name?: string;
  model?: string;
  size?: number;
  size_vram?: number;
  context_length?: number;
  expires_at?: string;
}

// Ollama가 모델을 올려 둔 러너 프로세스(llama-server)의 상주 메모리 합계(MB). 못 읽으면 null
async function runnerRssMB(): Promise<number | null> {
  try {
    const out = await new Deno.Command("ps", {
      args: ["-axo", "rss=,command="],
    }).output();
    let kb = 0;
    for (const line of new TextDecoder().decode(out.stdout).split("\n")) {
      const m = line.match(/^\s*(\d+)\s+(.*)$/);
      if (m && /llama-server|ollama runner/.test(m[2])) kb += Number(m[1]);
    }
    return kb ? Math.round(kb / 1024) : null;
  } catch {
    return null;
  }
}

export function createOllamaProvider(opts: {
  model: string;
  baseUrl?: string;
  numCtx?: number;
}): LLMProvider {
  const baseUrl = opts.baseUrl ?? OLLAMA_URL;
  const numCtx = opts.numCtx ?? OLLAMA_NUM_CTX;

  // thinking을 지원하는 모델(예: Gemma 4)은 끄지 않으면 추론 토큰이 출력 상한을 먹는다.
  // 지원하지 않는 모델에 think를 보내면 400이 나는 버전이 있어, /api/show의 capabilities를 한 번 보고 정한다
  let supportsThinking: Promise<boolean> | undefined;
  const checkThinking = () =>
    (supportsThinking ??= (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/show`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: opts.model }),
          signal: AbortSignal.timeout(30_000),
        });
        const body = (await res.json()) as { capabilities?: string[] };
        return body.capabilities?.includes("thinking") ?? false;
      } catch {
        return false;
      }
    })());

  return {
    name: "ollama",
    model: opts.model,
    price: { inputPerMTok: 0, outputPerMTok: 0 },
    cacheTag: `num_ctx=${numCtx}`,
    async snapshot() {
      try {
        const res = await fetch(`${baseUrl}/api/ps`, {
          signal: AbortSignal.timeout(10_000),
        });
        const body = (await res.json()) as { models?: OllamaPsModel[] };
        const m = body.models?.find(
          (x) => x.model === opts.model || x.name === opts.model,
        );
        if (!m) return { loaded: false };
        const size = m.size ?? 0;
        const vram = m.size_vram ?? 0;
        return {
          loaded: true,
          // /api/ps의 크기는 모델에 따라 일부만 센다 (Gemma 4 E4B는 6.6GB 모델이 353MB로 나온다).
          // 모델 간 비교는 러너 프로세스의 RSS(runnerRssMB)로 한다
          runnerRssMB: await runnerRssMB(),
          sizeMB: Math.round(size / 1e6),
          sizeVramMB: Math.round(vram / 1e6),
          // 100이 아니면 일부 레이어가 CPU로 내려가 느려진다
          gpuPercent: size ? Math.round((vram / size) * 100) : null,
          contextLength: m.context_length ?? null,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message.slice(0, 120) : "?" };
      }
    },
    async complete(req) {
      const start = performance.now();
      const think = (await checkThinking()) ? { think: false } : {};
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: opts.model,
            stream: false,
            messages: [
              { role: "system", content: req.system },
              ...req.messages,
            ],
            ...(req.jsonSchema ? { format: req.jsonSchema } : {}),
            ...think,
            // 재현성을 위해 temperature 0
            options: {
              num_predict: req.maxTokens,
              num_ctx: numCtx,
              temperature: 0,
            },
          }),
          signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        const message = err instanceof Error ? err.message : String(err);
        if (name === "TimeoutError" || name === "AbortError") {
          throw new LLMError("timeout", message.slice(0, 160));
        }
        throw new LLMError(
          "network",
          `Ollama에 연결할 수 없어요 (${baseUrl}). ollama serve가 떠 있는지 확인하세요. ${message.slice(0, 120)}`,
        );
      }

      let body: OllamaResponse;
      try {
        body = (await res.json()) as OllamaResponse;
      } catch {
        throw new LLMError("http", `http_${res.status}`, res.status);
      }
      if (!res.ok) {
        throw new LLMError(
          "http",
          `http_${res.status}${body.error ? `: ${body.error.slice(0, 160)}` : ""}`,
          res.status,
        );
      }
      const text = body.message?.content;
      if (text === undefined) {
        throw new LLMError("invalid_output", "message.content 없음");
      }
      const input = body.prompt_eval_count ?? 0;
      const output = body.eval_count ?? 0;
      return {
        text,
        usage: { input, output },
        latencyMs: Math.round(performance.now() - start),
        model: opts.model,
        stopReason: body.done_reason ?? "unknown",
        // 입력 + 출력이 컨텍스트를 거의 다 채웠으면 입력이 잘렸거나 출력이 밀렸을 수 있다
        ...(input + output >= numCtx - 16
          ? { warning: `context_full (${input}+${output} / ${numCtx})` }
          : {}),
      };
    },
  };
}

// --- echo ----------------------------------------------------------------------

/** 마지막 user 메시지를 그대로 돌려준다. usage는 추정치, 지연은 0 */
export function createEchoProvider(): LLMProvider {
  return {
    name: "echo",
    model: "echo",
    price: { inputPerMTok: 0, outputPerMTok: 0 },
    complete(req) {
      const last = [...req.messages].reverse().find((m) => m.role === "user");
      const text = last?.content ?? "";
      return Promise.resolve({
        text,
        usage: {
          input: estimateTokens(req),
          output: Math.ceil(text.length / CHARS_PER_TOKEN),
        },
        latencyMs: 0,
        model: "echo",
        stopReason: "stop",
      });
    },
  };
}
