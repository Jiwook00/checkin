-- 회고 등록 시 디스코드 알림 (이슈 #99)
--   checkin_retrospectives 에 AFTER INSERT 트리거를 건다. 직접 쓴 글·URL 글 모두 insert 한 번 = 알림 한 번이다
--   수정(글·아바타·이미지 URL 교체)은 update 라서 걸리지 않는다
--   URL 글은 parse-content 가 파싱을 마친 뒤 insert 하므로 파싱 완료를 따로 기다리지 않는다
--   SECURITY DEFINER 인 이유: 글을 쓰는 authenticated 역할은 checkin_notify_discord 를 부를 수 없어서, 소유자 권한으로 대신 부른다
--   알림이 실패해도 checkin_notify_discord 가 경고만 남기고 null 을 돌려주므로 회고 저장은 깨지지 않는다
--   메시지 내용은 SQL 에서 만들지 않는다. 회고 id 만 보내고 discord-notify 가 조회한다 (ADR 0010)

CREATE OR REPLACE FUNCTION public.checkin_notify_retro_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.checkin_notify_discord(
    jsonb_build_object('type', 'retro_uploaded', 'ref_id', NEW.id::text)
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_notify_retro_uploaded() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER checkin_retrospectives_notify_discord
  AFTER INSERT ON public.checkin_retrospectives
  FOR EACH ROW EXECUTE FUNCTION public.checkin_notify_retro_uploaded();
