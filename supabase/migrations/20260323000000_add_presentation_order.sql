ALTER TABLE checkin_retrospectives
  ADD COLUMN IF NOT EXISTS presentation_order integer;
