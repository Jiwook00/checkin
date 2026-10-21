import {
  detectSourceType,
  extractNotionPageId,
  type SourceType,
} from "./url-utils.ts";
import { ParseError, toParseError } from "./errors.ts";
import { extractBlog, fetchBlogHtml } from "./blog-parser.ts";
import { parseNotion } from "./notion-parser.ts";
import {
  runLlmFallback,
  type LlmClient,
  type LlmFallbackResult,
} from "./llm-fallback.ts";
import {
  assessQuality,
  isDegraded,
  isEmptyContent,
  type QualityAssessment,
} from "./quality.ts";
import type { ParsedContent, ParseTier, QualityFlag } from "./types.ts";

/**
 * 파이프라인이 바깥 세계와 닿는 지점. 벤치마크에서는 스냅샷 리더로 교체한다.
 */
export interface PipelineDeps {
  fetch: typeof fetch;
  // 없으면 LLM 폴백 단계를 건너뛴다 (API 키 미등록, 벤치 기본값)
  llm?: LlmClient;
}

/** LLM 폴백을 시도했을 때의 기록. 본문(parsed)은 결과에 합쳐지므로 뺀다 */
export type LlmReport = Omit<LlmFallbackResult, "parsed">;

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
      llm?: LlmReport;
    }
  | {
      ok: false;
      source_type: SourceType;
      duration_ms: number;
      fetch_attempts: number;
      error: ParseError;
      llm?: LlmReport;
    };

/** attempts.error_detail에 붙이는 LLM 폴백 요약 */
export function llmNote(llm: LlmReport): string {
  if (llm.outcome === "skipped") return `llm_skipped=${llm.reasons.join(",")}`;
  // error의 reasons는 이미 llm_error=… 형태다
  if (llm.outcome === "error") return llm.reasons.join("; ");
  return `llm=${llm.outcome} ${llm.reasons.join("; ")}`.trim();
}

/** LLM이 대상으로 삼는 규칙 실패: 본문 노드를 못 찾았거나 빈 본문. 보호글 등은 제외 */
function isLlmTargetFailure(error: ParseError): boolean {
  return error.code === "NO_CONTENT_NODE" || error.code === "LOW_QUALITY";
}

/** 프롬프트에 넣는 규칙 실패 사유 한 줄 */
function ruleReason(
  failure: ParseError | undefined,
  quality: QualityAssessment | undefined,
): string {
  if (failure?.code === "LOW_QUALITY") {
    return "규칙이 고른 노드에 텍스트도 이미지도 없음 (빈 본문)";
  }
  if (failure) return "알려진 셀렉터와 Readability가 본문 노드를 찾지 못함";
  return `규칙이 고른 결과가 품질 미달: ${quality?.plain_chars}자 flags=${(quality?.flags ?? []).join(",")}`;
}

/**
 * LLM 폴백이 복구하지 못했을 때의 최종 에러.
 * 모델이 응답했는데 셀렉터를 못 찾았으면 LLM_NO_SELECTOR, 호출 자체가 안 됐으면 원래 에러를 유지한다.
 */
function failureAfterLlm(error: ParseError, llm: LlmReport): ParseError {
  if (llm.outcome === "not_found" || llm.outcome === "rejected") {
    return new ParseError(
      "llm",
      "LLM_NO_SELECTOR",
      "structural",
      "본문 위치를 찾지 못했어요",
      `after=${error.code}; ${llm.reasons.join("; ")}`,
    );
  }
  return new ParseError(
    error.stage,
    error.code,
    error.kind,
    error.message,
    [error.detail, llmNote(llm)].filter(Boolean).join("; "),
  );
}

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

  const fail = (error: ParseError, llm?: LlmReport): PipelineResult => ({
    ok: false,
    source_type: sourceType,
    duration_ms: elapsed(),
    fetch_attempts: fetchAttempts,
    error,
    ...(llm ? { llm } : {}),
  });

  try {
    let parsed: ParsedContent | undefined;
    // 규칙 단계의 실패. LLM 폴백 대상이면 폴백을 거친 뒤 최종 에러가 된다
    let failure: ParseError | undefined;
    // HTML을 받은 블로그 경로에서만 채워진다. LLM 폴백은 이 값이 있을 때만 호출한다
    let blogHtml: string | undefined;

    if (sourceType === "notion") {
      const pageId = extractNotionPageId(url);
      if (!pageId) {
        return fail(
          new ParseError(
            "validate",
            "INVALID_URL",
            "user_action",
            "노션 페이지 ID를 추출할 수 없습니다",
          ),
        );
      }
      parsed = await parseNotion(pageId, countingFetch);
    } else {
      // fetch 오류는 여기서 던져져 바깥 catch로 간다 (HTML이 없으니 LLM 대상이 아니다)
      blogHtml = await fetchBlogHtml(url, countingFetch);
      try {
        parsed = extractBlog(blogHtml);
      } catch (err) {
        failure = toParseError(err);
      }
    }

    // 텍스트도 이미지도 없으면 성공으로 저장하지 않는다 (조용한 실패)
    if (parsed && isEmptyContent(parsed.content_markdown)) {
      failure = new ParseError(
        "quality",
        "LOW_QUALITY",
        "structural",
        "본문이 비어 있습니다",
        "empty",
      );
      parsed = undefined;
    }

    let quality = parsed
      ? assessQuality({
          markdown: parsed.content_markdown,
          tier: parsed.tier,
          flags: parsed.quality_flags,
        })
      : undefined;

    // 규칙이 실패했거나 품질 미달인 블로그 글만 LLM이 본문 위치를 다시 고른다
    let llm: LlmReport | undefined;
    const eligible = failure
      ? isLlmTargetFailure(failure)
      : quality !== undefined && isDegraded(quality.score);
    if (blogHtml !== undefined && deps.llm && eligible) {
      const { parsed: recovered, ...report } = await runLlmFallback(
        blogHtml,
        ruleReason(failure, quality),
        deps.llm,
      );
      llm = report;
      if (recovered) {
        parsed = recovered;
        failure = undefined;
        quality = assessQuality({
          markdown: recovered.content_markdown,
          tier: recovered.tier,
          flags: recovered.quality_flags,
        });
      } else if (failure) {
        failure = failureAfterLlm(failure, report);
      }
    }

    if (failure) return fail(failure, llm);
    if (!parsed || !quality) {
      return fail(
        new ParseError(
          "extract",
          "UNKNOWN",
          "structural",
          "본문을 찾지 못했어요",
        ),
        llm,
      );
    }

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
      ...(llm ? { llm } : {}),
    };
  } catch (err) {
    return fail(toParseError(err));
  }
}
