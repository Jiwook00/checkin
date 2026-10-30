// 규칙 채점기 (#79: scripts/eval/generate.ts에서 옮김)
//
// 모두 0/1이고, 실패 사유는 reason에 태그로 남긴다 ([구간] 태그:"내용"). jq로 유형을 셀 수 있게 하려는 것이다.
// 정답 라벨이 필요 없는 채점기(json · callback_match · form · voice · banned)만 여기 있다. 하네스는 callback_label을 덧붙이고,
// 운영(Edge Function)은 이 결과를 drafts.rule_scores에 그대로 남긴다.
// 스킬의 "본문 4~7문장"은 메일이 다섯 구간으로 바뀌어 구간별 문장 수로 바꿨다 (ADR 0003 한계)

import { normalizeStrict, prepareSource } from "./evidence.ts";
import type { GenerateInput, GenerateOutput } from "./generate.ts";
import type { Score } from "./types.ts";

const QUOTE_RE = /“[^”]*”|"[^"]*"|「[^」]*」/g;
const QUOTE_MARK = "〔인용〕";

/** 문장 수를 세기 위한 분리. 따옴표 안의 구두점은 문장 끝으로 보지 않는다 */
export function splitSentences(text: string): string[] {
  return text
    .replace(QUOTE_RE, QUOTE_MARK)
    .split(/(?<=[.?!…。！？])["'”’)\]]*\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== QUOTE_MARK);
}

type Section = "opening" | "callback" | "commonQuestion" | "closing";
const SECTIONS: Section[] = [
  "opening",
  "callback",
  "commonQuestion",
  "closing",
];

// 구간별 문장 수 [최소, 최대]. callback은 있을 때만 센다
const SENTENCE_RANGE: Record<Section, [number, number]> = {
  opening: [1, 2],
  callback: [2, 3],
  commonQuestion: [1, 3],
  closing: [1, 2],
};

// 따옴표와 공백을 지워 질문 문장이 그대로 들어갔는지 본다
const squash = (s: string) => s.replace(/[\s“”"'‘’「」]/g, "");

// 간접 의문 후속 질문 ("~지 궁금해요")
const INDIRECT_QUESTION_RE = /지\s*궁금(?:해요|합니다|하네요)/;

// voice: 말끝이 "~니다"인 문장. 스킬 고정 문형 "지난 회고 잘 읽었습니다."만 허용한다
const FORMAL_END_RE = /니다[.?!…]*$/;
const FORMAL_ALLOWED = "지난회고잘읽었습니다";
const squashPunct = (s: string) => s.replace(/[\s.?!…。！？"'“”‘’]/g, "");

// 공지 구간은 코드가 붙이므로 LLM 구간에는 날짜·시간·링크가 없어야 한다.
// callback은 제외한다: 회원이 쓴 글의 날짜("7월 1일에 이사")를 그대로 짚는 건 정상이다
const SCHEDULE_PATTERNS: [string, RegExp][] = [
  ["date", /\d{1,2}\s*월\s*\d{1,2}\s*일/g],
  ["time", /\d{1,2}\s*시(?!간)/g],
  ["ampm", /오전|오후/g],
  ["weekday", /[월화수목금토일]요일/g],
  ["link", /https?:\/\/|www\./g],
];

interface BannedRule {
  tag: "countdown" | "metaphor" | "pressure" | "style";
  re: RegExp;
  // callback 구간에서 회원의 원문에 같은 낱말이 있으면 허용한다 (예: 원문의 "대출 낀 전세")
  sourceOk: boolean;
}

// 스킬 §톤 규칙·§체크리스트의 금지 항목. 첫 실행에서 오탐이 나오면 채점 문제로 보고 고친다 (ADR 0006에 기록)
const BANNED: BannedRule[] = [
  // 남은 날짜 세기
  { tag: "countdown", re: /D-\s*\d/gi, sourceOk: true },
  { tag: "countdown", re: /\d+\s*일\s*(?:남|뒤|후|전)/g, sourceOk: true },
  { tag: "countdown", re: /며칠\s*(?:남|안|뒤)/g, sourceOk: true },
  {
    tag: "countdown",
    re: /(?:일주일|하루|이틀|사흘)\s*(?:남|뒤|전|안)/g,
    sourceOk: true,
  },
  { tag: "countdown", re: /마감|내일까지|모레까지/g, sourceOk: true },
  // 사서·도서관 메타포
  {
    tag: "metaphor",
    re: /사서|서가|책장|도서관|보관|꽂|꺼내\s*(?:읽|드리|보)|자리를?\s*(?:비워|표시|지켜|마련)|대출|반납|페이지/g,
    sourceOk: true,
  },
  // 검사·비교·분량 압박
  { tag: "pressure", re: /벌써\s*\S*\s*(?:분|명)/g, sourceOk: true },
  {
    tag: "pressure",
    re: /\d+\s*(?:분|명)(?:이|께서)?\s*(?:벌써\s*)?(?:쓰|작성|올리)/g,
    sourceOk: true,
  },
  { tag: "pressure", re: /다른\s*(?:분|멤버)/g, sourceOk: true },
  {
    tag: "pressure",
    re: /아직\s*(?:안\s*쓰|글을?\s*안|작성)|안\s*쓰셨/g,
    sourceOk: true,
  },
  // "길게 안 쓰셔도"·"길게 쓰지 않아도"는 허용한다
  { tag: "pressure", re: /길게\s*(?:써|쓰(?!지)|작성)/g, sourceOk: true },
  { tag: "pressure", re: /꼭\s*(?:써|작성|참여|오)/g, sourceOk: true },
  { tag: "pressure", re: /지키셨|지켰나|약속/g, sourceOk: true },
  // 느낌표 · 이모지 (예외 없음)
  { tag: "style", re: /[!！]/g, sourceOk: false },
  { tag: "style", re: /\p{Extended_Pictographic}/gu, sourceOk: false },
];

// 프롬프트에 예시 문장을 넣으면 여기에 적는다. 정규화한 12자 구간이 출력에 있으면 유출로 센다 (#75 v2의 교훈). v1은 예시가 없다
const PROMPT_EXAMPLES: string[] = [];
const LEAK_CHARS = 12;

function findLeaks(text: string): string[] {
  const out = normalizeStrict(text);
  const hits: string[] = [];
  for (const ex of PROMPT_EXAMPLES) {
    const e = normalizeStrict(ex);
    for (let i = 0; i + LEAK_CHARS <= e.length; i += 4) {
      if (out.includes(e.slice(i, i + LEAK_CHARS))) {
        hits.push(e.slice(i, i + LEAK_CHARS));
        break;
      }
    }
  }
  return hits;
}

/** 구간 하나의 금지 표현. 결과는 `[구간] 태그:"내용"` 목록 */
function findBanned(
  section: Section,
  text: string,
  question: string,
  srcStrict: string | null,
): string[] {
  // 질문 문장 자체는 우리가 준 것이라 검사하지 않는다
  const body = text.split(question).join(" ");
  const hits: string[] = [];
  for (const rule of BANNED) {
    for (const m of body.matchAll(rule.re)) {
      const word = m[0];
      if (
        section === "callback" &&
        rule.sourceOk &&
        srcStrict !== null &&
        srcStrict.includes(normalizeStrict(word))
      ) {
        continue;
      }
      hits.push(`[${section}] ${rule.tag}:"${word.trim()}"`);
    }
  }
  for (const w of findLeaks(body)) hits.push(`[${section}] leak:"${w}"`);
  return hits;
}

export function ruleGrade(
  input: GenerateInput,
  output: GenerateOutput,
  // 콜백 구간의 금지 표현은 회원 원문에 같은 낱말이 있으면 허용하므로 원문을 받는다 (없으면 null)
  sourceMarkdown: string | null,
): Record<string, Score> {
  const scores: Record<string, Score> = {};
  const r = output.result;

  scores.json = r
    ? { value: 1 }
    : {
        value: 0,
        reason: `${output.parseError ?? "결과 없음"} (stop=${output.stopReason ?? "?"})`,
      };
  if (!r) return scores;

  const hasCallback = r.callback.trim().length > 0;
  const n = input.materials.length;

  // callback_match: 쓴 콜백이 재료와 맞는가 (재료가 있는데 안 썼거나, 없는데 썼거나, 없는 번호를 골랐거나)
  const matchFail: string[] = [];
  if (n > 0 && !hasCallback)
    matchFail.push("missing: 재료가 있는데 콜백이 없어요");
  if (n === 0 && hasCallback)
    matchFail.push("invented: 재료가 없는데 콜백을 썼어요");
  if (hasCallback && n > 0 && (r.callbackItem < 1 || r.callbackItem > n)) {
    matchFail.push(`bad_item: callbackItem=${r.callbackItem} (재료 ${n}개)`);
  }
  if (!hasCallback && r.callbackItem !== 0) {
    matchFail.push(`bad_item: 콜백이 없는데 callbackItem=${r.callbackItem}`);
  }
  scores.callback_match = matchFail.length
    ? { value: 0, reason: matchFail.join("; ") }
    : { value: 1 };

  // form: 구간별 문장 수 · 질문 원문 포함 · 후속 질문 · LLM 구간에 일정 없음
  const formFail: string[] = [];
  for (const s of SECTIONS) {
    if (s === "callback" && !hasCallback) continue;
    const count = splitSentences(r[s]).length;
    const [min, max] = SENTENCE_RANGE[s];
    if (count < min || count > max)
      formFail.push(`${s}:${count}문장 (${min}~${max})`);
  }
  if (!squash(r.commonQuestion).includes(squash(input.commonQuestion))) {
    formFail.push("question_changed: 공통 질문이 원문과 달라요");
  }
  // 후속 질문: 물음표가 없어도 "~는지 궁금해요" 같은 간접 의문이면 통과 (8월 사람 답안도 이 문형을 쓴다)
  if (
    hasCallback &&
    !r.callback.includes("?") &&
    !r.callback.includes("？") &&
    !INDIRECT_QUESTION_RE.test(r.callback)
  ) {
    formFail.push("no_followup_question: 콜백에 후속 질문이 없어요");
  }
  for (const s of ["opening", "commonQuestion", "closing"] as const) {
    const body = r[s].split(input.commonQuestion).join(" ");
    for (const [tag, re] of SCHEDULE_PATTERNS) {
      for (const m of body.matchAll(re))
        formFail.push(`[${s}] schedule_${tag}:"${m[0].trim()}"`);
    }
  }
  scores.form = formFail.length
    ? { value: 0, reason: formFail.join("; ") }
    : { value: 1 };

  // voice: 말끝은 "~해요/~예요". "~니다"로 끝나는 문장은 실패 (고정 문형 하나만 허용)
  const voiceHits: string[] = [];
  for (const s of SECTIONS) {
    for (const sentence of splitSentences(r[s])) {
      if (!FORMAL_END_RE.test(sentence)) continue;
      if (squashPunct(sentence) === FORMAL_ALLOWED) continue;
      voiceHits.push(`[${s}] formal:"${sentence.slice(-12)}"`);
    }
  }
  scores.voice = voiceHits.length
    ? { value: 0, reason: voiceHits.slice(0, 5).join("; ") }
    : { value: 1 };

  // banned: 금지 표현 (카운트다운 · 사서 메타포 · 압박 · 느낌표/이모지 · 예시 유출)
  const srcStrict =
    sourceMarkdown !== null ? prepareSource(sourceMarkdown).strict : null;
  const bannedHits = SECTIONS.flatMap((s) =>
    findBanned(s, r[s], input.commonQuestion, srcStrict),
  );
  scores.banned = bannedHits.length
    ? { value: 0, reason: bannedHits.slice(0, 5).join("; ") }
    : { value: 1 };

  return scores;
}
