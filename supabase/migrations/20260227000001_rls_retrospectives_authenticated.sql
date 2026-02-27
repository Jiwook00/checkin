-- retrospectives RLS: 인증된 멤버만 읽기 허용
DROP POLICY IF EXISTS "Allow all access" ON retrospectives;

CREATE POLICY "Allow authenticated read" ON retrospectives
  FOR SELECT
  TO authenticated
  USING (true);
