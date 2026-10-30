// 평가 하네스의 LLM 호출 계층 (Deno 2.x, #74)
//
// provider는 셋이다. 하네스는 인터페이스(LLMProvider)만 알고, 단계 코드는 provider를 직접 부르지 않는다
// (harness.ts의 ctx.call을 거쳐 토큰 집계·상한 검사·기록이 한 곳에서 이뤄진다).
//   claude : Anthropic Messages API (fetch 직접 호출, llm-fallback.ts와 같은 방식). ANTHROPIC_API_KEY 필요
//   ollama : 로컬 Ollama (http://localhost:11434). 단가 0
//   echo   : 호출 없이 마지막 user 메시지를 그대로 돌려준다. 키 없이 흐름·상한·compare를 확인하는 용도

const ROOT = new URL("../..", import.meta.url).pathname;

import {
  CLAUDE_PRICES,
  costUsd,
  createClaudeProvider,
  DEFAULT_CLAUDE_MODEL,
  LLMError,
  type LLMErrorKind,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
  type Price,
} from "../../supabase/functions/_shared/reminder/claude.ts";

// 호출 계층의 Claude 부분은 Edge Function과 공유하는 _shared/reminder/claude.ts에 있다 (#79)
export {
  costUsd,
  createClaudeProvider,
  DEFAULT_CLAUDE_MODEL,
  LLMError,
  type LLMErrorKind,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
  type Price,
};

// --- 토큰 · 비용 ---------------------------------------------------------------

// 한글은 글자 하나가 토큰 하나에 가깝다. dev 20건 실측에서 Claude(Haiku 5.5)는 호출마다 "글자 수 + 32" 이하,
// Qwen 2.5 7B는 글자 수 이하였다. 글자 ÷ 2로 잡았더니 Claude 실제 입력의 절반이라 상한 검사가 뚫릴 수 있었다.
// 영어 등은 토큰이 훨씬 적으므로 이 추정은 위쪽으로 틀린다 (상한 검사에는 그쪽이 안전하다)
const CHARS_PER_TOKEN = 1;
// 요청마다 붙는 형식 토큰 여유
const REQUEST_OVERHEAD_TOKENS = 40;
// 한글 음절은 Claude에서 글자당 1토큰보다 조금 더 든다. #75 추출(긴 회고) 12건 실측에서 추정/실제 비율이
// 한글 17% 본문 1.28배 → 71% 본문 0.998배로, 한글이 많을수록 추정이 실제보다 작아졌다(7토큰 부족 1건).
// 한글 글자마다 이만큼 더 얹어 순수 한글 본문에서도 위쪽으로 틀리게 한다
const HANGUL_EXTRA_TOKENS = 0.25;

/** 요청의 입력 토큰 추정치. 호출 전 상한 검사와 dry-run이 쓴다 */
export function estimateTokens(req: LLMRequest): number {
  const texts = [
    req.system,
    ...req.messages.map((m) => m.content),
    req.jsonSchema ? JSON.stringify(req.jsonSchema) : "",
  ];
  const chars = texts.reduce((n, t) => n + t.length, 0);
  const hangul = texts.reduce(
    (n, t) => n + (t.match(/[\uac00-\ud7a3]/g)?.length ?? 0),
    0,
  );
  return (
    Math.ceil(chars / CHARS_PER_TOKEN + hangul * HANGUL_EXTRA_TOKENS) +
    REQUEST_OVERHEAD_TOKENS
  );
}

export const DEFAULT_JUDGE_MODEL = "claude-sonnet-5-5";

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

// --- Claude CLI (구독) -----------------------------------------------------------

// `claude -p`(Claude Code 헤드리스)로 호출한다. 구독 사용량으로 돌아 호출당 청구가 없어서 LLM 채점처럼
// 호출이 많은 개발용 평가에 쓴다 (#76). 운영 경로가 아니다.
//   - env에서 API 키를 지운다: 셸에 키가 있으면 구독이 아니라 API로 과금되기 때문
//   - --safe-mode: 전역 CLAUDE.md·메모리 같은 맥락이 채점 프롬프트에 섞이지 않게 한다 (G0 실측: 입력 1,381 → 262tok)
//   - 빈 임시 폴더에서 실행해 프로젝트 맥락도 막는다
//   - 모델은 전체 ID로 준다: 별칭 "sonnet"은 claude-sonnet-5로 풀린다
//   - 토큰은 modelUsage[모델]에서 읽는다: 같은 응답에 내부용 Haiku 호출이 따로 잡힌다
const CLI_TIMEOUT_MS = 120_000;
const CLI_EFFORT = "low";
// 호출마다 얹히는 기본 입력. CLI 버전에 따라 다르다: 2.1.209는 약 270tok, 2.1.311은 --safe-mode에서도 환경 정보
// (작업 디렉터리·플랫폼·날짜·모델)를 얹어 약 1,350tok (채점 31건 추정 94k vs 실제 128k, 140건 415k vs 565k에서 역산).
// CLAUDE.md·메모리·스킬은 두 버전 모두 막힌다. 버전이 바뀌면 다시 재서 고친다
const CLI_INPUT_OVERHEAD_TOKENS = 1350;

interface CliModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

