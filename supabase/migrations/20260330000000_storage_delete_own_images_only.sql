-- Storage 삭제 정책: 본인이 업로드한 이미지만 삭제 가능하도록 강화
-- 기존 정책은 인증된 모든 유저가 타인 이미지도 삭제할 수 있어 교체
drop policy if exists "checkin-images authenticated delete" on storage.objects;

-- path 구조: images/{user_id}/{filename}
-- 경로의 두 번째 세그먼트(owner user_id)가 본인 uid와 일치해야 삭제 가능
create policy "checkin-images delete own images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'checkin-images'
    and (storage.foldername(name))[1] = 'images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
