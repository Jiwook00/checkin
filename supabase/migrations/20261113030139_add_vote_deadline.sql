-- 투표 마감일 (이슈 #100)
--   vote_deadline : 투표를 받는 마지막 날(이 날까지 포함). 비워두면 마감 하루 전 디스코드 공지를 보내지 않는다
--   실제 마감은 여전히 관리자가 확정하는 시점이다. 이 값은 안내·공지용이고 투표를 막지 않는다

ALTER TABLE checkin_vote_polls
  ADD COLUMN vote_deadline DATE;
