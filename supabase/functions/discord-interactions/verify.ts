// Discord Interactions 요청 서명 검증 (이슈 #101). env를 읽지 않는 순수 함수만 둔다
//
// Discord는 `timestamp + 원문 body`에 Ed25519로 서명한다. 검증은 Web Crypto로 한다 (라이브러리 없음).
// body는 반드시 받은 바이트 그대로 넘긴다. 파싱 후 다시 직렬화하면 서명이 깨진다

/** 서명 시각이 현재와 이만큼(초) 넘게 차이 나면 거절한다. 캡처한 요청을 다시 보내는 공격의 창을 줄인다 */
export const MAX_CLOCK_SKEW_SECONDS = 300;

const HEX_PATTERN = /^[0-9a-f]+$/i;
const TIMESTAMP_PATTERN = /^\d+$/;

/** 길이(바이트)가 정확히 맞는 hex만 바이트로 바꾼다. 아니면 null */
export function hexToBytes(
  hex: string,
  length: number,
): Uint8Array<ArrayBuffer> | null {
  if (hex.length !== length * 2 || !HEX_PATTERN.test(hex)) return null;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** 포털의 Public Key(32바이트 hex)를 검증용 키로. 형식이 틀리면 null */
export async function importPublicKey(hex: string): Promise<CryptoKey | null> {
  const raw = hexToBytes(hex.trim(), 32);
  if (!raw) return null;
  try {
    return await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }
}

export async function verifyDiscordRequest(
  key: CryptoKey,
  signature: string | null,
  timestamp: string | null,
  rawBody: Uint8Array,
  nowSeconds: number,
): Promise<boolean> {
  if (!signature || !timestamp) return false;
  const sig = hexToBytes(signature, 64);
  if (!sig) return false;
  if (!TIMESTAMP_PATTERN.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
    return false;
  }

  const prefix = new TextEncoder().encode(timestamp);
  const message = new Uint8Array(prefix.length + rawBody.length);
  message.set(prefix, 0);
  message.set(rawBody, prefix.length);

  try {
    return await crypto.subtle.verify("Ed25519", key, sig, message);
  } catch {
    return false;
  }
}
