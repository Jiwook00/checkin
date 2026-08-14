-- 글별 참여 신호 집계 뷰 (이슈 #50 phase-2)
--   목록 카드/상세 상단에서 반응·댓글 수를 미리 보여주기 위한 읽기 전용 뷰.
--   reaction_count / reaction_emojis 는 "글에 직접 달린 반응"만 집계(댓글 반응 제외).
CREATE VIEW checkin_retrospective_engagement
WITH (security_invoker = on) AS
SELECT
  r.id AS retrospective_id,
  COALESCE(c.comment_count, 0) AS comment_count,
  COALESCE(x.reaction_count, 0) AS reaction_count,
  COALESCE(x.reaction_emojis, ARRAY[]::text[]) AS reaction_emojis
FROM checkin_retrospectives r
LEFT JOIN (
  SELECT retrospective_id, COUNT(*) AS comment_count
  FROM checkin_comments
  GROUP BY retrospective_id
) c ON c.retrospective_id = r.id
LEFT JOIN (
  SELECT
    target_id,
    SUM(cnt) AS reaction_count,
    -- 많이 눌린 이모지 순으로 최대 3개
    (ARRAY_AGG(emoji ORDER BY cnt DESC, emoji))[1:3] AS reaction_emojis
  FROM (
    SELECT target_id, emoji, COUNT(*) AS cnt
    FROM checkin_reactions
    WHERE target_type = 'retrospective'
    GROUP BY target_id, emoji
  ) per_emoji
  GROUP BY target_id
) x ON x.target_id = r.id;

GRANT SELECT ON checkin_retrospective_engagement TO authenticated;
