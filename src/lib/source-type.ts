import type { Retrospective } from "../types";

/**
 * 서버(parse-content)에 닿지 못했을 때 링크만 저장하는 폴백 전용.
 * 정상 경로의 source_type은 서버가 판단한다.
 */
export function detectSourceType(url: string): Retrospective["source_type"] {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (/notion\.(so|site|com)/.test(hostname)) return "notion";
    if (hostname.includes("tistory.com")) return "tistory";
  } catch {
    // 잘못된 URL은 other로 둔다
  }
  return "other";
}
