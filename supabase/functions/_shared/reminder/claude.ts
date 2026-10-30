// Claude Messages API 호출 계층 (#79: scripts/eval/llm.ts에서 옮김)
//
// 하네스(Deno 스크립트)와 Edge Function이 함께 쓴다. Deno.env·파일 접근 없이 fetch만 쓰는 순수 모듈이다
// (API 키는 호출하는 쪽이 넘긴다). 요청 본문을 바꾸면 하네스의 호출 캐시 키가 바뀌므로 고치지 않는다.

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
  name: "claude" | "claude-cli" | "ollama" | "echo";
  model: string;
  // USD / 100만 토큰. subscription provider는 청구되지 않으므로 "API로 부르면 얼마인가"의 환산 단가다
  price: Price;
  // 기본 api. subscription이면 비용은 API 환산으로만 보고하고 --max-tokens 상한에서 뺀다
  billing?: "api" | "subscription";
  // 결과 해석에 필요한 provider 정보 (예: claude CLI 버전). config.json에 남는다
  info?: Record<string, unknown>;
  // 요청 밖에서 provider가 호출마다 얹는 입력 토큰 (예: claude CLI의 기본 시스템 프롬프트). dry-run 추정에 더한다
  inputOverheadTokens?: number;
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
export const CLAUDE_PRICES: Record<string, Price> = {
  // 프롬프트 10만 토큰 이하 단가. 2026-10-21 공식 가격표 확인 (llm-fallback.ts와 같은 값)
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
  // 아래 둘은 claude-api 스킬의 모델 표(2026-10-06 기준)에서 옮겼고 공식 가격표는 다시 보지 않았다.
  // 채점은 구독 경로(claude-cli)라서 실제 청구가 없고, 이 값은 "API였다면"의 환산에만 쓴다
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20 },
};

export const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";

// 모델별 추론(thinking) 설정. 모델마다 받는 값이 달라서 한 곳에 명시한다.
//   Haiku 5.5: 기본으로 추론이 켜져 있고 추론 토큰이 max_tokens에 포함돼서, 추출 요청에서 출력 2,048 중 1,655가
//     추론에 쓰여 JSON이 잘린 적이 있다(#75). 로컬 모델도 think:false로 돌리므로 같은 조건에서 비교하려고 끈다
//     (disabled는 effort high 이하에서만 받는다).
//   Sonnet 5.5: disabled가 400이다. 끄려면 between_tools (공식 문서 기준이고 API로 실호출은 해 보지 않았다.
//     채점 기본 경로는 claude-cli라 이 설정을 쓰지 않는다).
//   Opus 5.5: 추론을 끌 수 없다(disabled·budget_tokens 모두 400). 보내지 않는다.
const CLAUDE_THINKING: Record<string, { type: string } | undefined> = {
  "claude-haiku-5-5": { type: "disabled" },
  "claude-sonnet-5-5": { type: "between_tools" },
};

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
      `단가를 모르는 모델이에요: ${model}. _shared/reminder/claude.ts의 CLAUDE_PRICES에 공식 단가를 추가하세요.`,
    );
  }

  const thinking = CLAUDE_THINKING[model];

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
          ...(thinking ? { thinking } : {}),
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
    // Haiku의 태그는 #75와 같은 문자열이라 그때 쌓인 호출 캐시가 그대로 맞는다
    cacheTag: thinking ? `thinking=${thinking.type}` : "",
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
