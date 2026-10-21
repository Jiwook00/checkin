/** 본문을 뽑아낸 단계. checkin_parse_attempts.tier에 기록한다 */
export type ParseTier = "notion" | "selector" | "readability";

/** 파서 하나가 돌려주는 결과 */
export interface ParsedContent {
  title: string;
  content_html: string;
  content_markdown: string;
  tier: ParseTier;
  // 본문이 끝까지 수집되지 못했을 때만 채운다 (예: NOTION_TRUNCATED)
  quality_flags?: string[];
}
