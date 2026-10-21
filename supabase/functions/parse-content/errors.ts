export type ParseStage =
  | "validate"
  | "fetch"
  | "extract"
  | "quality"
  | "llm"
  | "store";

/**
 * transient: 재시도하면 될 수 있음 / user_action: 사용자가 고쳐야 함
 * structural: 사이트 구조 때문에 현재 파서로는 불가 / unsupported: 지원 대상 아님
 */
export type ParseErrorKind =
  | "transient"
  | "user_action"
  | "structural"
  | "unsupported";

export type ParseErrorCode =
  | "INVALID_URL"
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP_5XX"
  | "HTTP_429"
  | "HTTP_403"
  | "HTTP_404"
  | "HTTP_4XX"
  | "NOTION_PRIVATE"
  | "NOTION_SCHEMA"
  | "NO_CONTENT_NODE"
  | "PROTECTED_POST"
  | "LOW_QUALITY"
  | "JS_RENDERED"
  | "LLM_NO_SELECTOR"
  | "STORE_FAILED"
  | "UNKNOWN";

const DETAIL_MAX = 500;

export class ParseError extends Error {
  readonly stage: ParseStage;
  readonly code: ParseErrorCode;
  readonly kind: ParseErrorKind;
  readonly detail: string;

  /** message는 사용자에게 보이는 한국어 문장, detail은 원인 추적용 원문(500자 제한) */
  constructor(
    stage: ParseStage,
    code: ParseErrorCode,
    kind: ParseErrorKind,
    message: string,
    detail = "",
  ) {
    super(message);
    this.name = "ParseError";
    this.stage = stage;
    this.code = code;
    this.kind = kind;
    this.detail = detail.slice(0, DETAIL_MAX);
  }
}

/** HTTP 상태 코드 → ParseError. 호출자가 던진다. */
export function httpError(
  status: number,
  message: string,
  detail = "",
): ParseError {
  const d = `HTTP ${status}${detail ? ` ${detail}` : ""}`;
  if (status === 429) {
    return new ParseError("fetch", "HTTP_429", "transient", message, d);
  }
  if (status === 408) {
    return new ParseError("fetch", "HTTP_4XX", "transient", message, d);
  }
  if (status >= 500) {
    return new ParseError("fetch", "HTTP_5XX", "transient", message, d);
  }
  if (status === 403) {
    // HTML을 못 받았으므로 LLM 폴백 대상이 아니다
    return new ParseError("fetch", "HTTP_403", "unsupported", message, d);
  }
  if (status === 404) {
    return new ParseError("fetch", "HTTP_404", "user_action", message, d);
  }
  return new ParseError("fetch", "HTTP_4XX", "structural", message, d);
}

/** 어떤 예외든 ParseError로 정규화한다. fetch 단계에서 잡힌 예외는 stage를 지정한다. */
export function toParseError(
  err: unknown,
  fallbackStage: ParseStage = "extract",
): ParseError {
  if (err instanceof ParseError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new ParseError(
      "fetch",
      "TIMEOUT",
      "transient",
      "페이지 응답이 너무 늦어요",
      message,
    );
  }
  if (err instanceof TypeError && fallbackStage === "fetch") {
    return new ParseError(
      "fetch",
      "NETWORK",
      "transient",
      "페이지에 연결할 수 없어요",
      message,
    );
  }
  return new ParseError(
    fallbackStage,
    "UNKNOWN",
    "structural",
    message || "알 수 없는 오류",
    message,
  );
}
