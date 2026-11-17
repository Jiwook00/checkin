-- 일정 투표 디스코드 공지 (이슈 #100)
--   세 시점 모두 poll id 만 보내고 메시지는 discord-notify 가 만든다 (ADR 0010). ref_id = poll id 라서 시점마다 한 번만 나간다
--
--   vote_opened        : checkin_vote_polls AFTER INSERT (status = open). 투표를 지우고 다시 만들면 새 id 라 다시 나간다
--   vote_confirmed     : status 가 confirmed 로 바뀔 때. 다음 투표 생성 시의 closed 전환은 걸리지 않는다
--   vote_deadline_soon : pg_cron 이 매일 10:00 KST 에 "내일이 vote_deadline 인 open 투표"를 찾아 부른다
--                        남은 인원이 0이면 함수가 건너뛴다. 오늘 10시가 지난 뒤 마감일을 내일로 정하면 공지는 나가지 않는다
--
--   SECURITY DEFINER 인 이유: 투표를 만들고 확정하는 authenticated 역할은 checkin_notify_discord 를 부를 수 없다
--   알림이 실패해도 checkin_notify_discord 가 경고만 남기고 null 을 돌려주므로 투표 저장은 깨지지 않는다

CREATE OR REPLACE FUNCTION public.checkin_notify_vote_opened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.checkin_notify_discord(
    jsonb_build_object('type', 'vote_opened', 'ref_id', NEW.id::text)
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkin_notify_vote_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.checkin_notify_discord(
    jsonb_build_object('type', 'vote_confirmed', 'ref_id', NEW.id::text)
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_notify_vote_opened() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkin_notify_vote_confirmed() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER checkin_vote_polls_notify_opened
  AFTER INSERT ON public.checkin_vote_polls
  FOR EACH ROW
  WHEN (NEW.status = 'open')
  EXECUTE FUNCTION public.checkin_notify_vote_opened();

CREATE TRIGGER checkin_vote_polls_notify_confirmed
  AFTER UPDATE OF status ON public.checkin_vote_polls
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed')
  EXECUTE FUNCTION public.checkin_notify_vote_confirmed();

-- 마감 전날 공지. 날짜는 KST 기준이다
CREATE OR REPLACE FUNCTION public.checkin_notify_vote_deadline_soon()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_poll_id uuid;
BEGIN
  FOR v_poll_id IN
    SELECT id FROM public.checkin_vote_polls
    WHERE status = 'open'
      AND vote_deadline = (now() AT TIME ZONE 'Asia/Seoul')::date + 1
  LOOP
    PERFORM public.checkin_notify_discord(
      jsonb_build_object('type', 'vote_deadline_soon', 'ref_id', v_poll_id::text)
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_notify_vote_deadline_soon() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 01:00 UTC = 10:00 KST
SELECT cron.schedule(
  'checkin-vote-deadline-soon',
  '0 1 * * *',
  'SELECT public.checkin_notify_vote_deadline_soon()'
);
