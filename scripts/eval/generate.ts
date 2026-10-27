// 생성 단계와 LLM 채점 단계 (Deno 2.x, #76)
//
// 추출 결과(재료)로 리마인더 메일의 네 구간(인사 · 콜백 · 공통 질문 · 마무리)을 쓰고, 두 종류의 채점기로 잰다.
//   - 규칙 채점기(generateStage.grade, 코드): 형식·금지 표현·콜백 유무. 싸고 결정적이다
//   - LLM 채점기(judgeStage): 근거성·구체성·톤. 이유를 점수보다 먼저 쓰게 한다. 호출이 필요해서 grade()가 아니라 단계다
// 일정·투표 링크가 들어가는 공지 구간은 LLM이 쓰지 않고 코드가 붙인다 (날짜를 지어낼 여지를 없앤다. ADR 0006)
// 설계 근거와 규칙의 출처: .claude/skills/galpi-reminder/SKILL.md (§개인 콜백, §톤 규칙, §체크리스트)

import { checkEvidence, normalizeStrict, prepareSource } from "./evidence.ts";
import type { ExtractOutput, Score, Stage } from "./stages.ts";
import type { EvalCase } from "./types.ts";

// --- 평가용 입력: 공통 질문 · 투표 상태 · 일정 --------------------------------------------
// 공통 질문 DB(#77)보다 앞이라 실제 데이터를 읽지 않는다. 입력은 case id로 정해지는 합성값이다 (같은 case는 항상 같다)

const SITE = "https://monthly-checkin.vercel.app";

// letters/galpi-letters.json의 topicsUsed 3개를 옮겼다. 8월 질문은 ledger와 발송한 8월 메일이 달라서
// (ledger: "이번 달 산 것 중 최고(또는 최악)는?") 8월 메일 HTML에 실제로 나간 문장을 쓴다. 비교 리포트의 기준 답안과 맞추려는 것이다
const COMMON_QUESTIONS = [
  "요즘 제일 자주 여는 앱(또는 사이트)은?",
  "이번 달 가장 만족스러웠던 소비 (잘 산 것)는?",
  "긴 휴식 후 다시 원래의 리듬을 되찾는 나만의 방법은?",
];

// 문자열 → 32비트 정수 (FNV-1a). 동기 함수라서 sha256 대신 쓴다
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickQuestion(c: EvalCase): string {
  // 실제로 나간 두 회차는 그 질문, 나머지는 case마다 고르게 섞는다
  if (c.session === "2026-07") return COMMON_QUESTIONS[0];
  if (c.session === "2026-08") return COMMON_QUESTIONS[1];
  return COMMON_QUESTIONS[hash32(`${c.id}:question`) % COMMON_QUESTIONS.length];
}

// 투표가 닫혔는지는 case마다 반반으로 섞는다. LLM은 이 boolean만 본다
const pickVoteOpen = (c: EvalCase) => hash32(`${c.id}:vote`) % 2 === 0;

interface Notice {
  // CTA: 이번 달 회고 쓰러 가기
  writeLine: string;
  // 투표가 열려 있으면 투표 링크, 닫혔으면 모임 정보
  scheduleLine: string;
}

// 모임은 회고 회차의 다음 달 둘째 토요일 오후 3시 온라인이라고 가정한다 (2026-08 회차의 실제 모임이 9월 12일 토요일)
function buildNotice(session: string, voteOpen: boolean): Notice {
  const [y, m] = session.split("-").map(Number);
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const secondSaturday = 1 + ((6 - first + 7) % 7) + 7;
  const meetingMonth = (m % 12) + 1;
  return {
    writeLine: `${m}월 회고 쓰러 가기 → ${SITE}`,
    scheduleLine: voteOpen
      ? `다음 모임 일정은 투표로 정하고 있어요 → ${SITE}/vote`
      : `다음 모임 — ${meetingMonth}월 ${secondSaturday}일 (토) 오후 3시 · 온라인`,
  };
}

// --- 생성 단계 ---------------------------------------------------------------------

