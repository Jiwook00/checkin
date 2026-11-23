-- notify_comment_dm은 내 회고의 댓글 설정으로 사용한다.
-- 기존에는 두 알림이 함께 켜지고 꺼졌으므로 참여 알림에도 같은 값을 적용한다.
ALTER TABLE public.checkin_members
  ADD COLUMN notify_comment_participant_dm BOOLEAN NOT NULL DEFAULT true;

UPDATE public.checkin_members
SET notify_comment_participant_dm = false
WHERE NOT notify_comment_dm;
