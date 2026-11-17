-- 기여 커맨드 실행 기록 (이슈 #133, ADR 0015)
--   checkin_contributor_grants : 디스코드 /기여 한 번 실행 = 1행. 누가(member_id) 어떤 GitHub 아이디로 불러서 결과가 어땠는지
--   누구나 다른 사람의 GitHub 아이디도 초대할 수 있어서, 사후 추적이 이 기록의 목적이다
--   github_error / role_error 에는 코드(user_not_found, http_403 …)만 남기고 토큰·응답 본문·예외 메시지는 쓰지 않는다
--   디스코드 사용자 id, interaction id·token 은 저장하지 않는다 (멤버 id 로 충분하다)
--   쓰기: 정책이 없다 = service role(Edge Function discord-interactions) 전용. 관리자는 읽기만 한다

CREATE TABLE checkin_contributor_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES checkin_members(id) ON DELETE CASCADE,
  github_login TEXT NOT NULL,
  github_status TEXT NOT NULL CHECK (github_status IN ('invited', 'already_invited', 'already_collaborator', 'failed')),
  github_error TEXT,
  role_status TEXT NOT NULL CHECK (role_status IN ('granted', 'already_had', 'failed')),
  role_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checkin_contributor_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin read" ON checkin_contributor_grants
  FOR SELECT TO authenticated USING (is_checkin_admin());

CREATE INDEX checkin_contributor_grants_member_created_idx
  ON checkin_contributor_grants (member_id, created_at DESC);