export interface Material {
  kind: "goal" | "moment";
  evidence: string;
  text: string;
}

export interface GenerateResult {
  opening: string;
  // 고른 재료 번호(1부터). 재료가 없거나 콜백을 쓰지 않으면 0
  callbackItem: number;
  callback: string;
  commonQuestion: string;
  closing: string;
}

interface GenerateInput {
  name: string;
  month: string;
  voteOpen: boolean;
  commonQuestion: string;
  // 추출 항목 중 근거 검증(checkEvidence)을 통과한 것만. 비어 있으면 콜백 없이 쓴다 (ADR 0005)
  materials: Material[];
  // 근거 검증에 걸려 넘기지 않은 항목 수 (기록용)
  dropped: number;
  notice: Notice;
}

export interface GenerateOutput {
  result?: GenerateResult;
  parseError?: string;
  raw?: string;
  stopReason?: string;
  // 채점기와 리포트가 입력을 다시 계산하지 않도록 남긴다
  materials: Material[];
  voteOpen: boolean;
  commonQuestion: string;
  notice: Notice;
  // 인사 → 콜백 → 공통 질문 → 공지 → 마무리를 이은 최종 본문 (사람이 읽는 용도)
  mail?: string;
}

// 프롬프트 v1. 예시 문장을 넣지 않는다: #75 v2에서 예시 문장이 출력(인용)으로 새어 나왔다.
// "지난 회고 잘 읽었습니다", "적어두셨더라고요"는 스킬의 고정 문형이라 출력에 나오는 게 의도다.
// 규칙은 스킬 §톤 규칙·§개인 콜백에서 가져왔다
const GENERATE_SYSTEM = `당신은 개발자 월간 회고 모임 "체크인"의 갈피입니다. 모임 전에 멤버 한 사람에게 보내는 개인 리마인더 메일에서 네 구간을 씁니다. 모임 일정, 링크, 서명은 따로 붙으므로 쓰지 않습니다.

입력
- member: 받는 사람의 이름. 호칭은 "○○님"입니다.
- month: 이번에 쓰는 회고의 달.
- vote_open: true면 다음 모임 일정을 아직 투표로 정하는 중입니다.
- common_question: 이번 달 공통 질문.
- materials: 이 사람이 지난 회고에 적은 대목들. 번호가 붙어 있고 evidence는 원문 그대로의 인용입니다. 비어 있으면 "없음"입니다.

구간
- opening: "안녕하세요 {이름}님, 갈피예요."로 시작하고, {month} 회고를 이제 쓸 수 있다는 사실을 알립니다. 1~2문장.
- callback: materials가 있을 때만 씁니다. 재료 중 하나만 골라 callbackItem에 그 번호를 적습니다. "지난 회고 잘 읽었습니다."로 열고, 고른 대목을 "~라고 적어두셨더라고요."로 짚은 뒤, 그 뒤로 어떻게 됐는지 묻는 질문 하나로 끝냅니다. 2~3문장. materials가 없으면 callbackItem은 0, callback은 빈 문자열로 둡니다.
- commonQuestion: 이번 달 공통 질문을 소개합니다. 질문 문장은 따옴표 안에 한 글자도 바꾸지 말고 그대로 넣습니다. 회고와 함께 써도 되고 이 질문에 한 줄만 남겨도 된다고 안내합니다. 질문 문장을 빼고 1~3문장.
- closing: 짧게 맺습니다. 1~2문장. 투표가 열려 있으면 일정 투표를 한 번 가볍게 부탁해도 됩니다.

규칙
1. 재료에 없는 사실을 보태지 않습니다. 대목을 짚을 때는 evidence에 있는 그 사람의 구체적인 말을 살리고, 숫자·이름·시점은 바꾸지 않습니다.
2. 감상이나 평가("멋지네요", "대단하세요")를 붙이지 않습니다. 사실과 질문만 담백하게 씁니다.
3. 검사하지 않습니다. 하겠다고 한 일을 지켰는지 확인하는 투가 아니라, 근황이 궁금한 투로 묻습니다.
4. 재촉하지 않습니다. 남은 날짜나 마감을 말하지 않고, 다른 멤버와 비교하거나 몇 명이 썼는지 말하지 않고, 길게 쓰라고 하지 않습니다.
5. 도서관·책·사서에 빗댄 표현(서가, 보관, 꽂다, 꺼내 읽다, 자리를 비워두다 등)을 쓰지 않습니다.
6. 날짜, 요일, 시간, 장소, 링크를 쓰지 않습니다.
7. 느낌표와 이모지를 쓰지 않습니다.`;

