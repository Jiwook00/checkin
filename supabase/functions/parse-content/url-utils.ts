export type SourceType = "notion" | "tistory" | "other";

/**
 * SSRF 방지: http/https 스킴만 허용하고, 사설 IP 대역 차단
 */
export function validateSourceUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "유효하지 않은 URL입니다" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "http 또는 https URL만 허용됩니다" };
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return { ok: false, reason: "허용되지 않는 URL입니다" };
  }

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    ) {
      return { ok: false, reason: "허용되지 않는 URL입니다" };
    }
  }

  return { ok: true, url };
}

export function detectSourceType(url: string): SourceType {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes("notion.so") || hostname.includes("notion.site")) {
      return "notion";
    }
    if (hostname.includes("tistory.com")) {
      return "tistory";
    }
    return "other";
  } catch {
    return "other";
  }
}

/**
 * 노션 공유 링크에서 페이지 ID를 추출한다.
 *
 * 지원하는 형식:
 * - https://www.notion.so/31120177599a809bae33da3079158fbe
 * - https://www.notion.so/workspace/Page-Title-31120177599a809bae33da3079158fbe
 * - https://notion.site/Page-Title-31120177599a809bae33da3079158fbe
 * - 쿼리 파라미터가 포함된 URL (e.g., ?source=copy_link)
 */
export function extractNotionPageId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // 경로의 마지막 세그먼트에서 32자 hex ID를 추출
    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "";

    // 하이픈 없는 UUID 형태 (32자 hex)를 찾는다
    const hexMatch = lastSegment.match(/([a-f0-9]{32})$/i);
    if (hexMatch) {
      return hexMatch[1];
    }

    // 하이픈 포함된 UUID 형태도 시도
    const uuidMatch = lastSegment.match(
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
    );
    if (uuidMatch) {
      return uuidMatch[1].replace(/-/g, "");
    }

    return null;
  } catch {
    return null;
  }
}