interface CliResult {
  is_error?: boolean;
  subtype?: string;
  result?: string;
  structured_output?: unknown;
  stop_reason?: string | null;
  api_error_status?: number | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  modelUsage?: Record<string, CliModelUsage>;
}

export async function createClaudeCliProvider(opts: {
  model?: string;
}): Promise<LLMProvider> {
  const model = opts.model ?? DEFAULT_JUDGE_MODEL;
  const price = CLAUDE_PRICES[model];
  if (!price) {
    throw new Error(
      `단가를 모르는 모델이에요: ${model}. scripts/eval/llm.ts의 CLAUDE_PRICES에 단가를 추가하세요.`,
    );
  }

  const cwd = await Deno.makeTempDir({ prefix: "eval-judge-" });
  const baseEnv = Deno.env.toObject();
  delete baseEnv.ANTHROPIC_API_KEY;
  delete baseEnv.ANTHROPIC_AUTH_TOKEN;

  let version = "unknown";
  try {
    const out = await new Deno.Command("claude", {
      args: ["--version"],
      cwd,
      env: baseEnv,
      clearEnv: true,
    }).output();
    version = new TextDecoder().decode(out.stdout).trim() || "unknown";
  } catch {
    throw new Error(
      "claude CLI를 실행할 수 없어요. Claude Code가 설치돼 있고 구독으로 로그인돼 있는지 확인하세요.",
    );
  }

  const once = async (req: LLMRequest, prompt: string): Promise<CliResult> => {
    const args = [
      "-p",
      "--safe-mode",
      "--model",
      model,
      "--system-prompt",
      req.system,
      "--tools",
      "",
      "--no-session-persistence",
      "--effort",
      CLI_EFFORT,
      "--output-format",
      "json",
      ...(req.jsonSchema
        ? ["--json-schema", JSON.stringify(req.jsonSchema)]
        : []),
    ];
    let out: Deno.CommandOutput;
    try {
      const child = new Deno.Command("claude", {
        args,
        cwd,
        // 출력 상한은 플래그가 없어 환경변수로 준다
        env: {
          ...baseEnv,
          CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(req.maxTokens),
        },
        clearEnv: true,
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
        signal: AbortSignal.timeout(CLI_TIMEOUT_MS),
      }).spawn();
      const writer = child.stdin.getWriter();
      await writer.write(new TextEncoder().encode(prompt));
      await writer.close();
      out = await child.output();
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
    const stdout = new TextDecoder().decode(out.stdout);
    let body: CliResult;
    try {
      body = JSON.parse(stdout) as CliResult;
    } catch {
      const stderr = new TextDecoder().decode(out.stderr).trim();
      throw new LLMError(
        "http",
        `claude -p 종료 코드 ${out.code}: ${(stderr || stdout).slice(0, 160)}`,
      );
    }
    if (body.is_error) {
      const detail = `${body.subtype ?? "error"}${body.api_error_status ? ` http_${body.api_error_status}` : ""}: ${(body.result ?? "").slice(0, 160)}`;
      const auth =
        body.api_error_status === 401 ||
        body.api_error_status === 403 ||
        /log ?in|authenticat/i.test(body.result ?? "");
      throw new LLMError(
        auth ? "auth" : "http",
        detail,
        body.api_error_status ?? undefined,
      );
    }
    return body;
  };

  return {
    name: "claude-cli",
    model,
    price,
    billing: "subscription",
    info: { cliVersion: version, effort: CLI_EFFORT, safeMode: true },
    // --safe-mode에서도 CLI가 호출마다 기본 프롬프트를 얹는다 (위 상수 참고)
    inputOverheadTokens: CLI_INPUT_OVERHEAD_TOKENS,
    cacheTag: `cli:safe-mode,effort=${CLI_EFFORT}`,
    async complete(req) {
      if (req.messages.length !== 1 || req.messages[0].role !== "user") {
        throw new LLMError(
          "invalid_output",
          "claude-cli는 user 메시지 하나만 받아요",
        );
      }
      const prompt = req.messages[0].content;
      const start = performance.now();
      let body: CliResult;
      try {
        body = await once(req, prompt);
      } catch (err) {
        // 인증 실패는 다시 해도 같다. 나머지는 한 번만 다시 시도한다
        if (err instanceof LLMError && err.kind === "auth") throw err;
        body = await once(req, prompt);
      }

      const mu = body.modelUsage?.[model];
      const input = mu
        ? (mu.inputTokens ?? 0) +
          (mu.cacheReadInputTokens ?? 0) +
          (mu.cacheCreationInputTokens ?? 0)
        : (body.usage?.input_tokens ?? 0) +
          (body.usage?.cache_read_input_tokens ?? 0) +
          (body.usage?.cache_creation_input_tokens ?? 0);
      const output = mu?.outputTokens ?? body.usage?.output_tokens ?? 0;

      // --json-schema 결과는 structured_output에 객체로 온다 (stop_reason은 내부 도구 호출이라 tool_use)
      const structured = body.structured_output !== undefined;
      return {
        text: structured
          ? JSON.stringify(body.structured_output)
          : (body.result ?? ""),
        usage: { input, output },
        latencyMs: Math.round(performance.now() - start),
        model,
        stopReason: structured ? "end_turn" : (body.stop_reason ?? "unknown"),
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
        return {
          error: err instanceof Error ? err.message.slice(0, 120) : "?",
        };
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