const GENERATE_USER_TEMPLATE = `<member>{name}</member>
<month>{month}</month>
<vote_open>{voteOpen}</vote_open>
<common_question>{question}</common_question>
<materials>
{materials}
</materials>`;

const GENERATE_MAX_TOKENS = 1200;

// 필드 순서가 생성 순서다: 재료를 먼저 고르고(callbackItem) 그다음 쓴다. "없음"은 0과 빈 문자열로 표현한다
const GENERATE_SCHEMA = {
  type: "object",
  properties: {
    opening: { type: "string" },
    callbackItem: { type: "integer" },
    callback: { type: "string" },
    commonQuestion: { type: "string" },
    closing: { type: "string" },
  },
  required: [
    "opening",
    "callbackItem",
    "callback",
    "commonQuestion",
    "closing",
  ],
  additionalProperties: false,
};

function renderMaterials(materials: Material[]): string {
  if (materials.length === 0) return "없음";
  return materials
    .map(
      (m, i) =>
        `${i + 1}. [${m.kind === "goal" ? "goal" : "moment"}] evidence: "${m.evidence}" / 요약: ${m.text}`,
    )
    .join("\n");
}

function generateUserMessage(input: GenerateInput): string {
  return GENERATE_USER_TEMPLATE.replace("{name}", () => input.name)
    .replace("{month}", () => input.month)
    .replace("{voteOpen}", () => String(input.voteOpen))
    .replace("{question}", () => input.commonQuestion)
    .replace("{materials}", () => renderMaterials(input.materials));
}

/** 모델 응답을 GenerateResult로. 실패하면 사유 문자열을 돌려준다 */
function parseGenerate(text: string): GenerateResult | string {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (err) {
    return `json: ${(err as Error).message.slice(0, 120)}`;
  }
  const o = v as Partial<GenerateResult> | null;
  if (
    typeof o !== "object" ||
    o === null ||
    typeof o.opening !== "string" ||
    !Number.isInteger(o.callbackItem) ||
    typeof o.callback !== "string" ||
    typeof o.commonQuestion !== "string" ||
    typeof o.closing !== "string"
  ) {
    return "schema: 다섯 필드(문자열 4, 정수 1)가 아니에요";
  }
  return {
    opening: o.opening,
    callbackItem: o.callbackItem as number,
    callback: o.callback,
    commonQuestion: o.commonQuestion,
    closing: o.closing,
  };
}

