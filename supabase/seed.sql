-- 로컬 개발용 시드 (#130). `supabase start` / `supabase db reset` 때만 적용된다. 운영에는 쓰지 않는다.
-- 모든 계정의 비밀번호: checkin-local
-- 로컬 vault에는 디스코드 시크릿이 없어서, 아래 insert가 부르는 알림 트리거는 경고만 남기고 보내지 않는다.

-- 멤버 ---------------------------------------------------------------------

with seed(id, email, nickname, is_admin) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@checkin.local', '관리자', true),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'minji@checkin.local', '민지', false),
    ('00000000-0000-4000-a000-000000000003'::uuid, 'junho@checkin.local', '준호', false),
    ('00000000-0000-4000-a000-000000000004'::uuid, 'seoyeon@checkin.local', '서연', false)
),
users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    crypt('checkin-local', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', nickname), now(), now(),
    '', '', '', ''
  from seed
  returning id, email
),
identities as (
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text, 'email',
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
  from users
  returning user_id
),
allowed as (
  insert into public.checkin_allowed_members (email, nickname)
  select email, nickname from seed
  returning email
)
insert into public.checkin_members (id, email, nickname, is_admin)
select id, email, nickname, is_admin from seed;

-- 회고 글 -------------------------------------------------------------------

insert into public.checkin_retrospectives
  (id, member_id, title, source_type, content_type, content_markdown, session, presentation_order, created_at)
values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002',
   '10월 회고: 사이드 프로젝트를 다시 시작했다', 'other', 'written',
   E'## 잘한 것\n\n- 매일 30분씩 커밋했다\n\n## 아쉬운 것\n\n- 문서를 거의 못 썼다\n\n## 다음 달\n\n- 배포까지 가 보기',
   '2026-10', 1, now() - interval '30 days'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000003',
   '10월 회고: 이직 준비 한 달', 'other', 'written',
   E'## 한 일\n\n- 이력서 정리\n- 면접 두 번\n\n## 느낀 점\n\n말로 설명하는 연습이 생각보다 중요했다.',
   '2026-10', 2, now() - interval '29 days'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000002',
   '11월 회고: 배포까지 갔다', 'other', 'written',
   E'## 한 일\n\n- 첫 배포\n- 피드백 세 건 반영\n\n## 다음 달\n\n- 테스트 붙이기',
   '2026-11', 1, now() - interval '2 days'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000004',
   '11월 회고: 읽은 책 정리', 'other', 'written',
   E'## 읽은 책\n\n- 데이터 중심 애플리케이션 설계 (절반)\n\n## 메모\n\n복제 지연 챕터가 제일 재밌었다.',
   '2026-11', 2, now() - interval '1 day');

-- 댓글과 반응 ---------------------------------------------------------------

insert into public.checkin_comments (id, retrospective_id, member_id, body, created_at, updated_at)
values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000003',
   '00000000-0000-4000-a000-000000000003', '배포 축하해요! 어떤 피드백이 제일 기억에 남았어요?',
   now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000003',
   '00000000-0000-4000-a000-000000000002', '로그인 버튼이 안 보인다는 거였어요 ㅎㅎ',
   now() - interval '20 hours', now() - interval '20 hours'),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000004',
   '00000000-0000-4000-a000-000000000001', '저도 그 책 읽다 멈췄는데 같이 읽어요.',
   now() - interval '10 hours', now() - interval '10 hours');

insert into public.checkin_reactions (target_type, target_id, member_id, emoji)
values
  ('retrospective', '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000003', '👏'),
  ('retrospective', '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000004', '👏'),
  ('comment', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000002', '❤️');

-- 공통 질문, 공지 -----------------------------------------------------------

insert into public.checkin_session_questions (session, question, status, created_by, approved_at)
values
  ('2026-11', '이번 달 가장 오래 붙잡고 있던 문제는 무엇이었나요?', 'approved',
   '00000000-0000-4000-a000-000000000001', now());

insert into public.checkin_announcements (content, created_by)
values ('로컬 시드 공지입니다. 운영 데이터가 아니에요.', '00000000-0000-4000-a000-000000000001');

-- 일정 투표 (열린 투표 1개 + 응답 2개) -------------------------------------

insert into public.checkin_vote_polls
  (id, session, year, month, status, type, date_from, date_to, dates, time_weekday, vote_deadline)
values
  ('00000000-0000-4000-d000-000000000001', '2026-12', 2026, 12, 'open', 'online',
   '2026-12-05', '2026-12-13', '["2026-12-05", "2026-12-09", "2026-12-13"]', '21:00', '2026-12-03');

insert into public.checkin_vote_responses (poll_id, member_id, selected_dates)
values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-a000-000000000002',
   '[{"date": 5, "hours": [14, 15]}, {"date": 9, "hours": [21]}]'),
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-a000-000000000003',
   '[{"date": 9, "hours": [21]}, {"date": 13, "hours": [20]}]');
