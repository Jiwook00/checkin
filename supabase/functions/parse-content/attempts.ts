import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParseError } from "./errors.ts";
import type { ParseTier, QualityFlag } from "./types.ts";

export type AttemptTrigger = "user" | "backfill" | "benchmark";
export type AttemptStatus = "ok" | "degraded" | "failed";

export interface AttemptInput {
  trigger: AttemptTrigger;
  source_url: string;
  source_type: string;
  status: AttemptStatus;
  retrospective_id?: string | null;
  error?: ParseError;
  content_chars?: number;
  fetch_attempts?: number;
  tier?: ParseTier;
  quality_score?: number;
  quality_flags?: QualityFlag[];
  duration_ms: number;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * 파싱 1회 = 1행. 기록 실패가 사용자 응답을 막으면 안 되므로 예외를 던지지 않는다.
 */
export async function recordAttempt(
  admin: SupabaseClient,
  input: AttemptInput,
): Promise<void> {
  const { error } = await admin.from("checkin_parse_attempts").insert({
    retrospective_id: input.retrospective_id ?? null,
    trigger: input.trigger,
    source_url: input.source_url,
    hostname: hostnameOf(input.source_url),
    source_type: input.source_type,
    status: input.status,
    error_stage: input.error?.stage ?? null,
    error_code: input.error?.code ?? null,
    error_kind: input.error?.kind ?? null,
    error_detail: input.error?.detail || null,
    fetch_attempts: input.fetch_attempts ?? null,
    tier: input.tier ?? null,
    quality_score: input.quality_score ?? null,
    quality_flags: input.quality_flags ?? null,
    content_chars: input.content_chars ?? null,
    duration_ms: input.duration_ms,
  });
  if (error) {
    console.error(`파싱 시도 기록 실패: ${error.message}`);
  }
}
