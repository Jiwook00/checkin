// 평가 하네스의 단계(Stage) 정의 (Deno 2.x, #74)
//
// 단계 하나 = 입력 만들기 → 실행(LLM 호출) → 채점. 하네스는 case마다 단계를 순서대로 돌리고,
// 앞 단계의 출력을 prev[단계이름]으로 다음 단계에 넘긴다. P2부터 추출·생성 단계와 채점기가 여기에 붙는다.
// 단계는 provider를 직접 부르지 못한다. 모든 호출은 ctx.call을 지나야 토큰 집계·상한·기록이 빠지지 않는다.

import { checkEvidence, normalizeStrict, prepareSource } from "./evidence.ts";
import { generateStage, judgeStage } from "./generate.ts";
import type { LLMRequest, LLMResponse } from "./llm.ts";
import type { EvalCase } from "./types.ts";

export interface StageContext {
  // dryRunText: dry-run에서 호출 대신 돌려줄 "전형적인 출력". 뒤 단계의 입력 크기를 현실에 가깝게 추정하려는 것이다
  // (없으면 입력을 그대로 돌려줘서 뒤 단계가 비어 보인다). 실제 호출에서는 쓰지 않는다
  call(req: LLMRequest, opts?: { dryRunText?: string }): Promise<LLMResponse>;
}

// value는 0~1. LLM 채점기는 reason을 반드시 남긴다
// weight가 있으면 summary가 가중 평균(scoresWeighted)도 낸다 (예: 근거 통과율을 case가 아니라 항목 기준으로 볼 때)
export interface Score {
  value: number;
  reason?: string;
  weight?: number;
}

export interface Stage<I = unknown, O = unknown> {
  name: string;
  // "judge"면 --judge-provider·--judge-model로 만든 provider로 호출한다 (기본은 생성과 같은 provider)
  role?: "judge";
  // 프롬프트 해시 대상. 프롬프트를 바꾸면 compare가 설정 차이로 보여준다
  prompts: string[];
  // 해시되는 입력. 같은 case·같은 prev면 항상 같은 값이어야 한다
  input(c: EvalCase, prev: Record<string, unknown>): I;
  run(input: I, ctx: StageContext): Promise<O>;
  grade?(c: EvalCase, input: I, output: O): Record<string, Score>;
}

// deno-lint-ignore no-explicit-any
export type AnyStage = Stage<any, any>;

// --- 더미 단계: 입력 그대로 돌려주기 ----------------------------------------------------

const ECHO_SYSTEM =
  "아래 텍스트를 한 글자도 바꾸지 말고 그대로 출력하세요. 설명이나 따옴표를 붙이지 마세요.";
const ECHO_CHARS = 300;

// 전체 흐름(호출 → 기록 → 채점 → 비교)을 확인하는 용도. 모델이 지시를 따르면 항상 1점이다
export const echoStage: Stage<{ text: string }, string> = {
  name: "echo",
  prompts: [ECHO_SYSTEM],
  input: (c) => ({
    text: c.source ? c.source.markdown.slice(0, ECHO_CHARS) : "(본문 없음)",
  }),
  async run(input, ctx) {
    const res = await ctx.call({
      system: ECHO_SYSTEM,
      messages: [{ role: "user", content: input.text }],
      maxTokens: 600,
    });
    return res.text;
  },
  grade: (_c, input, output) => ({
    exact: {
      value: output.trim() === input.text.trim() ? 1 : 0,
    },
  }),
};

// --- 추출 단계: 회고 → { goals, moments } + 원문 인용 (#75) --------------------------------

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

