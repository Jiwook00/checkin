-- checkin_vote_responses: 불참 필드 추가
ALTER TABLE checkin_vote_responses
  ADD COLUMN cannot_attend BOOLEAN NOT NULL DEFAULT false;
