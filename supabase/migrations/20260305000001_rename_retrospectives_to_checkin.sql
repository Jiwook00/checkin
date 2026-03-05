-- retrospectives 테이블을 checkin_ 프리픽스 컨벤션에 맞게 이름 변경
ALTER TABLE retrospectives RENAME TO checkin_retrospectives;

ALTER INDEX idx_retrospectives_session RENAME TO idx_checkin_retrospectives_session;
ALTER INDEX idx_retrospectives_member_id RENAME TO idx_checkin_retrospectives_member_id;
