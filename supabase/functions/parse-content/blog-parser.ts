import TurndownService from "turndown";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

interface ParsedContent {
  title: string;
  content_html: string;
  content_markdown: string;
}

/**
 * 블로그(티스토리 등) URL에서 콘텐츠를 파싱한다.
 * fetch → DOM 파싱 → 본문 추출 → 마크다운 변환
 */
export async function parseBlog(url: string): Promise<ParsedContent> {
  // 1. HTML 가져오기
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RetroReader/1.0; +https://retro-reader.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`페이지를 가져올 수 없습니다: ${response.status}`);
  }

  const html = await response.text();

  // 2. DOM 파싱
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    throw new Error("HTML을 파싱할 수 없습니다");
  }

  // 3. 본문 추출 (사이트별 셀렉터 시도 후 폴백)
  let title = "";
  let contentHtml = "";

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
      contentHtml = el.innerHTML;
      break;
    }
  }

  // 폴백: body 전체에서 스크립트/스타일/nav 제거
  if (!contentHtml) {
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
        body.querySelectorAll(sel).forEach((el) => el.remove());
      }
      contentHtml = body.innerHTML;
    }
  }

  if (!contentHtml) {
    throw new Error("본문 콘텐츠를 찾을 수 없습니다");
  }

  // 4. HTML → 마크다운 변환
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  // 불필요한 태그 제거 규칙
  turndown.remove(["script", "style", "nav"]);

  const markdown = turndown.turndown(contentHtml);

  return {
    title,
    content_html: contentHtml,
    content_markdown: markdown,
  };
}
