import { httpError, ParseError, toParseError } from "./errors.ts";

/** 검증 스크립트가 값을 낮춰 쓸 수 있도록 상수 대신 객체로 둔다 */
export const fetchPolicy = {
  timeoutMs: 10_000,
  maxRetries: 2,
  backoffBaseMs: 500,
  retryAfterMaxMs: 5_000,
};

const META_SNIFF_BYTES = 1024;

type AttemptResult =
  | { ok: true; response: Response; body: string }
  | { ok: false; error: ParseError; retryAfterMs: number | null };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry-After 헤더(초 단위 숫자)를 ms로. 없거나 날짜 형식이면 null */
function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds * 1000;
}

function charsetFromContentType(contentType: string | null): string | null {
  const match = contentType?.match(/charset\s*=\s*["']?([\w.:-]+)/i);
  return match ? match[1] : null;
}

function charsetFromBom(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  return null;
}

/** 앞부분을 latin1로 읽어 <meta charset> 또는 http-equiv를 찾는다 */
function charsetFromMeta(bytes: Uint8Array): string | null {
  const head = new TextDecoder("latin1").decode(
    bytes.subarray(0, META_SNIFF_BYTES),
  );
  const match =
    head.match(/<meta[^>]+charset\s*=\s*["']?\s*([\w.:-]+)/i) ??
    head.match(/<meta[^>]+content\s*=\s*["'][^"']*charset=([\w.:-]+)/i);
  return match ? match[1] : null;
}

/** 헤더 → BOM → meta 순으로 인코딩을 정하고, 모르는 라벨이면 UTF-8로 읽는다 */
export function decodeBody(
  bytes: Uint8Array,
  contentType: string | null,
): string {
  const label =
    charsetFromContentType(contentType) ??
    charsetFromBom(bytes) ??
    charsetFromMeta(bytes) ??
    "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function attemptOnce(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit | undefined,
): Promise<AttemptResult> {
  const timeout = AbortSignal.timeout(fetchPolicy.timeoutMs);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  let response: Response;
  let bytes: Uint8Array;
  try {
    response = await fetchFn(url, { ...init, signal });
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (err) {
    return { ok: false, error: toParseError(err, "fetch"), retryAfterMs: null };
  }

  const contentType = response.headers.get("content-type");
  const body = decodeBody(bytes, contentType);
  if (!response.ok) {
    return {
      ok: false,
      error: httpError(
        response.status,
        `페이지를 가져올 수 없습니다: ${response.status}`,
        body.slice(0, 200),
      ),
      retryAfterMs: retryAfterMs(response),
    };
  }
  return { ok: true, response, body };
}

/**
 * 타임아웃·재시도·인코딩 처리가 들어간 fetch. 본문은 문자열로 한 번만 읽어 돌려준다.
 * transient 오류(네트워크·타임아웃·408·429·5xx)만 재시도하고, 그 외 4xx는 바로 던진다.
 * Retry-After가 허용 한도(5초)를 넘으면 기다리지 않고 그 오류로 실패한다.
 */
export async function fetchWithPolicy(
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<{ response: Response; body: string }> {
  for (let attempt = 0; ; attempt++) {
    const result = await attemptOnce(fetchFn, url, init);
    if (result.ok) return result;

    const { error, retryAfterMs: hinted } = result;
    if (error.kind !== "transient" || attempt >= fetchPolicy.maxRetries) {
      throw error;
    }
    if (hinted != null && hinted > fetchPolicy.retryAfterMaxMs) throw error;

    await sleep(
      hinted ?? fetchPolicy.backoffBaseMs * 2 ** attempt + Math.random() * 250,
    );
  }
}
