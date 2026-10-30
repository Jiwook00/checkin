// 공통 질문 후보 제안 (이슈 #79). 관리자 화면의 "LLM 제안" 버튼이 부른다.
//
// 이미 쓴 질문(DB의 approved 전부)과 후보 뱅크를 보고 이번 회차에 어울리는 질문 3개를 이유와 함께 돌려준다.
// 가치가 낮은 기능이라 평가하지 않고 기록도 남기지 않는다 (의도). 고르는 것은 사람이다.
// 후보 규칙은 .claude/skills/galpi-reminder/SKILL.md 2단계의 규칙을 그대로 옮겼다.
// 뱅크는 프론트(src/lib/question-bank.ts)가 단일 출처라 요청 body로 받는다.
// 요청 `POST { session, bank: string[] }`

import { authenticateAdmin } from "../_shared/admin-auth.ts";
import {
  createClaudeProvider,
  DEFAULT_CLAUDE_MODEL,
  LLMError,
} from "../_shared/reminder/claude.ts";
import { corsHeaders, fail, json } from "../_shared/http.ts";

const MAX_BANK = 20;
const MAX_BANK_CHARS = 100;
const MAX_TOKENS = 1000;

const SYSTEM = `당신은 개발자 월간 회고 모임 "체크인"의 갈피입니다. 이번 달 모든 멤버에게 똑같이 건네는 공통 질문의 후보 3개를 제안합니다.

입력
- month: 이번에 쓰는 회고의 달.
- used_questions: 이미 쓴 질문들.
- bank: 후보 뱅크. 그대로 골라도 되고, 비슷한 결로 새로 만들어도 됩니다.

규칙
1. used_questions와 겹치거나 거의 같은 질문은 쓰지 않습니다.
2. 한 줄로 답해도 완성되는 가벼운 질문입니다.
3. 개발이나 성과가 아니라 안부의 온도로 묻습니다. 개발 각을 잡지 않습니다.
4. 정답이 있거나 평가가 되는 질문은 쓰지 않습니다.
5. "~는?"으로 끝나는 짧은 한 문장입니다.
6. 후보 3개는 서로 결이 다르게 합니다.

각 후보마다 reason에 이 질문을 고를 만한 이유를 한 줄로 적습니다.`;

const SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          reason: { type: "string" },
        },
        required: ["question", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
};

const squash = (s: string) => s.replace(/\s+/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  try {
    const auth = await authenticateAdmin(req);
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    let body: { session?: unknown; bank?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail(400, "INVALID_REQUEST", "JSON 본문이 필요합니다");
    }
    const { session, bank } = body;
    if (
      typeof session !== "string" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(session) ||
      !Array.isArray(bank) ||
      bank.length > MAX_BANK ||
      !bank.every((q) => typeof q === "string" && q.length <= MAX_BANK_CHARS)
    ) {
      return fail(
        400,
        "INVALID_REQUEST",
        `session(YYYY-MM)과 bank(문자열 ${MAX_BANK}개 이하, 각 ${MAX_BANK_CHARS}자 이하)가 필요합니다`,
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return fail(500, "NO_API_KEY", "ANTHROPIC_API_KEY가 설정되지 않았습니다");
    }

    const { data: used, error } = await admin
      .from("checkin_session_questions")
      .select("question")
      .order("session", { ascending: true });
    if (error) {
      return fail(500, "DB_ERROR", `기존 질문 조회 실패: ${error.message}`);
    }
    const usedQuestions = (used ?? []).map(
      (r: { question: string }) => r.question,
    );

    const provider = createClaudeProvider({
      apiKey,
      model: DEFAULT_CLAUDE_MODEL,
    });
    const res = await provider.complete({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `<month>${Number(session.split("-")[1])}월</month>
<used_questions>
${usedQuestions.map((q: string) => `- ${q}`).join("\n") || "없음"}
</used_questions>
<bank>
${(bank as string[]).map((q) => `- ${q}`).join("\n") || "없음"}
</bank>`,
        },
      ],
      maxTokens: MAX_TOKENS,
      jsonSchema: SCHEMA,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.text);
    } catch {
      return fail(502, "llm_invalid_output", "후보를 읽지 못했어요");
    }
    const raw = (parsed as { candidates?: unknown })?.candidates;
    if (!Array.isArray(raw)) {
      return fail(502, "llm_invalid_output", "후보를 읽지 못했어요");
    }
    // 이미 쓴 질문과 같은 후보는 모델이 어겨도 코드가 거른다
    const usedKeys = new Set(usedQuestions.map(squash));
    const candidates = raw
      .filter(
        (c): c is { question: string; reason: string } =>
          typeof c?.question === "string" &&
          typeof c?.reason === "string" &&
          c.question.trim().length > 0 &&
          !usedKeys.has(squash(c.question)),
      )
      .slice(0, 3)
      .map((c) => ({ question: c.question.trim(), reason: c.reason.trim() }));
    if (candidates.length === 0) {
      return fail(502, "llm_invalid_output", "쓸 만한 후보가 없었어요");
    }

    return json(200, { ok: true, candidates, usage: res.usage });
  } catch (err) {
    if (err instanceof LLMError) {
      return fail(502, `llm_${err.kind}`, err.message);
    }
    return fail(
      500,
      "INTERNAL",
      err instanceof Error ? err.message.slice(0, 200) : "알 수 없는 오류",
    );
  }
});
