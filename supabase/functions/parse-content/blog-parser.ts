interface ParsedContent {
  title: string;
  content_html: string;
  content_markdown: string;
}

/**
 * Jina Reader API를 통해 URL 콘텐츠를 마크다운으로 파싱한다.
 * JINA_API_KEY 환경변수가 있으면 인증 헤더 추가 (rate limit 완화).
 */
export async function parseBlog(url: string): Promise<ParsedContent> {
  const jinaUrl = `https://r.jina.ai/${url}`;

  const headers: Record<string, string> = {
    Accept: "text/plain",
    "X-Return-Format": "markdown",
  };

  const jinaKey = Deno.env.get("JINA_API_KEY");
  if (jinaKey) {
    headers["Authorization"] = `Bearer ${jinaKey}`;
  }

  const response = await fetch(jinaUrl, { headers });

  if (!response.ok) {
    throw new Error(`페이지를 가져올 수 없습니다: ${response.status}`);
  }

  const markdown = await response.text();

  // 첫 번째 # 제목에서 타이틀 추출
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? "제목 없음";

  return {
    title,
    content_html: markdown,
    content_markdown: markdown,
  };
}
