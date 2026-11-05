-- DB에서 디스코드 알림 호출 (이슈 #98)
--   checkin_notify_discord(payload) : Edge Function discord-notify 를 pg_net 으로 비동기 호출한다. 트리거(#99)·pg_cron(#100)이 부른다
--   함수 URL 과 공유 비밀은 Vault(discord_notify_url, discord_notify_secret)에서 읽는다. 마이그레이션·코드에는 두지 않는다
--   Vault 값이 없거나 호출이 실패해도 경고만 남기고 null 을 돌려준다. 트리거에서 불렀을 때 원래 트랜잭션(회고 저장 등)을 깨지 않으려는 것이다
--   경고에 SQLERRM 을 쓰지 않는다 (URL·비밀이 로그에 남지 않게)
--   호출 권한: 클라이언트 역할(anon·authenticated)은 막는다. 트리거·cron 은 소유자 권한으로 돈다

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.checkin_notify_discord(payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'discord_notify_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'discord_notify_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'discord_notify: vault 에 discord_notify_url / discord_notify_secret 이 없습니다';
    RETURN NULL;
  END IF;

  RETURN net.http_post(
    url := v_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', v_secret
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'discord_notify: 요청을 보내지 못했습니다';
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_notify_discord(jsonb) FROM PUBLIC, anon, authenticated;
