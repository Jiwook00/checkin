-- 회차별 공통 질문 (이슈 #78)
--   checkin_session_questions : 매달 "이번 달 공통 질문"을 회고 회차(session)당 하나씩 저장
--   session 은 회고 회차(checkin_retrospectives.session)다. 투표 회차(checkin_vote_polls.session)와 한 달 어긋난다
--   status: proposed(후보) → approved(대니 승인). 멤버는 approved 만 볼 수 있다
--   쓰기 정책 없음 = service role(scripts/session-question.mjs) 전용

CREATE TABLE checkin_session_questions (
  session TEXT PRIMARY KEY,
  question TEXT NOT NULL CHECK (length(btrim(question)) > 0),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved')),
  created_by UUID REFERENCES checkin_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  -- approved 인 row 만 approved_at 을 가진다
  CONSTRAINT checkin_session_questions_approved_at_check
    CHECK ((status = 'approved') = (approved_at IS NOT NULL))
);

ALTER TABLE checkin_session_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read approved" ON checkin_session_questions
  FOR SELECT TO authenticated USING (status = 'approved');

-- letters/galpi-letters.json 에 있던 기존 질문 (2026-08 은 ledger 가 아니라 실제로 발송한 문장)
INSERT INTO checkin_session_questions (session, question, status, approved_at) VALUES
  ('2026-07', '요즘 제일 자주 여는 앱(또는 사이트)은?', 'approved', now()),
  ('2026-08', '이번 달 가장 만족스러웠던 소비 (잘 산 것)는?', 'approved', now()),
  ('2026-09', '긴 휴식 후 다시 원래의 리듬을 되찾는 나만의 방법은?', 'approved', now());
