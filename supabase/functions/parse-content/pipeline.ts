import {
  detectSourceType,
  extractNotionPageId,
  type SourceType,
} from "./url-utils.ts";
import { ParseError, toParseError } from "./errors.ts";
import { parseBlog } from "./blog-parser.ts";
import { parseNotion } from "./notion-parser.ts";
import type { ParsedContent, ParseTier } from "./types.ts";

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
      tier: ParseTier;
      quality_flags?: string[];
      source_type: SourceType;
      duration_ms: number;
      fetch_attempts: number;
    }
  | {
      ok: false;
      source_type: SourceType;
      duration_ms: number;
      fetch_attempts: number;
      error: ParseError;
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

  // 재시도까지 포함한 실제 HTTP 요청 횟수를 센다 (파서는 이 래퍼를 fetch로 받는다)
  let fetchAttempts = 0;
  const countingFetch: typeof fetch = (input, init) => {
    fetchAttempts++;
    return deps.fetch(input, init);
  };

  try {
    let parsed: ParsedContent;

    if (sourceType === "notion") {
      const pageId = extractNotionPageId(url);
      if (!pageId) {
        return {
          ok: false,
          source_type: sourceType,
          duration_ms: elapsed(),
          fetch_attempts: fetchAttempts,
          error: new ParseError(
            "validate",
            "INVALID_URL",
            "user_action",
            "노션 페이지 ID를 추출할 수 없습니다",
          ),
        };
      }
      parsed = await parseNotion(pageId, countingFetch);
    } else {
      parsed = await parseBlog(url, countingFetch);
    }

    return {
      ok: true,
      ...parsed,
      source_type: sourceType,
      duration_ms: elapsed(),
      fetch_attempts: fetchAttempts,
    };
  } catch (err) {
    return {
      ok: false,
      source_type: sourceType,
      duration_ms: elapsed(),
      fetch_attempts: fetchAttempts,
      error: toParseError(err),
    };
  }
}
