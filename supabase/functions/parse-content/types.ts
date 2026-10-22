/** 본문을 뽑아낸 단계. checkin_parse_attempts.tier에 기록한다 */
export type ParseTier =
  | "notion"
  | "selector"
  | "readability"
  // 저장된 도메인 규칙(checkin_parse_rules)으로 추출
  | "domain_rule"
  | "llm";

/** 추출 품질 플래그. quality.ts가 판정하고 checkin_parse_attempts.quality_flags에 기록한다 */
export type QualityFlag =
  | "low_text"
  | "boilerplate"
  | "high_link_density"
  | "notion_truncated";

/** 파서 하나가 돌려주는 결과 */
export interface ParsedContent {
  title: string;
  content_html: string;
  content_markdown: string;
  tier: ParseTier;
  // 파서가 이미 아는 결함만 채운다 (예: notion_truncated). 나머지는 quality.ts가 판정한다
  quality_flags?: QualityFlag[];
}
