-- checkin_vote_polls: 온라인 회의 링크/비밀번호 및 확정 시각 필드 추가
ALTER TABLE checkin_vote_polls
  ADD COLUMN confirmed_time TEXT,
  ADD COLUMN meeting_url TEXT,
  ADD COLUMN meeting_password TEXT;
