-- 도메인 규칙 캐시 (이슈 #59)
--   checkin_parse_rules : LLM이 찾고 검증을 통과한 본문 셀렉터를 hostname 단위로 저장
--   규칙(셀렉터·Readability)이 실패한 페이지에서 LLM 직전에 적용한다
--   RLS on + 클라이언트 정책 없음 = service role(Edge Function) 전용

CREATE TABLE checkin_parse_rules (
  hostname TEXT PRIMARY KEY,
  selector TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('llm', 'manual')),
  -- 규칙을 만든 글 (오염 추적용)
  seed_url TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checkin_parse_rules ENABLE ROW LEVEL SECURITY;
