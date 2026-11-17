-- 회고 댓글 디스코드 DM 알림 (이슈 #105)
--   checkin_members.notify_comment_dm : 내 글에 달린 댓글을 DM으로 받을지. 기본 켜짐. 본인이 프로필에서 바꾼다
--                                       (기존 "Allow own update" 정책 그대로. 본인 설정이라 트리거로 막지 않는다)
--   checkin_comments 에 AFTER INSERT 트리거를 건다. 댓글 insert 한 번 = 이벤트 한 번이고, 수정(update)은 걸리지 않는다
--   본인 댓글·디스코드 미연결·알림 끔은 discord-notify 가 판단해서 건너뛴다. SQL 에서는 댓글 id 만 보낸다 (ADR 0010)
--   SECURITY DEFINER 인 이유: 댓글을 쓰는 authenticated 역할은 checkin_notify_discord 를 부를 수 없어서, 소유자 권한으로 대신 부른다
--   알림이 실패해도 checkin_notify_discord 가 경고만 남기고 null 을 돌려주므로 댓글 저장은 깨지지 않는다

ALTER TABLE public.checkin_members
  ADD COLUMN notify_comment_dm BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.checkin_notify_comment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.checkin_notify_discord(
    jsonb_build_object('type', 'comment_created', 'ref_id', NEW.id::text)
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_notify_comment_created() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER checkin_comments_notify_discord
  AFTER INSERT ON public.checkin_comments
  FOR EACH ROW EXECUTE FUNCTION public.checkin_notify_comment_created();
