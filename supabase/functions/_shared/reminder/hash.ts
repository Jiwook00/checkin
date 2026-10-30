// 해시 헬퍼 (#79). 하네스의 run config와 운영 drafts의 prompt_sha256이 같은 방식으로 계산되어야 비교할 수 있다

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 단계의 프롬프트 해시: 프롬프트 문자열들을 구분자로 이어 해시한다 (하네스 Stage.prompts와 같은 배열을 준다) */
export function promptSha256(prompts: string[]): Promise<string> {
  return sha256(prompts.join("\n---\n"));
}
