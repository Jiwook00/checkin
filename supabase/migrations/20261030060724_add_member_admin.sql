-- 관리자 권한과 공통 질문 쓰기 정책 (이슈 #79)
--   checkin_members.is_admin : 관리자 여부. 관리자 화면(/admin/reminders)과 RLS가 함께 쓴다
--   is_checkin_admin()       : 호출자가 관리자인지. 앱 라우트 가드와 RLS, Edge Function이 같은 함수를 부른다
--
-- 주의: checkin_members 에는 "Allow own update"(USING 만 있고 WITH CHECK 없음)와 "Allow own upsert" 정책이 있어서,
--       컬럼만 추가하면 멤버가 자기 row 의 is_admin 을 직접 true 로 올릴 수 있다 (ProfilePage 가 실제로 자기 row 를 update 한다).
--       그래서 authenticated/anon 롤이 is_admin 을 켜거나 바꾸는 것을 트리거로 막는다.
--       최초 관리자는 이 마이그레이션 밖에서 service role/SQL 편집기로 한 번 지정한다 (리포가 공개라 신원을 넣지 않는다).

ALTER TABLE checkin_members
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- SECURITY INVOKER(기본값)여야 current_user 가 호출한 롤로 보인다. PostgREST 는 요청마다 SET ROLE authenticated 를 한다.
-- service role(service_role)과 SQL 편집기(postgres)는 막지 않는다.
CREATE FUNCTION checkin_members_guard_admin() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.is_admin THEN
      RAISE EXCEPTION 'is_admin 은 앱에서 지정할 수 없어요' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'is_admin 은 앱에서 바꿀 수 없어요' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkin_members_guard_admin
  BEFORE INSERT OR UPDATE ON checkin_members
  FOR EACH ROW EXECUTE FUNCTION checkin_members_guard_admin();

-- RLS 를 우회해서 본인 row 의 is_admin 만 읽는다. search_path 를 고정해 함수 바꿔치기를 막는다
CREATE FUNCTION is_checkin_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM checkin_members WHERE id = auth.uid()), false)
$$;

REVOKE EXECUTE ON FUNCTION is_checkin_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_checkin_admin() TO authenticated;

-- 공통 질문: 관리자는 proposed 까지 모두 읽고, 질문을 등록·승인할 수 있다 (DELETE 정책 없음)
-- 멤버의 approved 읽기 정책("Allow authenticated read approved")은 그대로 둔다
CREATE POLICY "Allow admin read all" ON checkin_session_questions
  FOR SELECT TO authenticated USING (is_checkin_admin());

CREATE POLICY "Allow admin insert" ON checkin_session_questions
  FOR INSERT TO authenticated WITH CHECK (is_checkin_admin());

CREATE POLICY "Allow admin update" ON checkin_session_questions
  FOR UPDATE TO authenticated USING (is_checkin_admin()) WITH CHECK (is_checkin_admin());
