-- checkin_vote_polls: 새 필드 추가 (type, location, date_from, date_to, time 설정)
ALTER TABLE checkin_vote_polls
  ADD COLUMN type TEXT NOT NULL DEFAULT 'online' CHECK (type IN ('online', 'offline')),
  ADD COLUMN location TEXT,
  ADD COLUMN date_from DATE,
  ADD COLUMN date_to DATE,
  ADD COLUMN time_weekday TEXT,
  ADD COLUMN time_start TEXT NOT NULL DEFAULT '10:00',
  ADD COLUMN time_end TEXT NOT NULL DEFAULT '22:00';

-- 기존 데이터 마이그레이션: year/month 로 date_from/date_to 설정 (1~10일 기본값)
UPDATE checkin_vote_polls
  SET date_from = make_date(year, month, 1),
      date_to   = make_date(year, month, 10)
  WHERE date_from IS NULL;

ALTER TABLE checkin_vote_polls
  ALTER COLUMN date_from SET NOT NULL,
  ALTER COLUMN date_to   SET NOT NULL;

-- checkin_vote_responses: mode 컬럼 제거
-- (새 스키마에서는 모두 '가능' 날짜만 selected_dates에 저장)
ALTER TABLE checkin_vote_responses DROP COLUMN mode;

-- poll 생성 · 업데이트 RLS 정책 추가
CREATE POLICY "authenticated create polls" ON checkin_vote_polls
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update polls" ON checkin_vote_polls
  FOR UPDATE TO authenticated USING (true);
