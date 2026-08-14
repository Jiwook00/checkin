-- 일정 조율에 '특정 날짜' 선택 지원
-- dates 가 NULL 이면 기존처럼 date_from ~ date_to 연속 범위를 사용하고,
-- dates 에 ["YYYY-MM-DD", ...] 목록이 있으면 해당 날짜들만 후보로 사용한다.
-- (date_from / date_to 는 목록의 최소·최대값으로 항상 채워 year/month/session 파생 로직을 유지한다.)
ALTER TABLE checkin_vote_polls
  ADD COLUMN dates JSONB;
