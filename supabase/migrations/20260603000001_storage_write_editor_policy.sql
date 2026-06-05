-- write-editor 경로 이미지 삭제 허용 (본인 이미지만)
-- 경로 구조: write-editor/{member_id}/{uuid}.{ext}
create policy "checkin-images delete own write-editor images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'checkin-images'
    and (storage.foldername(name))[1] = 'write-editor'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
