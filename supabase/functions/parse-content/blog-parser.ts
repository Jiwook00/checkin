import TurndownService from "turndown";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts";
import { ParseError } from "./errors.ts";
import { fetchWithPolicy } from "./fetch-policy.ts";
import type { ParsedContent } from "./types.ts";

/**
 * 블로그(티스토리 등) URL에서 콘텐츠를 파싱한다.
 * fetch → DOM 파싱 → 본문 추출 → 마크다운 변환
 */
export async function parseBlog(
  url: string,
  fetchFn: typeof fetch,
): Promise<ParsedContent> {
  // 1. HTML 가져오기 (타임아웃·재시도·인코딩은 fetchWithPolicy가 처리)
  const { body: html } = await fetchWithPolicy(fetchFn, url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RetroReader/1.0; +https://retro-reader.app)",
    },
  });

  // 2. DOM 파싱
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    throw new ParseError(
      "extract",
      "NO_CONTENT_NODE",
      "structural",
      "HTML을 파싱할 수 없습니다",
    );
  }

  // 3. 본문 추출 (사이트별 셀렉터 시도 후 폴백)
  let title = "";
  let contentHtml = "";
  // deno_dom Element — TurndownService에 직접 전달해 내부 HTML 재파싱을 건너뜀
  // deno-lint-ignore no-explicit-any
  let contentNode: any = null;

  // 타이틀 추출
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  const titleEl = doc.querySelector("title");
  title =
    ogTitle?.getAttribute("content") || titleEl?.textContent || "제목 없음";

  // 티스토리 본문 셀렉터
  const tistorySelectors = [
    ".contents_style", // 티스토리 기본 스킨
    ".entry-content",
    ".article_view",
    "#article-view",
    ".post-content",
    ".tt_article_useless_p_margin",
  ];

  // 일반 블로그 셀렉터
  const genericSelectors = [
    "article",
    '[role="main"]',
    ".post-body",
    ".entry-content",
    ".content",
    "main",
  ];

  const allSelectors = [...tistorySelectors, ...genericSelectors];

  for (const selector of allSelectors) {
    const el = doc.querySelector(selector);
    if (el && el.innerHTML.trim().length > 100) {
      contentNode = el;
      contentHtml = el.innerHTML;
      break;
    }
  }

  // 폴백: body 전체에서 스크립트/스타일/nav 제거
  if (!contentNode) {
    const body = doc.querySelector("body");
    if (body) {
      // 불필요한 요소 제거
      const removeSelectors = [
        "script",
        "style",
        "nav",
        "header",
        "footer",
        ".sidebar",
        "#sidebar",
        ".comments",
        "#comments",
      ];
      for (const sel of removeSelectors) {
        body.querySelectorAll(sel).forEach((el: Element) => el.remove());
      }
      contentNode = body;
      contentHtml = body.innerHTML;
    }
  }

  if (!contentNode) {
    throw new ParseError(
      "extract",
      "NO_CONTENT_NODE",
      "structural",
      "본문 콘텐츠를 찾을 수 없습니다",
    );
  }

  // 4. HTML → 마크다운 변환
  // DOM 노드를 직접 전달해 TurndownService 내부의 HTML 재파싱(createDocument)을 우회
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  // 불필요한 태그 제거 규칙
  turndown.remove(["script", "style", "nav"]);

  const markdown = turndown.turndown(contentNode);

  return {
    title,
    content_html: contentHtml,
    content_markdown: markdown,
    tier: "selector",
  };
}
