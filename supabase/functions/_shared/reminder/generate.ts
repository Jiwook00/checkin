// 생성 단계의 프롬프트·요청·파싱·메일 조립 (#79: scripts/eval/generate.ts에서 옮김)
//
// 추출 결과(재료)로 리마인더 메일의 네 구간(인사 · 콜백 · 공통 질문 · 마무리)을 쓰고, 일정·투표 링크가 들어가는
// 공지 구간은 코드가 붙인다 (날짜를 지어낼 여지를 없앤다. ADR 0006). 하네스와 Edge Function이 함께 쓴다.
// 프롬프트·스키마·요청 객체의 키 순서를 바꾸면 하네스의 호출 캐시 키가 바뀐다.
// 설계 근거와 규칙의 출처: .claude/skills/galpi-reminder/SKILL.md (§개인 콜백, §톤 규칙, §체크리스트)

import type { LLMRequest } from "./claude.ts";
import { checkEvidence, prepareSource } from "./evidence.ts";
import type { ExtractOutput } from "./extract.ts";

export interface Notice {
  // CTA: 이번 달 회고 쓰러 가기
  writeLine: string;
  // 투표가 열려 있으면 투표 링크, 닫혔으면 모임 정보
  scheduleLine: string;
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

export interface GenerateInput {
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

// 프롬프트 v3 (v2 대비 변경 이유, v2 tune 실패 유형 기준):
// - callback: 짚는 내용은 evidence에서만, 질문은 한 문장 (grounded 0.5: 요약의 사실을 짚음, callback 4문장 1건)
// - 후속 질문 절: 질문 대상·전제도 고른 재료의 evidence 안에서만 (grounded 0: 다른 재료의 사실을 전제로 씀; 0.5: 없는 장면을 전제로 깖)
// - 후속 질문 절: "달라졌는지" 표현을 빼고 대상이 질문 안에 있어야 한다는 조건으로 교체 (specific 0.5: "달라진 점" 틀이 새로 생김, 약 8/31)
// - 후속 질문 절: goal이면 했는지·어디까지·지금도 하는지 모두 금지 (v2에도 이행 확인 4/15)
// 프롬프트 v2 (v1 대비 변경 이유, tune 실패 유형 기준):
// - callback: 질문이 대목에서 이어지게 하고 evidence의 구체적인 말을 살린다 (specific 0.5: "어떻게 ~는지 궁금해요" 틀이 사람마다 같았음)
// - closing: 투표·글쓰기 부탁 금지 (tone 0.5: 투표 부탁이 가벼운 재촉으로 읽힘; 투표 링크는 공지에 코드가 붙임)
// - 후속 질문 절: 구체적 대상을 넣어 직접 묻고, goal이면 이행 점검 대신 경험·변화를 묻는다 (tone 0.5: "써보셨는지/어디까지" = 이행 점검)
// - 규칙 1: 시제를 바꾸지 않는다 (grounded 0: "길렀다" → "길러보겠다고")
// - 규칙 8: 말끝 "~해요/~예요" (voice: "궁금합니다·감사하겠습니다" 섞임)
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
- callback: materials가 있을 때만 씁니다. 재료 중 하나만 골라 callbackItem에 그 번호를 적습니다. "지난 회고 잘 읽었습니다."로 열고, 고른 재료의 evidence에 있는 그 사람의 말(이름, 대상, 숫자)을 살려 "~라고 적어두셨더라고요."로 짚은 뒤, 그 대목에 대한 질문 한 문장으로 끝냅니다. 요약은 고를 때만 참고하고, 짚는 내용은 evidence에서 가져옵니다. 2~3문장. materials가 없으면 callbackItem은 0, callback은 빈 문자열로 둡니다.
- commonQuestion: 이번 달 공통 질문을 소개합니다. 질문 문장은 따옴표 안에 한 글자도 바꾸지 말고 그대로 넣습니다. 회고와 함께 써도 되고 이 질문에 한 줄만 남겨도 된다고 안내합니다. 질문 문장을 빼고 1~3문장.
- closing: 짧게 맺습니다. 1문장. 투표나 글쓰기를 부탁하지 않습니다. 일정과 링크는 따로 붙습니다.

후속 질문
- 고른 대목에 나온 구체적인 대상을 질문 안에 넣어 "~나요?", "~세요?"처럼 직접 묻습니다. 대상을 빼도 말이 되는 질문, 즉 어느 대목에나 붙일 수 있는 질문은 쓰지 않습니다.
- 질문의 대상과 전제도 고른 재료의 evidence에 있는 것만 씁니다. 다른 재료의 사실이나 evidence에 없는 장면을 질문의 전제로 깔지 않습니다.
- 계획(goal)을 골랐다면 그 일을 했는지, 어디까지 했는지, 지금도 하고 있는지 묻지 않습니다. 그 계획에 나온 대상에 대한 그 사람의 생각을 묻습니다.

규칙
1. 재료에 없는 사실을 보태지 않습니다. 대목을 짚을 때 숫자, 이름, 시점, 시제(이미 한 일인지 앞으로 할 일인지)를 바꾸지 않습니다.
2. 감상이나 평가("멋지네요", "대단하세요")를 붙이지 않습니다. 사실과 질문만 담백하게 씁니다.
3. 검사하지 않습니다. 하겠다고 한 일을 지켰는지 확인하는 투가 아니라, 근황이 궁금한 투로 묻습니다.
4. 재촉하지 않습니다. 남은 날짜나 마감을 말하지 않고, 다른 멤버와 비교하거나 몇 명이 썼는지 말하지 않고, 길게 쓰라고 하지 않습니다.
5. 도서관·책·사서에 빗댄 표현(서가, 보관, 꽂다, 꺼내 읽다, 자리를 비워두다 등)을 쓰지 않습니다.
6. 날짜, 요일, 시간, 장소, 링크를 쓰지 않습니다.
7. 느낌표와 이모지를 쓰지 않습니다.
8. 말끝은 "~해요", "~예요"로 씁니다. "~습니다", "~합니다"는 "지난 회고 잘 읽었습니다." 한 문장에만 씁니다.`;

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

export function renderMaterials(materials: Material[]): string {
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
export function parseGenerate(text: string): GenerateResult | string {
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

export function composeMail(input: GenerateInput, r: GenerateResult): string {
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

// stages.ts의 generateStage.prompts가 쓰던 배열 그대로 (promptSha256의 입력)
export const GENERATE_PROMPTS = [
  GENERATE_SYSTEM,
  GENERATE_USER_TEMPLATE,
  JSON.stringify(GENERATE_SCHEMA),
];

/**
 * 추출 항목 중 근거 검증(checkEvidence)을 통과한 것만 생성 재료로 고른다. 통과가 0개면 콜백 없이 쓴다 (ADR 0005).
 * 원문이 없으면(null) 재료도 없다.
 */
export function selectMaterials(
  extract: ExtractOutput | undefined,
  sourceMarkdown: string | null,
): { materials: Material[]; dropped: number } {
  const items: Material[] = extract?.result
    ? [
        ...extract.result.goals.map((x) => ({ kind: "goal" as const, ...x })),
        ...extract.result.moments.map((x) => ({
          kind: "moment" as const,
          ...x,
        })),
      ]
    : [];
  const src = sourceMarkdown !== null ? prepareSource(sourceMarkdown) : null;
  const materials = src
    ? items.filter((it) => checkEvidence(src, it.evidence).ok)
    : [];
  return { materials, dropped: items.length - materials.length };
}

/** 생성 요청. 키 순서가 호출 캐시 키에 들어가므로 system → messages → maxTokens → jsonSchema를 지킨다 */
export function buildGenerateRequest(input: GenerateInput): LLMRequest {
  return {
    system: GENERATE_SYSTEM,
    messages: [{ role: "user", content: generateUserMessage(input) }],
    maxTokens: GENERATE_MAX_TOKENS,
    jsonSchema: GENERATE_SCHEMA,
  };
}
