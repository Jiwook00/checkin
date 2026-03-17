create table checkin_announcements (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  is_active boolean not null default true,
  created_by uuid not null references checkin_members(id),
  created_at timestamptz not null default now()
);

-- 활성 공지는 최대 1개: 새 공지 등록 시 기존 활성 공지 자동 비활성화 트리거
create or replace function deactivate_previous_announcements()
returns trigger as $$
begin
  update checkin_announcements
  set is_active = false
  where is_active = true and id != new.id;
  return new;
end;
$$ language plpgsql;

create trigger trg_deactivate_previous_announcements
after insert on checkin_announcements
for each row
when (new.is_active = true)
execute function deactivate_previous_announcements();

-- RLS
alter table checkin_announcements enable row level security;

-- 모든 멤버가 조회 가능
create policy "members can read announcements"
on checkin_announcements for select
to authenticated
using (true);

-- 모든 멤버가 등록 가능 (created_by는 자신의 id)
create policy "members can insert announcements"
on checkin_announcements for insert
to authenticated
with check (created_by = auth.uid());

-- 자신이 등록한 공지 또는 모든 멤버가 해제(is_active = false) 가능
create policy "members can deactivate announcements"
on checkin_announcements for update
to authenticated
using (true)
with check (is_active = false);
