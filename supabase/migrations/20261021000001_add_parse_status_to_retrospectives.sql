-- 회고 글의 파싱 결과 상태 (이슈 #54)
--   null : 직접 쓴 글 (파싱 대상 아님)
--   ok / degraded / failed : URL 글의 최종 파싱 결과

ALTER TABLE checkin_retrospectives
  ADD COLUMN parse_status TEXT
  CHECK (parse_status IN ('ok', 'degraded', 'failed'));

-- 기존 행 채우기: 직접 쓴 글은 null 유지
UPDATE checkin_retrospectives
SET parse_status = CASE
  WHEN content_markdown IS NULL OR btrim(content_markdown) = '' THEN 'failed'
  ELSE 'ok'
END
WHERE content_type = 'url';
