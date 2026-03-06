-- checkin-images 버킷 생성 (public 읽기)
insert into storage.buckets (id, name, public)
values ('checkin-images', 'checkin-images', true)
on conflict do nothing;

-- 인증된 사용자 업로드 허용
create policy "checkin-images authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'checkin-images');

-- 모든 사용자 공개 읽기 허용
create policy "checkin-images public read"
  on storage.objects for select
  to public
  using (bucket_id = 'checkin-images');
