// 생성 단계와 LLM 채점 단계 (Deno 2.x, #76)
//
// 추출 결과(재료)로 리마인더 메일의 네 구간(인사 · 콜백 · 공통 질문 · 마무리)을 쓰고, 두 종류의 채점기로 잰다.
//   - 규칙 채점기(generateStage.grade, 코드): 형식·금지 표현·콜백 유무. 싸고 결정적이다
//   - LLM 채점기(judgeStage): 근거성·구체성·톤. 이유를 점수보다 먼저 쓰게 한다. 호출이 필요해서 grade()가 아니라 단계다
// 일정·투표 링크가 들어가는 공지 구간은 LLM이 쓰지 않고 코드가 붙인다 (날짜를 지어낼 여지를 없앤다. ADR 0006)
// 설계 근거와 규칙의 출처: .claude/skills/galpi-reminder/SKILL.md (§개인 콜백, §톤 규칙, §체크리스트)

import {
  buildGenerateRequest,
  composeMail,
  GENERATE_PROMPTS,
  type GenerateInput,
  type GenerateOutput,
  type Material,
  type Notice,
  parseGenerate,
  renderMaterials,
  selectMaterials,
} from "../../supabase/functions/_shared/reminder/generate.ts";
import type { ExtractOutput } from "../../supabase/functions/_shared/reminder/extract.ts";
import { ruleGrade } from "../../supabase/functions/_shared/reminder/grade.ts";
import type { Score } from "../../supabase/functions/_shared/reminder/types.ts";
import { loadSessionQuestions } from "./session-questions.ts";
import type { Stage } from "./stages.ts";
import type { EvalCase } from "./types.ts";

// 프롬프트·요청·파싱·메일 조립·규칙 채점기는 Edge Function과 공유하는 _shared/reminder/에 있다 (#79).
// 여기에는 평가용 합성 입력, 정답 라벨 채점(callback_label), LLM 채점(judge)만 남는다

// --- 평가용 입력: 공통 질문 · 투표 상태 · 일정 --------------------------------------------
// 공통 질문은 DB(checkin_session_questions, #78)에서 받아 둔 스냅샷 파일에서만 읽는다. 하네스는 DB에 접근하지 않는다.
// 스냅샷 받기: eval-dataset.ts --questions. 투표 상태·일정은 case id로 정해지는 합성값이다 (같은 case는 항상 같다)

const SITE = "https://monthly-checkin.vercel.app";

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
  // 그 회차에 승인된 질문이 있으면 그것(실제로 나간 질문). 없는 회차는 고정된 풀에서 case마다 고르게 섞는다
  const snap = loadSessionQuestions();
  const own = snap.questions.find((q) => q.session === c.session);
  if (own) return own.question;
  const pool = snap.fallbackSessions.map(
    (s) => snap.questions.find((q) => q.session === s)!.question,
  );
  return pool[hash32(`${c.id}:question`) % pool.length];
}

// 투표가 닫혔는지는 case마다 반반으로 섞는다. LLM은 이 boolean만 본다
const pickVoteOpen = (c: EvalCase) => hash32(`${c.id}:vote`) % 2 === 0;

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

// 규칙 채점기는 공유 모듈의 ruleGrade가 맡고, 정답 라벨(expectCallback)이 필요한 callback_label만 여기서 덧붙인다.
// 기록되는 채점기 순서는 옮기기 전과 같게 유지한다 (compare·summary가 같은 순서로 보인다)
function gradeGenerate(
  c: EvalCase,
  input: GenerateInput,
  output: GenerateOutput,
): Record<string, Score> {
  const rules = ruleGrade(input, output, c.source?.markdown ?? null);
  const r = output.result;
  if (!r) return rules;

  const hasCallback = r.callback.trim().length > 0;
  const n = input.materials.length;

  // callback_label: 정답 라벨과 같은가. 파이프라인 끝단 지표다 (추출 실패 · 근거 필터 · 생성 판단이 다 섞인다).
  // 본문이 사실상 없는 글(empty_body)은 라벨이 true여도 콜백이 없는 게 정답이다
  const expected = c.expectCallback && !c.notes?.includes("empty_body");
  const callbackLabel: Score =
    hasCallback === expected
      ? { value: 1 }
      : {
          value: 0,
          reason: expected
            ? `missing: 콜백이 있어야 하는데 없어요 (재료 ${n}개, 근거 검증 탈락 ${input.dropped}개)`
            : "unexpected: 콜백이 없어야 하는데 있어요",
        };

  return {
    json: rules.json,
    callback_match: rules.callback_match,
    callback_label: callbackLabel,
    form: rules.form,
    voice: rules.voice,
    banned: rules.banned,
  };
}

export const generateStage: Stage<GenerateInput, GenerateOutput> = {
  name: "generate",
  prompts: GENERATE_PROMPTS,
  input(c, prev) {
    // 단계는 expectCallback · type · notes를 보지 않는다 (정답 라벨은 채점기만 본다)
    const extract = prev.extract as ExtractOutput | undefined;
    const { materials, dropped } = selectMaterials(
      extract,
      c.source?.markdown ?? null,
    );
    const voteOpen = pickVoteOpen(c);
    return {
      name: c.memberName,
      month: `${Number(c.session.split("-")[1])}월`,
      voteOpen,
      commonQuestion: pickQuestion(c),
      materials,
      dropped,
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
    const res = await ctx.call(buildGenerateRequest(input), {
      dryRunText: syntheticGenerateText(input),
    });
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
  grade: gradeGenerate,
};

// --- LLM 채점 단계 ----------------------------------------------------------------------
// 근거성(grounded) · 구체성(specific) · 톤(tone)을 0/1/2로 매기고 이유를 점수보다 먼저 쓴다 (#75 evidence → text와 같은 원리).
// 콜백이 있는 case에만 돈다: 콜백이 없는 메일의 톤은 규칙 채점기(banned · form)가 본다.
// 3단계 척도인 이유: 단계가 적을수록 같은 글에 같은 점수가 나오기 쉽고, 사람 라벨(#77)과 비교하기도 쉽다

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
항목마다 reason을 먼저 쓰고 score를 매깁니다. reason에는 메일 문장을 짧게 인용해 근거를 댑니다. 메일이 재료나 규칙을 잘 따랐다면 망설이지 말고 2를 줍니다. "지난 회고 잘 읽었습니다", "~라고 적어두셨더라고요"는 이 메일에 정해진 문형이라 형식적인 인사로 보고 감점하지 않습니다.

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
