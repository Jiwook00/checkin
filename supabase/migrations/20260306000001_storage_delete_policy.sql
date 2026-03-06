-- 인증된 사용자 이미지 삭제 허용 (글 삭제 시 연관 이미지 정리용)
create policy "checkin-images authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'checkin-images');
