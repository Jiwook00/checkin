// 평가 하네스의 단계(Stage) 정의 (Deno 2.x, #74)
//
// 단계 하나 = 입력 만들기 → 실행(LLM 호출) → 채점. 하네스는 case마다 단계를 순서대로 돌리고,
// 앞 단계의 출력을 prev[단계이름]으로 다음 단계에 넘긴다. P2부터 추출·생성 단계와 채점기가 여기에 붙는다.
// 단계는 provider를 직접 부르지 못한다. 모든 호출은 ctx.call을 지나야 토큰 집계·상한·기록이 빠지지 않는다.

import {
  checkEvidence,
  normalizeStrict,
  prepareSource,
} from "../../supabase/functions/_shared/reminder/evidence.ts";
import {
  buildExtractRequest,
  EXTRACT_PROMPTS,
  type ExtractOutput,
  parseExtract,
} from "../../supabase/functions/_shared/reminder/extract.ts";
import type { Score } from "../../supabase/functions/_shared/reminder/types.ts";
import { generateStage, judgeStage } from "./generate.ts";
import type { LLMRequest, LLMResponse } from "./llm.ts";
import type { EvalCase } from "./types.ts";

// 추출 프롬프트·요청·파싱은 Edge Function과 공유하는 _shared/reminder/extract.ts에 있다 (#79)
export type {
  ExtractItem,
  ExtractOutput,
  ExtractResult,
} from "../../supabase/functions/_shared/reminder/extract.ts";
export type { Score };

export interface StageContext {
  // dryRunText: dry-run에서 호출 대신 돌려줄 "전형적인 출력". 뒤 단계의 입력 크기를 현실에 가깝게 추정하려는 것이다
  // (없으면 입력을 그대로 돌려줘서 뒤 단계가 비어 보인다). 실제 호출에서는 쓰지 않는다
  call(req: LLMRequest, opts?: { dryRunText?: string }): Promise<LLMResponse>;
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

interface ExtractInput {
  // 단계는 expectCallback·type을 보지 않는다. 본문이 있는지만 보고 건너뛴다 (정답 라벨은 채점기가 대조한다)
  source: { title: string; markdown: string } | null;
}

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

export const extractStage: Stage<ExtractInput, ExtractOutput> = {
  name: "extract",
  prompts: EXTRACT_PROMPTS,
  input: (c) => ({
    source: c.source
      ? { title: c.source.title, markdown: c.source.markdown }
      : null,
  }),
  async run(input, ctx) {
    if (!input.source) return { skipped: "no_source" };
    const res = await ctx.call(buildExtractRequest(input.source), {
      dryRunText: syntheticExtractText(input.source.markdown),
    });
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
