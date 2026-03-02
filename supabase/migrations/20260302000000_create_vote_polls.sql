-- 회차별 일정 조율 세션
CREATE TABLE checkin_vote_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session TEXT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'confirmed')),
  confirmed_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 멤버별 응답 (날짜 + 선택 시간들)
-- selected_dates JSON 구조:
--   available 모드: [{ date: number, hours: number[] }]
--     - 평일: hours = [22]
--     - 주말: hours = 선택한 시간들 (10~22)
--   unavailable 모드: [{ date: number, hours: [] }]
--     - 불가능한 날짜만 저장 (나머지는 가능으로 해석)
CREATE TABLE checkin_vote_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES checkin_vote_polls(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('available', 'unavailable')),
  selected_dates JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, member_id)
);

CREATE INDEX idx_vote_responses_poll_id ON checkin_vote_responses(poll_id);

-- RLS
ALTER TABLE checkin_vote_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_vote_responses ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 투표 세션 읽기 가능
CREATE POLICY "authenticated read polls" ON checkin_vote_polls
  FOR SELECT TO authenticated USING (true);

-- 인증된 사용자는 모든 응답 읽기 가능 (집계 표시용)
CREATE POLICY "authenticated read responses" ON checkin_vote_responses
  FOR SELECT TO authenticated USING (true);

-- 본인 응답만 작성 가능
CREATE POLICY "own response insert" ON checkin_vote_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);

-- 본인 응답만 수정 가능
CREATE POLICY "own response update" ON checkin_vote_responses
  FOR UPDATE TO authenticated USING (auth.uid() = member_id);
