// 추출 단계의 프롬프트·요청·파싱 (#79: scripts/eval/stages.ts에서 옮김)
//
// 하네스의 extractStage와 Edge Function이 함께 쓴다. 프롬프트와 스키마, 요청 객체의 키 순서를 바꾸면
// 하네스의 호출 캐시 키가 바뀌어 회귀 확인(같은 캐시로 재현)이 깨진다.

import type { LLMRequest } from "./claude.ts";

export interface ExtractItem {
  // 원문에서 그대로 복사한 연속 구간. text보다 먼저 쓰게 해서 "요약을 먼저 쓰고 근거를 맞춰 지어내는" 경로를 줄인다
  evidence: string;
  text: string;
}

export interface ExtractResult {
  goals: ExtractItem[];
  moments: ExtractItem[];
}

// skipped: 본문이 없어 호출하지 않았다. parseError: 호출은 했지만 JSON이나 형태가 틀렸다
// (throw하지 않고 출력으로 남겨야 JSON 파싱 실패율을 셀 수 있다)
export interface ExtractOutput {
  skipped?: "no_source";
  result?: ExtractResult;
  parseError?: string;
  raw?: string;
  stopReason?: string;
}

// 프롬프트 v1을 유지한다 (#75). v1 전체 실행의 근거 실패를 유형별로 겨냥해 두 번 고쳤지만 채택하지 않았다.
//   v2: 서술어 포함 문장 규칙 + 좋은 예/나쁜 예 문장 → 모델이 좋은 예 문장을 그대로 evidence로 내놓았다(원문에 없음).
//       dev evidence 0.935 → 0.911
//   v3: v2에서 예시 문장만 뺌 → 전체 211건에서 too_short 20 → 14였지만 v1 두 번 실행이 20과 15라 흔들림 안쪽이고,
//       인용을 고쳐 쓴 not_found는 7(v1 재실행 5) → 13으로 늘었다. 통과율 96.4%(v1 재실행 96.9%) → 95.9%
//   남은 실패는 프롬프트보다 코드(검증을 통과한 항목만 다음 단계로 넘기기)로 막는다. 근거: docs/madr/0005
const EXTRACT_SYSTEM = `당신은 개발자 회고 모임에서 멤버가 쓴 월간 회고 글을 읽고, 다음 달 개인 리마인더 메일에 쓸 재료를 뽑습니다.
리마인더는 "지난 회고에 이런 이야기를 적어두셨더라고요. 그 뒤로 어떻게 됐나요?"처럼 글쓴이만의 구체적인 대목을 짚고 근황을 묻는 메일입니다.

두 가지를 뽑으세요.
- goals: 글쓴이가 앞으로 하겠다고 적은 계획, 목표, 다짐. 한 달 뒤에 어떻게 됐는지 물어볼 수 있는 것.
- moments: 이 글쓴이에게만 있는 구체적인 대목. 겪은 일, 내린 결정, 고민, 감정이 구체적인 사건이나 대상과 함께 적힌 부분. 예: 이사, 출시, 이직 고민, 읽은 책에서 남은 문장.

규칙
1. evidence는 원문에서 연속된 한 구간을 그대로 복사한 것입니다. 띄어쓰기, 맞춤법, 문장부호, 말줄임표까지 고치지 말고 원문 그대로 옮기세요. 요약하거나 떨어진 문장을 이어 붙이지 마세요. 길이는 10자 이상 120자 이하로, 길면 한 문장 안에서 핵심 부분만 자르세요.
2. text는 그 항목을 한 문장으로 짧게 적은 것입니다. 원문에 없는 사실을 보태지 마세요.
3. 각 목록은 최대 3개입니다. 해당하는 내용이 없으면 빈 배열로 두세요. 개수를 채우려고 억지로 뽑지 마세요.
4. 업무 항목을 나열한 부분("API 개발", "로그인 구현")보다 글쓴이의 생각이나 사정이 드러난 대목을 고르세요.
5. 링크 주소, 이미지, 다른 사람의 글이나 책을 그대로 인용한 부분은 evidence로 쓰지 마세요. 단, 글쓴이가 그 인용에 대해 적은 생각은 쓸 수 있습니다.`;

const EXTRACT_USER_TEMPLATE =
  "<title>{title}</title>\n<retrospective>\n{markdown}\n</retrospective>";
const EXTRACT_MAX_TOKENS = 2048;

// 개수·길이 제한(maxItems, maxLength)은 스키마에 넣지 않는다. 프롬프트로 지시하고 채점기가 기록한다.
// 필드 순서(evidence → text)가 곧 생성 순서다
const ITEM_SCHEMA = {
  type: "object",
  properties: { evidence: { type: "string" }, text: { type: "string" } },
  required: ["evidence", "text"],
  additionalProperties: false,
};
const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    goals: { type: "array", items: ITEM_SCHEMA },
    moments: { type: "array", items: ITEM_SCHEMA },
  },
  required: ["goals", "moments"],
  additionalProperties: false,
};

function extractUserMessage(source: { title: string; markdown: string }) {
  const body = EXTRACT_USER_TEMPLATE.replace(
    "{markdown}",
    () => source.markdown,
  );
  // 제목이 없으면 그 줄을 뺀다
  return source.title
    ? body.replace("{title}", () => source.title)
    : body.replace(/^<title>\{title\}<\/title>\n/, "");
}

function isItems(v: unknown): v is ExtractItem[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as ExtractItem).evidence === "string" &&
        typeof (x as ExtractItem).text === "string",
    )
  );
}

/** 모델 응답을 ExtractResult로. 실패하면 사유 문자열을 돌려준다 */
export function parseExtract(text: string): ExtractResult | string {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (err) {
    return `json: ${(err as Error).message.slice(0, 120)}`;
  }
  const o = v as Partial<ExtractResult> | null;
  if (
    typeof o !== "object" ||
    o === null ||
    !isItems(o.goals) ||
    !isItems(o.moments)
  ) {
    return "schema: goals·moments가 {evidence, text} 배열이 아니에요";
  }
  return { goals: o.goals, moments: o.moments };
}

export interface ExtractSource {
  title: string;
  markdown: string;
}

// stages.ts의 extractStage.prompts가 쓰던 배열 그대로 (promptSha256의 입력)
export const EXTRACT_PROMPTS = [
  EXTRACT_SYSTEM,
  EXTRACT_USER_TEMPLATE,
  JSON.stringify(EXTRACT_SCHEMA),
];

/** 추출 요청. 키 순서가 호출 캐시 키에 들어가므로 system → messages → maxTokens → jsonSchema를 지킨다 */
export function buildExtractRequest(source: ExtractSource): LLMRequest {
  return {
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: extractUserMessage(source) }],
    maxTokens: EXTRACT_MAX_TOKENS,
    jsonSchema: EXTRACT_SCHEMA,
  };
}
