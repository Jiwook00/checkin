ALTER TABLE checkin_retrospectives
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'url'
    CHECK (content_type IN ('url', 'written'));

ALTER TABLE checkin_retrospectives
  ALTER COLUMN source_url DROP NOT NULL;
