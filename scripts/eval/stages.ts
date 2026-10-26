// 평가 하네스의 단계(Stage) 정의 (Deno 2.x, #74)
//
// 단계 하나 = 입력 만들기 → 실행(LLM 호출) → 채점. 하네스는 case마다 단계를 순서대로 돌리고,
// 앞 단계의 출력을 prev[단계이름]으로 다음 단계에 넘긴다. P2부터 추출·생성 단계와 채점기가 여기에 붙는다.
// 단계는 provider를 직접 부르지 못한다. 모든 호출은 ctx.call을 지나야 토큰 집계·상한·기록이 빠지지 않는다.

import type { LLMRequest, LLMResponse } from "./llm.ts";
import type { EvalCase } from "./types.ts";

export interface StageContext {
  call(req: LLMRequest): Promise<LLMResponse>;
}

// value는 0~1. LLM 채점기는 reason을 반드시 남긴다
export interface Score {
  value: number;
  reason?: string;
}

export interface Stage<I = unknown, O = unknown> {
  name: string;
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

export const STAGES: Record<string, AnyStage> = {
  [echoStage.name]: echoStage,
};