function composeMail(input: GenerateInput, r: GenerateResult): string {
  return [
    r.opening,
    r.callback,
    r.commonQuestion,
    `${input.notice.writeLine}\n${input.notice.scheduleLine}`,
    r.closing,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
}

// dry-run에서 뒤 단계(채점)의 입력 크기를 현실에 가깝게 잡으려는 전형적인 출력. 호출에는 쓰지 않는다
function syntheticGenerateText(input: GenerateInput): string {
  const has = input.materials.length > 0;
  return JSON.stringify({
    opening: `안녕하세요 ${input.name}님, 갈피예요. ${input.month} 회고도 이제 쓰실 수 있어요.`,
    callbackItem: has ? 1 : 0,
    callback: has
      ? `지난 회고 잘 읽었습니다. ${input.materials[0].text.slice(0, 50)}라고 적어두셨더라고요. 그 뒤로 어떻게 되셨나요?`
      : "",
    commonQuestion: `이번 달 공통 질문은 “${input.commonQuestion}”이에요. 회고와 함께 쓰셔도, 이 한 줄만 남기셔도 좋아요.`,
    closing: "그럼 다음 회고 때 봬요.",
  });
}

// --- 규칙 채점기 -----------------------------------------------------------------------
// 모두 0/1이고, 실패 사유는 reason에 태그로 남긴다 ([구간] 태그:"내용"). jq로 유형을 셀 수 있게 하려는 것이다.
// 스킬의 "본문 4~7문장"은 메일이 다섯 구간으로 바뀌어 구간별 문장 수로 바꿨다 (ADR 0003 한계)

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

function ruleGrade(
  c: EvalCase,
  input: GenerateInput,
  output: GenerateOutput,
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

  // callback_label: 정답 라벨과 같은가. 파이프라인 끝단 지표다 (추출 실패 · 근거 필터 · 생성 판단이 다 섞인다).
  // 본문이 사실상 없는 글(empty_body)은 라벨이 true여도 콜백이 없는 게 정답이다
  const expected = c.expectCallback && !c.notes?.includes("empty_body");
  scores.callback_label =
    hasCallback === expected
      ? { value: 1 }
      : {
          value: 0,
          reason: expected
            ? `missing: 콜백이 있어야 하는데 없어요 (재료 ${n}개, 근거 검증 탈락 ${input.dropped}개)`
            : "unexpected: 콜백이 없어야 하는데 있어요",
        };

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
  if (hasCallback && !r.callback.includes("?") && !r.callback.includes("？")) {
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

  // banned: 금지 표현 (카운트다운 · 사서 메타포 · 압박 · 느낌표/이모지 · 예시 유출)
  const srcStrict = c.source ? prepareSource(c.source.markdown).strict : null;
  const bannedHits = SECTIONS.flatMap((s) =>
    findBanned(s, r[s], input.commonQuestion, srcStrict),
  );
  scores.banned = bannedHits.length
    ? { value: 0, reason: bannedHits.slice(0, 5).join("; ") }
    : { value: 1 };

  return scores;
}

export const generateStage: Stage<GenerateInput, GenerateOutput> = {
  name: "generate",
  prompts: [
    GENERATE_SYSTEM,
    GENERATE_USER_TEMPLATE,
    JSON.stringify(GENERATE_SCHEMA),
  ],
  input(c, prev) {
    // 단계는 expectCallback · type · notes를 보지 않는다 (정답 라벨은 채점기만 본다)
    const extract = prev.extract as ExtractOutput | undefined;
    const items = extract?.result
      ? [
          ...extract.result.goals.map((x) => ({ kind: "goal" as const, ...x })),
          ...extract.result.moments.map((x) => ({
            kind: "moment" as const,
            ...x,
          })),
        ]
      : [];
    // 근거 검증을 통과한 항목만 생성에 넘긴다. 통과가 0개면 콜백 없이 쓴다 (ADR 0005)
    const src = c.source ? prepareSource(c.source.markdown) : null;
    const materials = src
      ? items.filter((it) => checkEvidence(src, it.evidence).ok)
      : [];
    const voteOpen = pickVoteOpen(c);
    return {
      name: c.memberName,
      month: `${Number(c.session.split("-")[1])}월`,
      voteOpen,
      commonQuestion: pickQuestion(c),
      materials,
      dropped: items.length - materials.length,
      notice: buildNotice(c.session, voteOpen),
    };
  },
  async run(input, ctx) {
    const base = {
      materials: input.materials,
      voteOpen: input.voteOpen,
      commonQuestion: input.commonQuestion,
      notice: input.notice,
    };
    const res = await ctx.call(
      {
        system: GENERATE_SYSTEM,
        messages: [{ role: "user", content: generateUserMessage(input) }],
        maxTokens: GENERATE_MAX_TOKENS,
        jsonSchema: GENERATE_SCHEMA,
      },
      { dryRunText: syntheticGenerateText(input) },
    );
    const parsed = parseGenerate(res.text);
    if (typeof parsed === "string") {
      return {
        ...base,
        parseError: parsed,
        raw: res.text.slice(0, 2000),
        stopReason: res.stopReason,
      };
    }
    return {
      ...base,
      result: parsed,
      stopReason: res.stopReason,
      mail: composeMail(input, parsed),
    };
  },
  grade: ruleGrade,
};

// --- LLM 채점 단계 ----------------------------------------------------------------------
// 근거성(grounded) · 구체성(specific) · 톤(tone)을 0/1/2로 매기고 이유를 점수보다 먼저 쓴다 (#75 evidence → text와 같은 원리).
// 콜백이 있는 case에만 돈다: 콜백이 없는 메일의 톤은 규칙 채점기(banned · form)가 본다.
// 3단계 척도인 이유: 단계가 적을수록 같은 글에 같은 점수가 나오기 쉽고, 사람 라벨(#78)과 비교하기도 쉽다

export interface JudgeScores {
  grounded: { reason: string; score: number };
  specific: { reason: string; score: number };
  tone: { reason: string; score: number };
}

export interface JudgeOutput {
  skipped?: "no_generation" | "no_callback";
  result?: JudgeScores;
  parseError?: string;
  raw?: string;
  stopReason?: string;
}

interface JudgeInput {
  skip?: "no_generation" | "no_callback";
  name: string;
  month: string;
  voteOpen: boolean;
  materials: Material[];
  sections: {
    opening: string;
    callbackItem: number;
    callback: string;
    commonQuestion: string;
    closing: string;
  } | null;
}

// 같은 Claude 계열이 생성(Haiku)과 채점(Sonnet)을 하므로 자기 선호 편향이 있을 수 있다 (ADR 0006 한계)
const JUDGE_SYSTEM = `당신은 개인 리마인더 메일 초안을 채점합니다. 메일은 회고 모임의 "갈피"가 멤버 한 사람에게 보내며, 지난 회고의 한 대목을 짚고 근황을 묻는 것이 핵심입니다. 일정 안내는 따로 붙으므로 채점하지 않습니다.
항목마다 reason을 먼저 쓰고 score를 매깁니다. reason에는 메일 문장을 짧게 인용해 근거를 댑니다. 메일이 재료나 규칙을 잘 따랐다면 망설이지 말고 2를 줍니다.

grounded — callback이 고른 재료에 있는 사실만 말하는가
  2: callback의 사실(무엇을, 언제, 어떤 상태인지)이 모두 고른 재료의 evidence에서 확인된다
  1: 새 사실은 없지만 재료에 없는 해석·추측·수식이 붙었다 (예: 심정을 짐작함)
  0: 재료에 없는 사실이 있거나 뜻이 달라졌다 (시점·대상·결과가 바뀜), 또는 고른 번호와 다른 재료를 말한다

specific — 이 사람에게만 보낼 수 있는 callback인가
  2: 한 대목을 그 사람의 구체적인 말이나 대상으로 짚고, 질문이 그 대목에서 이어진다
  1: 대목은 맞지만 뭉뚱그려 짚었거나, 질문이 누구에게나 할 수 있는 안부다
  0: 다른 멤버에게 보내도 어색하지 않거나, 여러 대목을 나열했다

tone — 이 메일의 네 구간 전체가 담백하고 부담 없는가
  2: 사실과 질문 위주다. 검사, 재촉, 비교, 분량 압박, 감상·평가, 도서관·사서 비유가 없다
  1: 한두 군데 과하다 (꾸밈말, 가벼운 재촉, 형식적인 칭찬)
  0: 지난 계획을 지켰는지 따지거나, 마감·인원으로 압박하거나, 도서관·사서 비유를 쓴다`;

const JUDGE_USER_TEMPLATE = `<member>{name}</member>
<month>{month}</month>
<materials>
{materials}
</materials>
<mail>
[opening]
{opening}

[callback] (고른 재료 번호: {item})
{callback}

[commonQuestion]
{commonQuestion}

[closing]
{closing}
</mail>`;

const JUDGE_MAX_TOKENS = 1500;

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    reason: { type: "string" },
    score: { type: "integer", enum: [0, 1, 2] },
  },
  required: ["reason", "score"],
  additionalProperties: false,
};
const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    grounded: SCORE_SCHEMA,
    specific: SCORE_SCHEMA,
    tone: SCORE_SCHEMA,
  },
  required: ["grounded", "specific", "tone"],
  additionalProperties: false,
};

