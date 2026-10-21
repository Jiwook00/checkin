import type { ParseTier, QualityFlag } from "./types.ts";

// 판정 기준의 단일 위치. 프로덕션 파이프라인과 벤치 하네스가 같은 값을 쓴다

/** 이보다 짧고 이미지도 없으면 본문을 못 가져온 것으로 본다 */
export const MIN_TEXT_CHARS = 200;
/** 링크 텍스트 비율이 이보다 크면 링크 모음으로 본다 (약한 신호) */
export const LINK_DENSITY_MAX = 0.5;
/** 보일러플레이트 줄이 이 개수 이상이면 오염으로 본다 */
export const BOILERPLATE_MIN_LINES = 2;
/** 이 길이 이하의 단독 줄만 보일러플레이트 후보로 본다. 본문 문장 속 단어("댓글 알바")는 길다 */
export const BOILERPLATE_LINE_MAX = 30;
export const BOILERPLATE_PATTERNS: RegExp[] = [
  /^\d+개의 댓글$/,
  /^댓글( 작성| 보기| \d+)?$/,
  /(최근|인기)(댓글|글)$/,
  /구독하기$/,
  /^카테고리(의 다른 글)?$/,
  /^Powered by/,
  /^(공감|관련글)$/,
];

/** 플래그별 벌점. score = 1 - 합계 */
export const PENALTY: Record<QualityFlag, number> = {
  low_text: 0.5,
  boilerplate: 0.5,
  notion_truncated: 0.5,
  high_link_density: 0.3,
};
/** score가 이 값 미만이면 degraded */
export const DEGRADED_BELOW = 0.6;

export interface QualityAssessment {
  score: number;
  flags: QualityFlag[];
  /** toPlain 기준 글자 수. checkin_parse_attempts.content_chars에 기록한다 */
  plain_chars: number;
}

/** 마크다운 문법을 걷어내고 공백을 하나로 접은 평문. 글자 수와 문장 포함 비교에 쓴다 */
export function toPlain(md: string): string {
  return md
    .replace(/```[^\n]*\n/g, "")
    .replace(/```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")
    .replace(/(\*\*|__|~~|\*|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `![alt](src)` 개수. 인라인 아바타 같은 data: URI는 본문 이미지가 아니므로 세지 않는다 */
export function countImages(md: string): number {
  let n = 0;
  for (const m of md.matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)) {
    if (!m[1].trim().startsWith("data:")) n++;
  }
  return n;
}

/** 줄 단위로 평문화했을 때 짧고 보일러플레이트 패턴에 맞는 줄 */
export function boilerplateLines(md: string): string[] {
  const hits: string[] = [];
  for (const line of md.split("\n")) {
    const plain = toPlain(line);
    if (
      plain.length > 0 &&
      plain.length <= BOILERPLATE_LINE_MAX &&
      BOILERPLATE_PATTERNS.some((p) => p.test(plain))
    ) {
      hits.push(plain);
    }
  }
  return hits;
}

/** 이미지를 뺀 링크 텍스트 길이 / 평문 길이. 평문이 비면 0 */
export function linkDensity(md: string): number {
  const plainLen = toPlain(md).length;
  if (plainLen === 0) return 0;
  let linkChars = 0;
  for (const m of md.matchAll(/(?<!!)\[([^\]]*)\]\([^)]*\)/g)) {
    linkChars += toPlain(m[1]).length;
  }
  return linkChars / plainLen;
}

/** 텍스트도 이미지도 없는 결과. 성공으로 저장하면 조용한 실패가 된다 */
export function isEmptyContent(md: string): boolean {
  return toPlain(md).length === 0 && countImages(md) === 0;
}

export function isDegraded(score: number): boolean {
  return score < DEGRADED_BELOW;
}

/**
 * 추출 결과의 품질을 0~1 점수와 플래그로 판정한다. 순수 함수.
 * flags에는 파서가 이미 알고 있는 플래그(예: notion_truncated)를 넘긴다.
 */
export function assessQuality(input: {
  markdown: string;
  tier: ParseTier;
  flags?: QualityFlag[];
}): QualityAssessment {
  const { markdown } = input;
  const plainChars = toPlain(markdown).length;
  const flags = new Set<QualityFlag>(input.flags ?? []);

  if (plainChars < MIN_TEXT_CHARS && countImages(markdown) === 0) {
    flags.add("low_text");
  }
  if (boilerplateLines(markdown).length >= BOILERPLATE_MIN_LINES) {
    flags.add("boilerplate");
  }
  if (linkDensity(markdown) > LINK_DENSITY_MAX) {
    flags.add("high_link_density");
  }

  const penalty = [...flags].reduce((sum, f) => sum + PENALTY[f], 0);
  return {
    score: Math.round(Math.max(0, 1 - penalty) * 1000) / 1000,
    flags: [...flags],
    plain_chars: plainChars,
  };
}
