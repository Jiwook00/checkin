-- retrospectives: author 컬럼 제거, member_id (FK → checkin_members) 추가
TRUNCATE TABLE retrospectives;

ALTER TABLE retrospectives DROP COLUMN author;
ALTER TABLE retrospectives ADD COLUMN member_id UUID NOT NULL REFERENCES checkin_members(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_retrospectives_author;
CREATE INDEX idx_retrospectives_member_id ON retrospectives(member_id);

-- INSERT/UPDATE/DELETE RLS 정책 추가
CREATE POLICY "Allow own insert" ON retrospectives
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Allow own update" ON retrospectives
  FOR UPDATE TO authenticated
  USING (auth.uid() = member_id);

CREATE POLICY "Allow own delete" ON retrospectives
  FOR DELETE TO authenticated
  USING (auth.uid() = member_id);

-- checkin_members: 모든 인증 유저가 전체 목록 조회 가능하도록 변경
-- (회고글 JOIN 시 다른 멤버의 닉네임 조회에 필요)
DROP POLICY IF EXISTS "Allow own select" ON checkin_members;

CREATE POLICY "Allow authenticated read" ON checkin_members
  FOR SELECT TO authenticated
  USING (true);