function parseJudge(text: string): JudgeScores | string {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (err) {
    return `json: ${(err as Error).message.slice(0, 120)}`;
  }
  const o = v as Record<string, { reason?: unknown; score?: unknown }> | null;
  const out: Partial<JudgeScores> = {};
  for (const k of ["grounded", "specific", "tone"] as const) {
    const x = o?.[k];
    if (
      typeof x?.reason !== "string" ||
      typeof x.score !== "number" ||
      ![0, 1, 2].includes(x.score)
    ) {
      return `schema: ${k}가 {reason, score(0~2)}가 아니에요`;
    }
    out[k] = { reason: x.reason, score: x.score };
  }
  return out as JudgeScores;
}

function syntheticJudgeText(): string {
  const reason =
    "메일의 callback이 고른 재료의 evidence와 같은 사실을 짚고 있고 새 사실을 보태지 않았다.";
  return JSON.stringify({
    grounded: { reason, score: 2 },
    specific: { reason, score: 2 },
    tone: { reason, score: 2 },
  });
}

export const judgeStage: Stage<JudgeInput, JudgeOutput> = {
  name: "judge",
  role: "judge",
  prompts: [JUDGE_SYSTEM, JUDGE_USER_TEMPLATE, JSON.stringify(JUDGE_SCHEMA)],
  input(c, prev) {
    const g = prev.generate as GenerateOutput | undefined;
    const base = {
      name: c.memberName,
      month: `${Number(c.session.split("-")[1])}월`,
      voteOpen: g?.voteOpen ?? false,
      materials: g?.materials ?? [],
    };
    if (!g?.result) return { ...base, skip: "no_generation", sections: null };
    if (g.result.callback.trim() === "") {
      return { ...base, skip: "no_callback", sections: null };
    }
    return { ...base, sections: g.result };
  },
  async run(input, ctx) {
    if (input.skip) return { skipped: input.skip };
    const s = input.sections!;
    const user = JUDGE_USER_TEMPLATE.replace("{name}", () => input.name)
      .replace("{month}", () => input.month)
      .replace("{materials}", () => renderMaterials(input.materials))
      .replace("{opening}", () => s.opening)
      .replace("{item}", () => String(s.callbackItem))
      .replace("{callback}", () => s.callback)
      .replace("{commonQuestion}", () => s.commonQuestion)
      .replace("{closing}", () => s.closing);
    const res = await ctx.call(
      {
        system: JUDGE_SYSTEM,
        messages: [{ role: "user", content: user }],
        maxTokens: JUDGE_MAX_TOKENS,
        jsonSchema: JUDGE_SCHEMA,
      },
      { dryRunText: syntheticJudgeText() },
    );
    const parsed = parseJudge(res.text);
    if (typeof parsed === "string") {
      return {
        parseError: parsed,
        raw: res.text.slice(0, 2000),
        stopReason: res.stopReason,
      };
    }
    return { result: parsed, stopReason: res.stopReason };
  },
  grade(_c, _input, output): Record<string, Score> {
    // 건너뛴 case는 채점기가 없다 (평균의 분모에서 빠진다)
    if (output.skipped) return {};
    if (!output.result) {
      return {
        judge_json: {
          value: 0,
          reason: `${output.parseError ?? "결과 없음"} (stop=${output.stopReason ?? "?"})`,
        },
      };
    }
    const r = output.result;
    return {
      judge_json: { value: 1 },
      grounded: { value: r.grounded.score / 2, reason: r.grounded.reason },
      specific: { value: r.specific.score / 2, reason: r.specific.reason },
      tone: { value: r.tone.score / 2, reason: r.tone.reason },
    };
  },
};
