-- 허용 멤버 화이트리스트
CREATE TABLE checkin_allowed_members (
  email    TEXT PRIMARY KEY,
  nickname TEXT NOT NULL
);

INSERT INTO checkin_allowed_members (email, nickname) VALUES
  ('iris3455@gmail.com',    '아이리스'),
  ('siamore9724@gmail.com', '로니'),
  ('jwkim775@gmail.com',    '대니'),
  ('dltjstnl7@gmail.com',   '두도'),
  ('whguswi0408@gmail.com', '벨라'),
  ('won0539@gmail.com',     '원');

ALTER TABLE checkin_allowed_members ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 화이트리스트 전체 조회 가능 (이메일 검증에 사용)
CREATE POLICY "Allow authenticated select" ON checkin_allowed_members
  FOR SELECT
  TO authenticated
  USING (true);

-- 앱 유저 프로필 (auth.users 와 1:1 대응)
CREATE TABLE checkin_members (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  nickname   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE checkin_members ENABLE ROW LEVEL SECURITY;

-- 본인 row만 조회 가능
CREATE POLICY "Allow own select" ON checkin_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 본인 row만 삽입/갱신 가능
CREATE POLICY "Allow own upsert" ON checkin_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow own update" ON checkin_members
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
