CREATE TABLE retrospectives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('notion', 'tistory', 'other')),
  content_html TEXT,
  content_markdown TEXT NOT NULL,
  session TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_retrospectives_session ON retrospectives(session);
CREATE INDEX idx_retrospectives_author ON retrospectives(author);

ALTER TABLE retrospectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON retrospectives FOR ALL USING (true);
