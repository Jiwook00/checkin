-- 리마인더 초안 (이슈 #79)
--   checkin_reminder_drafts : 멤버 한 명의 한 회차 리마인더 초안. 생성할 때마다 row 를 쌓는다 (재생성해도 덮어쓰지 않음)
--   session 은 회고 회차(checkin_retrospectives.session)다. 투표 회차와 한 달 어긋난다
--   input/extract/output 은 그때의 스냅샷이라, 나중에 회고나 프롬프트가 바뀌어도 이 초안이 왜 이렇게 나왔는지 다시 볼 수 있다
--   검토 기록(status/edited_mail/review_note)은 #84·#77 에서 사람 라벨로 쓴다
--   쓰기: INSERT 는 정책이 없다 = service role(Edge Function generate-reminders) 전용.
--         관리자는 검토 컬럼만 UPDATE 할 수 있다 (생성된 mail/output 을 바꾸면 라벨의 기준이 흔들린다)

CREATE TABLE checkin_reminder_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES checkin_members(id) ON DELETE CASCADE,
  -- 생성 입력 스냅샷: 이름·월·voteOpen·공통 질문·공지·고른 재료·근거 탈락 수·직전 회고 id/해시/상태
  input JSONB NOT NULL,
  -- 추출 결과와 그 호출 기록. 같은 본문·같은 프롬프트면 이전 row 의 결과를 재사용한다 (reusedFrom)
  extract JSONB,
  -- 생성 출력 (GenerateOutput 그대로)
  output JSONB,
  -- 최종 본문 (파싱 실패면 null)
  mail TEXT,
  model TEXT NOT NULL,
  -- 생성 프롬프트 해시. 하네스 run config 의 generate.promptSha256 과 같은 방식이라 비교할 수 있다
  prompt_sha256 TEXT NOT NULL,
  -- 이번 요청에서 새로 부른 호출의 합 (재사용한 추출은 제외)
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  -- 규칙 채점 결과: { json, callback_match, form, voice, banned } 각각 { value, reason? }
  rule_scores JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'edited', 'rejected')),
  edited_mail TEXT,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES checkin_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 검토 전(draft)에만 reviewed_at 이 비어 있다
  CONSTRAINT checkin_reminder_drafts_reviewed_at_check
    CHECK ((status = 'draft') = (reviewed_at IS NULL)),
  -- 수정 승인은 수정본이 있어야 한다
  CONSTRAINT checkin_reminder_drafts_edited_mail_check
    CHECK (status <> 'edited' OR edited_mail IS NOT NULL)
);

CREATE INDEX checkin_reminder_drafts_session_member_idx
  ON checkin_reminder_drafts (session, member_id, created_at DESC);

ALTER TABLE checkin_reminder_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin read" ON checkin_reminder_drafts
  FOR SELECT TO authenticated USING (is_checkin_admin());

CREATE POLICY "Allow admin review" ON checkin_reminder_drafts
  FOR UPDATE TO authenticated USING (is_checkin_admin()) WITH CHECK (is_checkin_admin());

-- 테이블 권한도 좁힌다: 익명은 아무것도 못 하고, 로그인 사용자는 읽기와 검토 컬럼 UPDATE 만 가능
REVOKE ALL ON checkin_reminder_drafts FROM anon, authenticated;
GRANT SELECT ON checkin_reminder_drafts TO authenticated;
GRANT UPDATE (status, edited_mail, review_note, reviewed_at) ON checkin_reminder_drafts TO authenticated;
