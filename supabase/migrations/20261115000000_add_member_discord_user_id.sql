-- 멤버와 디스코드 계정 연결 (이슈 #102, ADR 0012)
--   checkin_members.discord_user_id : 디스코드 사용자 id(snowflake). DM 받는 사람(#104·#105)과
--                                     커맨드를 쓴 사람(#106)을 멤버로 찾을 때 service role로 읽는다
--
-- 연결·해제는 관리자가 SQL 편집기(postgres 롤)에서 한다. 앱에는 연결 화면이 없다.
--   update checkin_members set discord_user_id = '<디스코드 사용자 id>' where nickname = '<닉네임>';
--   update checkin_members set discord_user_id = null where nickname = '<닉네임>';
--
-- 주의: checkin_members 의 "Allow own update"는 USING 만 있고 WITH CHECK 이 없다 (is_admin 과 같은 문제, 20261030000000).
--       컬럼만 추가하면 멤버가 자기 row 에 다른 사람의 디스코드 id 를 넣어 DM 을 가로채거나 커맨드에서 그 사람으로 보일 수 있다.
--       그래서 authenticated/anon 롤은 본인 row 라도 이 값을 넣거나 바꾸지 못하게 트리거로 막는다.
--       리포가 공개라 실제 id 는 이 파일에 넣지 않는다.

ALTER TABLE checkin_members
  ADD COLUMN discord_user_id TEXT
    CONSTRAINT checkin_members_discord_user_id_key UNIQUE
    CONSTRAINT checkin_members_discord_user_id_format CHECK (discord_user_id ~ '^[0-9]{17,20}$');

-- SECURITY INVOKER(기본값)여야 current_user 가 호출한 롤로 보인다. PostgREST 는 요청마다 SET ROLE authenticated 를 한다.
-- service role(service_role)과 SQL 편집기(postgres)는 막지 않는다.
CREATE FUNCTION checkin_members_guard_discord() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.discord_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'discord_user_id 는 앱에서 지정할 수 없어요' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.discord_user_id IS DISTINCT FROM OLD.discord_user_id THEN
      RAISE EXCEPTION 'discord_user_id 는 앱에서 바꿀 수 없어요' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkin_members_guard_discord
  BEFORE INSERT OR UPDATE ON checkin_members
  FOR EACH ROW EXECUTE FUNCTION checkin_members_guard_discord();
