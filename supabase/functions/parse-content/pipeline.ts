import {
  detectSourceType,
  extractNotionPageId,
  type SourceType,
} from "./url-utils.ts";
import { ParseError, toParseError } from "./errors.ts";
import { parseBlog } from "./blog-parser.ts";
import { parseNotion } from "./notion-parser.ts";
import { assessQuality, isDegraded, isEmptyContent } from "./quality.ts";
import type { ParsedContent, ParseTier, QualityFlag } from "./types.ts";

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
      // 품질 미달이면 degraded. 본문은 그대로 돌려주고 저장 여부는 호출자가 정한다
      status: "ok" | "degraded";
      quality_score: number;
      quality_flags?: QualityFlag[];
      // toPlain 기준 글자 수 (checkin_parse_attempts.content_chars)
      content_chars: number;
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

    // 텍스트도 이미지도 없으면 성공으로 저장하지 않는다 (조용한 실패)
    if (isEmptyContent(parsed.content_markdown)) {
      throw new ParseError(
        "quality",
        "LOW_QUALITY",
        "structural",
        "본문이 비어 있습니다",
        "empty",
      );
    }

    const quality = assessQuality({
      markdown: parsed.content_markdown,
      tier: parsed.tier,
      flags: parsed.quality_flags,
    });

    return {
      ok: true,
      ...parsed,
      status: isDegraded(quality.score) ? "degraded" : "ok",
      quality_score: quality.score,
      // 플래그가 없으면 빈 배열 대신 생략 (attempts에는 null로 기록)
      ...(quality.flags.length > 0 ? { quality_flags: quality.flags } : {}),
      content_chars: quality.plain_chars,
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
