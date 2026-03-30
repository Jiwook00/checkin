create policy "checkin-images update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'checkin-images'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "checkin-images delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'checkin-images'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