interface ExtractInput {
  // 단계는 expectCallback·type을 보지 않는다. 본문이 있는지만 보고 건너뛴다 (정답 라벨은 채점기가 대조한다)
  source: { title: string; markdown: string } | null;
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

// dry-run에서 뒤 단계(생성)의 입력 크기를 현실에 가깝게 잡으려는 전형적인 출력: 원문을 정규화한 글에서 70자 구간 4개를
// 인용으로 뽑는다(근거 검증을 통과하는 모양). 실제 호출에는 쓰지 않는다
function syntheticExtractText(markdown: string): string {
  const flat = normalizeStrict(markdown);
  const pick = (frac: number) => {
    const seg = flat
      .slice(Math.floor(flat.length * frac))
      .slice(0, 70)
      .trim();
    return { evidence: seg, text: seg.slice(0, 40) };
  };
  return JSON.stringify({
    goals: [pick(0.2), pick(0.4)],
    moments: [pick(0.6), pick(0.8)],
  });
}

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
function parseExtract(text: string): ExtractResult | string {
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

export const extractStage: Stage<ExtractInput, ExtractOutput> = {
  name: "extract",
  prompts: [
    EXTRACT_SYSTEM,
    EXTRACT_USER_TEMPLATE,
    JSON.stringify(EXTRACT_SCHEMA),
  ],
  input: (c) => ({
    source: c.source
      ? { title: c.source.title, markdown: c.source.markdown }
      : null,
  }),
  async run(input, ctx) {
    if (!input.source) return { skipped: "no_source" };
    const res = await ctx.call(
      {
        system: EXTRACT_SYSTEM,
        messages: [{ role: "user", content: extractUserMessage(input.source) }],
        maxTokens: EXTRACT_MAX_TOKENS,
        jsonSchema: EXTRACT_SCHEMA,
      },
      { dryRunText: syntheticExtractText(input.source.markdown) },
    );
    const parsed = parseExtract(res.text);
    if (typeof parsed === "string") {
      return {
        parseError: parsed,
        raw: res.text.slice(0, 2000),
        stopReason: res.stopReason,
      };
    }
    return { result: parsed, stopReason: res.stopReason };
  },
  grade(c, input, output) {
    const scores: Record<string, Score> = {};

    // skip: 건너뛰기로 한 결정이 정답 라벨과 같은가 (본문이 없으면 건너뛰고, 있으면 추출해야 한다)
    const skipped = output.skipped !== undefined;
    scores.skip = {
      value: !skipped === c.expectCallback ? 1 : 0,
      ...(!skipped === c.expectCallback
        ? {}
        : { reason: `skipped=${skipped} expectCallback=${c.expectCallback}` }),
    };
    if (skipped || !input.source) return scores;

    scores.json = output.result
      ? { value: 1 }
      : {
          value: 0,
          reason: `${output.parseError ?? "결과 없음"} (stop=${output.stopReason ?? "?"})`,
        };
    if (!output.result) return scores;

    const src = prepareSource(input.source.markdown);
    const items = [
      ...output.result.goals.map((x, i) => ({ tag: `goals#${i + 1}`, x })),
      ...output.result.moments.map((x, i) => ({ tag: `moments#${i + 1}`, x })),
    ].map((it) => ({ ...it, check: checkEvidence(src, it.x.evidence) }));
    const passed = items.filter((it) => it.check.ok).length;

    // 항목이 0개면 evidence는 매기지 않는다 ("지어냄"과 "뽑을 게 없음"이 섞이지 않도록). usable=0으로 잡힌다
    if (items.length > 0) {
      const failures = items
        .filter((it) => !it.check.ok)
        .map(
          (it) =>
            `[${it.tag} ${it.check.reason}] "${it.x.evidence.slice(0, 40)}"`,
        );
      scores.evidence = {
        value: passed / items.length,
        weight: items.length,
        ...(failures.length ? { reason: failures.join(" ") } : {}),
      };
    }
    scores.usable =
      passed > 0
        ? { value: 1 }
        : {
            value: 0,
            reason: items.length === 0 ? "항목 0개" : "통과한 항목 0개",
          };
    return scores;
  },
};

export const STAGES: Record<string, AnyStage> = {
  [echoStage.name]: echoStage,
  [extractStage.name]: extractStage,
  [generateStage.name]: generateStage,
  [judgeStage.name]: judgeStage,
};
