import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";
import {
  DOMParser,
  type Element,
  type HTMLDocument,
} from "https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts";
import { ParseError } from "./errors.ts";
import { fetchWithPolicy } from "./fetch-policy.ts";
import type { ParsedContent, ParseTier } from "./types.ts";

// 셀렉터·Readability 결과가 이보다 짧으면 본문을 못 찾은 것으로 본다
const MIN_CONTENT_CHARS = 100;

// 중첩 template을 펼치는 최대 횟수
const MAX_TEMPLATE_ROUNDS = 3;

/**
 * `<template>` 안의 내용을 제자리에 펼친다.
 * 일부 스킨(티스토리 등)은 본문을 template에 넣고 스크립트로 옮겨 그리는데,
 * deno_dom은 template 내용을 자식 노드로 보지 않아 셀렉터가 닿지 않는다.
 */
export function unwrapTemplates(doc: HTMLDocument): void {
  for (let round = 0; round < MAX_TEMPLATE_ROUNDS; round++) {
    const templates = doc.querySelectorAll("template");
    if (templates.length === 0) return;
    for (const tpl of templates) {
      const parent = tpl.parentNode;
      if (!parent) continue;
      const holder = doc.createElement("div");
      holder.innerHTML = tpl.innerHTML;
      for (const child of [...holder.childNodes]) {
        parent.insertBefore(child, tpl);
      }
      tpl.remove();
    }
  }
}

/**
 * 셀렉터가 모두 실패했을 때 Readability로 본문을 고른다.
 * Readability는 문서를 변경하므로 원본 doc이 아니라 새로 파싱한 문서에 돌린다.
 */
function extractWithReadability(
  html: string,
): { node: Element; html: string } | null {
  const fresh = new DOMParser().parseFromString(html, "text/html");
  if (!fresh) return null;
  unwrapTemplates(fresh);

  const article = new Readability(
    fresh as unknown as ConstructorParameters<typeof Readability>[0],
  ).parse();
  if (
    !article?.content ||
    (article.textContent ?? "").trim().length < MIN_CONTENT_CHARS
  ) {
    return null;
  }

  // turndown에 노드로 넘기기 위해 결과 HTML을 다시 파싱한다
  const node = new DOMParser().parseFromString(
    article.content,
    "text/html",
  )?.body;
  return node ? { node, html: article.content } : null;
}

/** 글 제목: og:title → <title> → 기본값. LLM 폴백 경로도 같은 규칙을 쓴다 */
export function pickTitle(doc: HTMLDocument): string {
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  const titleEl = doc.querySelector("title");
  return (
    ogTitle?.getAttribute("content") || titleEl?.textContent || "제목 없음"
  );
}

/**
 * HTML → 마크다운 변환기. 규칙 경로와 LLM 폴백 경로가 같은 설정을 쓴다.
 * DOM 노드를 직접 넘기면 TurndownService 내부의 HTML 재파싱(createDocument)을 우회한다.
 */
export function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  // 불필요한 태그 제거 규칙
  turndown.remove(["script", "style", "nav"]);
  return turndown;
}

/**
 * 블로그(티스토리 등) URL의 HTML을 가져온다.
 * 타임아웃·재시도·인코딩은 fetchWithPolicy가 처리한다.
 * 이 함수가 성공해야만 HTML이 있는 것이므로 LLM 폴백은 그 뒤에만 붙는다.
 */
export async function fetchBlogHtml(
  url: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const { body } = await fetchWithPolicy(fetchFn, url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RetroReader/1.0; +https://retro-reader.app)",
    },
  });
  return body;
}

/**
 * 가져온 HTML에서 본문을 추출한다.
 * DOM 파싱 → 본문 추출 → 마크다운 변환
 */
export function extractBlog(html: string): ParsedContent {
  // 1. DOM 파싱
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    throw new ParseError(
      "extract",
      "NO_CONTENT_NODE",
      "structural",
      "HTML을 파싱할 수 없습니다",
    );
  }

  unwrapTemplates(doc);

  // 티스토리 보호글은 본문 없이 비밀번호 폼만 온다. 일반 셀렉터(main)가 스킨 전체를
  // 본문으로 잡아 성공으로 저장되던 조용한 실패라 셀렉터보다 먼저 거른다
  const description = doc
    .querySelector('meta[name="description"]')
    ?.getAttribute("content");
  if (
    doc.querySelector("form.protected_form") ||
    description?.trim().startsWith("보호되어 있는 글입니다")
  ) {
    throw new ParseError(
      "extract",
      "PROTECTED_POST",
      "user_action",
      "비밀번호가 걸린 글이라 가져올 수 없습니다",
    );
  }

  // 2. 본문 추출 (사이트별 셀렉터 시도 후 폴백)
  let title = "";
  let contentHtml = "";
  // deno_dom Element — TurndownService에 직접 전달해 내부 HTML 재파싱을 건너뜀
  // deno-lint-ignore no-explicit-any
  let contentNode: any = null;

  title = pickTitle(doc);

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

  let tier: ParseTier = "selector";
  for (const selector of allSelectors) {
    const el = doc.querySelector(selector);
    if (el && el.innerHTML.trim().length > MIN_CONTENT_CHARS) {
      contentNode = el;
      contentHtml = el.innerHTML;
      break;
    }
  }

  // 셀렉터가 모두 실패하면 Readability. body 통째 폴백은 하지 않는다
  // (사이드바·댓글이 섞인 결과가 성공으로 저장되는 조용한 실패였다)
  if (!contentNode) {
    const article = extractWithReadability(html);
    if (article) {
      contentNode = article.node;
      contentHtml = article.html;
      tier = "readability";
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

  // 3. HTML → 마크다운 변환
  const markdown = createTurndown().turndown(contentNode);

  return {
    title,
    content_html: contentHtml,
    content_markdown: markdown,
    tier,
  };
}
