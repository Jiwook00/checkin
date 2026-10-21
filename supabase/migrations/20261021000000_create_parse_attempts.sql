-- 파싱 시도 기록 (이슈 #54)
--   checkin_parse_attempts : parse-content 호출 1회 = 1행. 성공/실패 모두 기록
--   RLS on + 클라이언트 정책 없음 = service role(Edge Function) 전용

CREATE TABLE checkin_parse_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retrospective_id UUID REFERENCES checkin_retrospectives(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('user', 'backfill', 'benchmark')),
  source_url TEXT NOT NULL,
  hostname TEXT,
  source_type TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'failed')),
  tier TEXT,
  error_stage TEXT,
  error_code TEXT,
  error_kind TEXT,
  error_detail TEXT CHECK (char_length(error_detail) <= 500),
  fetch_attempts INTEGER,
  quality_score NUMERIC(4, 3),
  quality_flags TEXT[],
  content_chars INTEGER,
  llm_model TEXT,
  llm_input_tokens INTEGER,
  llm_output_tokens INTEGER,
  llm_cost_usd NUMERIC(10, 6),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 실패 행에는 항상 원인 코드가 있어야 한다
  CONSTRAINT checkin_parse_attempts_failed_has_code
    CHECK (status <> 'failed' OR error_code IS NOT NULL)
);

CREATE INDEX idx_checkin_parse_attempts_hostname_created
  ON checkin_parse_attempts(hostname, created_at);
CREATE INDEX idx_checkin_parse_attempts_status
  ON checkin_parse_attempts(status);

ALTER TABLE checkin_parse_attempts ENABLE ROW LEVEL SECURITY;
