import {
  detectSourceType,
  extractNotionPageId,
  type SourceType,
} from "./url-utils.ts";
import { parseBlog } from "./blog-parser.ts";
import { parseNotion } from "./notion-parser.ts";

/**
 * 파이프라인이 바깥 세계와 닿는 지점. 벤치마크에서는 스냅샷 리더로 교체한다.
 */
export interface PipelineDeps {
  fetch: typeof fetch;
}

export type PipelineResult =
  | {
      ok: true;
      title: string;
      content_html: string;
      content_markdown: string;
      source_type: SourceType;
      duration_ms: number;
    }
  | {
      ok: false;
      source_type: SourceType;
      duration_ms: number;
      error: string;
      // input: 요청 자체가 잘못됨(400) / parse: 파싱 중 예외(500)
      stage: "input" | "parse";
    };

/**
 * URL 하나를 파싱한다. HTTP·인증·DB는 다루지 않는다.
 * URL 검증(SSRF)은 호출자가 먼저 끝냈다고 가정한다.
 */
export async function runPipeline(
  url: string,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const startedAt = performance.now();
  const sourceType = detectSourceType(url);
  const elapsed = () => Math.round(performance.now() - startedAt);

  try {
    let parsed: {
      title: string;
      content_html: string;
      content_markdown: string;
    };

    if (sourceType === "notion") {
      const pageId = extractNotionPageId(url);
      if (!pageId) {
        return {
          ok: false,
          source_type: sourceType,
          duration_ms: elapsed(),
          error: "노션 페이지 ID를 추출할 수 없습니다",
          stage: "input",
        };
      }
      parsed = await parseNotion(pageId, deps.fetch);
    } else {
      parsed = await parseBlog(url, deps.fetch);
    }

    return {
      ok: true,
      ...parsed,
      source_type: sourceType,
      duration_ms: elapsed(),
    };
  } catch (err) {
    return {
      ok: false,
      source_type: sourceType,
      duration_ms: elapsed(),
      error: err instanceof Error ? err.message : "알 수 없는 오류",
      stage: "parse",
    };
  }
}
