-- 회고 글·댓글 반응 기능 (이슈 #50)
--   checkin_comments  : 글에 다는 댓글 (flat, 대댓글 없음)
--   checkin_reactions : 글·댓글에 다는 이모지 반응 (polymorphic)

-- ============================================================
-- 댓글
-- ============================================================
CREATE TABLE checkin_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retrospective_id UUID NOT NULL REFERENCES checkin_retrospectives(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES checkin_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkin_comments_retrospective_id ON checkin_comments(retrospective_id);

ALTER TABLE checkin_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON checkin_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow own insert" ON checkin_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Allow own update" ON checkin_comments
  FOR UPDATE TO authenticated USING (auth.uid() = member_id);

CREATE POLICY "Allow own delete" ON checkin_comments
  FOR DELETE TO authenticated USING (auth.uid() = member_id);

-- ============================================================
-- 반응 (polymorphic: 글 + 댓글)
-- ============================================================
CREATE TABLE checkin_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('retrospective', 'comment')),
  target_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES checkin_members(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 같은 대상에 같은 이모지 중복만 차단 (다른 이모지는 여러 개 허용)
  UNIQUE (target_type, target_id, member_id, emoji)
);

CREATE INDEX idx_checkin_reactions_target ON checkin_reactions(target_type, target_id);

ALTER TABLE checkin_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON checkin_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow own insert" ON checkin_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);

-- 반응은 toggle(추가/삭제)만 — update 정책 없음
CREATE POLICY "Allow own delete" ON checkin_reactions
  FOR DELETE TO authenticated USING (auth.uid() = member_id);

-- ============================================================
-- orphan 반응 청소 트리거
--   polymorphic이라 target_id에 FK가 없어 cascade가 안 걸린다.
--   글/댓글 삭제 시 해당 반응을 직접 지운다.
-- ============================================================

-- 글 삭제 시: 글 반응 + (곧 cascade로 지워질) 하위 댓글들의 반응까지 선제 삭제
CREATE OR REPLACE FUNCTION cleanup_reactions_for_retrospective()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM checkin_reactions
  WHERE (target_type = 'retrospective' AND target_id = OLD.id)
     OR (target_type = 'comment'
         AND target_id IN (
           SELECT id FROM checkin_comments WHERE retrospective_id = OLD.id
         ));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_reactions_retrospective
BEFORE DELETE ON checkin_retrospectives
FOR EACH ROW EXECUTE FUNCTION cleanup_reactions_for_retrospective();

-- 댓글 직접 삭제 시: 그 댓글의 반응 삭제
CREATE OR REPLACE FUNCTION cleanup_reactions_for_comment()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM checkin_reactions
  WHERE target_type = 'comment' AND target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_reactions_comment
BEFORE DELETE ON checkin_comments
FOR EACH ROW EXECUTE FUNCTION cleanup_reactions_for_comment();
