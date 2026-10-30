// 리마인더 초안 생성 (이슈 #79). 관리자만 호출하고, 멤버 한 명 × 한 회차의 초안을 만들어 checkin_reminder_drafts에 쌓는다.
//
// 흐름: 입력 만들기(DB) → 추출(재사용 가능) → 근거 검증으로 재료 선별 → 생성 → 규칙 채점 → 저장
// 추출·생성·채점은 평가 하네스와 같은 모듈(_shared/reminder)이다. LLM 채점(judge)은 개발용이라 여기에 없다.
// 요청 `POST { session, memberId }` — session은 회고 회차. 멤버별로 부르는 이유는 ADR 0007.

import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateAdmin } from "../_shared/admin-auth.ts";
import { corsHeaders, fail, json } from "../_shared/http.ts";
import {
  createClaudeProvider,
  DEFAULT_CLAUDE_MODEL,
  LLMError,
  type LLMProvider,
} from "../_shared/reminder/claude.ts";
import {
  buildExtractRequest,
  EXTRACT_PROMPTS,
  type ExtractOutput,
  parseExtract,
} from "../_shared/reminder/extract.ts";
import {
  buildGenerateRequest,
  composeMail,
  GENERATE_PROMPTS,
  type GenerateInput,
  type GenerateOutput,
  parseGenerate,
  selectMaterials,
} from "../_shared/reminder/generate.ts";
import { ruleGrade } from "../_shared/reminder/grade.ts";
import { promptSha256, sha256 } from "../_shared/reminder/hash.ts";
import type { RetroRow } from "../_shared/reminder/source.ts";
import {
  buildNotice,
  isSession,
  isVoteOpen,
  nextMonth,
  pickPrevSource,
  type PollInfo,
  prevMonth,
} from "./input.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 추출 결과는 같은 본문·같은 추출 프롬프트면 이전 초안의 것을 재사용한다 (같은 회고를 다시 읽을 이유가 없다)
async function findReusableExtract(
  admin: SupabaseClient,
  memberId: string,
  sourceSha256: string,
  extractPromptSha256: string,
) {
  const { data } = await admin
    .from("checkin_reminder_drafts")
    .select("id, extract")
    .eq("member_id", memberId)
    .eq("extract->>sourceSha256", sourceSha256)
    .eq("extract->>promptSha256", extractPromptSha256)
    .order("created_at", { ascending: false })
    .limit(5);
  return (
    (data ?? []).find(
      (r: { extract: { result?: unknown } | null }) => r.extract?.result,
    ) ?? null
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  try {
    // --- 인증: JWT로 유저 확인 → 관리자 확인 (is_checkin_admin이 단일 출처) ---
    const auth = await authenticateAdmin(req);
    if (auth instanceof Response) return auth;
    const { user, admin } = auth;

    // --- 요청 검증 ---
    let body: { session?: unknown; memberId?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail(400, "INVALID_REQUEST", "JSON 본문이 필요합니다");
    }
    const { session, memberId } = body;
    if (
      !isSession(session) ||
      typeof memberId !== "string" ||
      !UUID_RE.test(memberId)
    ) {
      return fail(
        400,
        "INVALID_REQUEST",
        "session(YYYY-MM)과 memberId(uuid)가 필요합니다",
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return fail(500, "NO_API_KEY", "ANTHROPIC_API_KEY가 설정되지 않았습니다");
    }

    const startedAt = performance.now();

    // --- 입력 만들기 ---
    const { data: member } = await admin
      .from("checkin_members")
      .select("id, nickname")
      .eq("id", memberId)
      .maybeSingle();
    if (!member)
      return fail(404, "MEMBER_NOT_FOUND", "멤버를 찾을 수 없습니다");

    // 이번 회차에 이미 쓴 멤버는 만들지 않는다. v1 프롬프트는 "회고를 이제 쓸 수 있어요"로 여는 메일이라 맞지 않는다 (ADR 0007)
    const { data: written } = await admin
      .from("checkin_retrospectives")
      .select("id")
      .eq("member_id", memberId)
      .eq("session", session)
      .limit(1);
    if (written && written.length > 0) {
      return json(200, { ok: true, skipped: "already_written" });
    }

    const { data: question } = await admin
      .from("checkin_session_questions")
      .select("question")
      .eq("session", session)
      .eq("status", "approved")
      .maybeSingle();
    if (!question) {
      return fail(
        400,
        "QUESTION_NOT_APPROVED",
        `${session} 회차에 승인된 공통 질문이 없습니다`,
      );
    }

    const { data: prevRows, error: prevError } = await admin
      .from("checkin_retrospectives")
      .select(
        "id, title, session, member_id, content_type, parse_status, content_markdown, created_at",
      )
      .eq("member_id", memberId)
      .eq("session", prevMonth(session));
    if (prevError) {
      return fail(500, "DB_ERROR", `직전 회고 조회 실패: ${prevError.message}`);
    }
    const prev = pickPrevSource((prevRows ?? []) as RetroRow[]);

    const { data: pollRow } = await admin
      .from("checkin_vote_polls")
      .select("status, confirmed_date, confirmed_time, type, location")
      .eq("session", nextMonth(session))
      .maybeSingle();
    const poll = (pollRow as PollInfo | null) ?? null;

    const provider: LLMProvider = createClaudeProvider({
      apiKey,
      model: DEFAULT_CLAUDE_MODEL,
    });
    let tokensIn = 0;
    let tokensOut = 0;

    // --- 추출 (본문이 있을 때만) ---
    let extractOutput: ExtractOutput = { skipped: "no_source" };
    let extractRecord: Record<string, unknown> | null = null;
    let sourceSha256: string | null = null;

    if (prev.markdown !== null) {
      sourceSha256 = await sha256(prev.markdown);
      const extractPromptSha256 = await promptSha256(EXTRACT_PROMPTS);
      const reusable = await findReusableExtract(
        admin,
        memberId,
        sourceSha256,
        extractPromptSha256,
      );
      if (reusable) {
        extractRecord = { ...reusable.extract, reusedFrom: reusable.id };
        extractOutput = {
          result: (reusable.extract as { result: ExtractOutput["result"] })
            .result,
        };
      } else {
        const res = await provider.complete(
          buildExtractRequest({
            title: prev.retro!.title,
            markdown: prev.markdown,
          }),
        );
        tokensIn += res.usage.input;
        tokensOut += res.usage.output;
        const parsed = parseExtract(res.text);
        extractOutput =
          typeof parsed === "string"
            ? {
                parseError: parsed,
                raw: res.text.slice(0, 2000),
                stopReason: res.stopReason,
              }
            : { result: parsed, stopReason: res.stopReason };
        extractRecord = {
          ...extractOutput,
          promptSha256: extractPromptSha256,
          sourceSha256,
          model: res.model,
          usage: res.usage,
          latencyMs: res.latencyMs,
        };
      }
    }

    // --- 재료 선별 → 생성 ---
    const { materials, dropped } = selectMaterials(
      extractOutput,
      prev.markdown,
    );
    const voteOpen = isVoteOpen(poll);
    const input: GenerateInput = {
      name: member.nickname,
      month: `${Number(session.split("-")[1])}월`,
      voteOpen,
      commonQuestion: question.question,
      materials,
      dropped,
      notice: buildNotice(session, poll),
    };

    const gen = await provider.complete(buildGenerateRequest(input));
    tokensIn += gen.usage.input;
    tokensOut += gen.usage.output;

    const base = {
      materials: input.materials,
      voteOpen: input.voteOpen,
      commonQuestion: input.commonQuestion,
      notice: input.notice,
    };
    const parsed = parseGenerate(gen.text);
    const output: GenerateOutput =
      typeof parsed === "string"
        ? {
            ...base,
            parseError: parsed,
            raw: gen.text.slice(0, 2000),
            stopReason: gen.stopReason,
          }
        : {
            ...base,
            result: parsed,
            stopReason: gen.stopReason,
            mail: composeMail(input, parsed),
          };

    const ruleScores = ruleGrade(input, output, prev.markdown);

    // --- 저장 ---
    const { data: draft, error: insertError } = await admin
      .from("checkin_reminder_drafts")
      .insert({
        session,
        member_id: memberId,
        input: {
          ...input,
          source: {
            session: prevMonth(session),
            retroId: prev.retro?.id ?? null,
            state: prev.state,
            sha256: sourceSha256,
          },
        },
        extract: extractRecord,
        output,
        mail: output.mail ?? null,
        model: gen.model,
        prompt_sha256: await promptSha256(GENERATE_PROMPTS),
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        latency_ms: Math.round(performance.now() - startedAt),
        rule_scores: ruleScores,
        created_by: user.id,
      })
      .select()
      .single();
    if (insertError) {
      return fail(500, "DB_ERROR", `초안 저장 실패: ${insertError.message}`);
    }

    return json(200, { ok: true, draft });
  } catch (err) {
    // LLM 호출 실패는 초안을 만들지 않는다 (재시도하면 새 row 하나만 생긴다)
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
