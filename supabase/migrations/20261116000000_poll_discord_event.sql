-- 확정한 일정의 디스코드 서버 이벤트 (이슈 #103, ADR 0013)
--   poll 하나에 이벤트 하나. discord-notify 가 poll 을 읽고 "있어야 할 상태"로 맞춘다(동기화)
--     confirmed 이고 시작이 미래 → 이벤트를 만들거나 고친다 / 그 밖 → 지운다
--   트리거는 poll id 만 보낸다. 호출 순서가 뒤바뀌어도 함수가 매번 최신 poll 을 읽으므로 마지막 호출이 맞춘다
--
--   discord_event_id        : 봇이 만든 Scheduled Event id
--   discord_event_error     : 마지막 동기화가 실패한 이유 코드 (http_403, missing_channel …). 성공하면 null
--   discord_event_synced_at : 마지막 동기화 시각. 관리자 화면이 "대기 중"과 결과를 구분하는 데 쓴다
--
--   주의: "authenticated update polls" 정책이 USING (true) 라서 멤버가 이 컬럼을 덮어쓸 수 있다.
--         그러면 봇이 엉뚱한 이벤트를 고치거나 지울 수 있으므로 앱 롤의 변경을 트리거로 막는다 (is_admin 가드와 같은 방식)

ALTER TABLE checkin_vote_polls
  ADD COLUMN discord_event_id TEXT,
  ADD COLUMN discord_event_error TEXT,
  ADD COLUMN discord_event_synced_at TIMESTAMPTZ;

-- SECURITY INVOKER(기본값)여야 current_user 가 호출한 롤로 보인다. service_role(discord-notify)과 postgres(SQL 편집기)는 막지 않는다
CREATE FUNCTION public.checkin_vote_polls_guard_discord_event() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND (
      NEW.discord_event_id IS NOT NULL
      OR NEW.discord_event_error IS NOT NULL
      OR NEW.discord_event_synced_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'discord_event_* 는 앱에서 지정할 수 없어요' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.discord_event_id IS DISTINCT FROM OLD.discord_event_id
      OR NEW.discord_event_error IS DISTINCT FROM OLD.discord_event_error
      OR NEW.discord_event_synced_at IS DISTINCT FROM OLD.discord_event_synced_at
    ) THEN
      RAISE EXCEPTION 'discord_event_* 는 앱에서 바꿀 수 없어요' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkin_vote_polls_guard_discord_event
  BEFORE INSERT OR UPDATE ON public.checkin_vote_polls
  FOR EACH ROW EXECUTE FUNCTION public.checkin_vote_polls_guard_discord_event();

-- 동기화 요청. SECURITY DEFINER 인 이유는 notify_vote 와 같다 (authenticated 는 checkin_notify_discord 를 못 부른다)
-- 알림이 실패해도 checkin_notify_discord 가 경고만 남기므로 확정·수정은 깨지지 않는다
CREATE FUNCTION public.checkin_notify_poll_event_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.checkin_notify_discord(
    jsonb_build_object('type', 'poll_event_sync', 'ref_id', NEW.id::text)
  );
  RETURN NULL;
END;
$$;

-- 행이 지워지면 함수가 poll 을 읽을 수 없으므로 이벤트 id 를 같이 보낸다
CREATE FUNCTION public.checkin_notify_poll_event_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.checkin_notify_discord(
    jsonb_build_object(
      'type', 'poll_event_delete',
      'ref_id', OLD.id::text,
      'event_id', OLD.discord_event_id
    )
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_notify_poll_event_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkin_notify_poll_event_delete() FROM PUBLIC, anon, authenticated;

-- 확정, 확정 일시 변경(SQL), 장소·방식 변경, 다음 투표 생성 시의 closed 전환이 걸린다
-- 확정과 상관없는 변경(투표 중 장소 수정 등)은 부르지 않는다. confirmed 에서 벗어날 때는 이벤트가 아직 저장 전일 수 있어 id 와 상관없이 부른다
CREATE TRIGGER checkin_vote_polls_sync_discord_event
  AFTER UPDATE OF status, confirmed_date, confirmed_time, location, type
  ON public.checkin_vote_polls
  FOR EACH ROW
  WHEN (
    (NEW.status = 'confirmed' OR OLD.status = 'confirmed' OR NEW.discord_event_id IS NOT NULL)
    AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.confirmed_date IS DISTINCT FROM OLD.confirmed_date
      OR NEW.confirmed_time IS DISTINCT FROM OLD.confirmed_time
      OR NEW.location IS DISTINCT FROM OLD.location
      OR NEW.type IS DISTINCT FROM OLD.type
    )
  )
  EXECUTE FUNCTION public.checkin_notify_poll_event_sync();

CREATE TRIGGER checkin_vote_polls_delete_discord_event
  AFTER DELETE ON public.checkin_vote_polls
  FOR EACH ROW
  WHEN (OLD.discord_event_id IS NOT NULL)
  EXECUTE FUNCTION public.checkin_notify_poll_event_delete();

-- 이벤트 설명의 발표 순서를 회고 등록·삭제에 맞춘다
--   회고 session(YYYY-MM)의 다음 달이 그 모임의 poll session 이다 ("11월에 하는 10월 회고")
--   형식이 맞지 않는 session 은 건너뛴다. 여기서 예외가 나면 회고 저장이 깨진다
CREATE FUNCTION public.checkin_notify_retro_poll_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session text := CASE WHEN TG_OP = 'DELETE' THEN OLD.session ELSE NEW.session END;
  v_poll_id uuid;
BEGIN
  IF v_session IS NULL OR v_session !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RETURN NULL;
  END IF;

  FOR v_poll_id IN
    SELECT id FROM public.checkin_vote_polls
    WHERE status = 'confirmed'
      AND session = to_char((v_session || '-01')::date + interval '1 month', 'YYYY-MM')
  LOOP
    PERFORM public.checkin_notify_discord(
      jsonb_build_object('type', 'poll_event_sync', 'ref_id', v_poll_id::text)
    );
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_notify_retro_poll_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER checkin_retrospectives_sync_discord_event
  AFTER INSERT OR DELETE ON public.checkin_retrospectives
  FOR EACH ROW EXECUTE FUNCTION public.checkin_notify_retro_poll_event();

-- 관리자의 "다시 시도". 실패했거나 이 기능 전에 확정한 poll 의 이벤트를 맞춘다
-- 요청을 큐에 넣었으면 true. Vault 값이 없는 등으로 못 넣었으면 false
CREATE FUNCTION public.checkin_sync_discord_event(p_poll_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_checkin_admin() THEN
    RAISE EXCEPTION '관리자만 할 수 있어요' USING ERRCODE = '42501';
  END IF;
  RETURN public.checkin_notify_discord(
    jsonb_build_object('type', 'poll_event_sync', 'ref_id', p_poll_id::text)
  ) IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_sync_discord_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkin_sync_discord_event(uuid) TO authenticated;
