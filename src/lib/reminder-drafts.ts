import { supabase } from "./supabase";
import { QUESTION_BANK } from "./question-bank";
import type { ReminderDraft, ReminderDraftStatus } from "../types";

// 관리자 리마인더 화면(#79)의 데이터 호출. 쓰기 권한은 서버가 is_checkin_admin()으로 막는다 (RLS · Edge Function)

export interface AdminMember {
  id: string;
  nickname: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

// Edge Function은 실패 시 { ok: false, error_code, message }를 non-2xx로 돌려준다. 본문의 message를 꺼내 쓴다
async function invoke<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<Result<T>> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.json();
        if (typeof payload?.message === "string") message = payload.message;
      } catch {
        // 본문이 JSON이 아니면 기본 메시지를 쓴다
      }
    }
    return { ok: false, message };
  }
  if (data?.ok === false) {
    return { ok: false, message: data.message ?? "요청에 실패했어요" };
  }
  return { ok: true, data: data as T };
}

export async function fetchMembers(): Promise<AdminMember[]> {
  const { data } = await supabase
    .from("checkin_members")
    .select("id, nickname")
    .order("nickname");
  return data ?? [];
}

// 같은 멤버·회차의 초안은 생성할 때마다 쌓인다. 화면에는 멤버별로 가장 최근 것만 보여 준다
export async function fetchLatestDrafts(
  session: string,
): Promise<ReminderDraft[]> {
  const { data } = await supabase
    .from("checkin_reminder_drafts")
    .select("*")
    .eq("session", session)
    .order("created_at", { ascending: false });
  const latest = new Map<string, ReminderDraft>();
  for (const draft of (data ?? []) as ReminderDraft[]) {
    if (!latest.has(draft.member_id)) latest.set(draft.member_id, draft);
  }
  return [...latest.values()];
}

export type GenerateResult =
  | { kind: "draft"; draft: ReminderDraft }
  | { kind: "skipped" };

export async function generateDraft(
  session: string,
  memberId: string,
): Promise<Result<GenerateResult>> {
  const res = await invoke<{ draft?: ReminderDraft; skipped?: string }>(
    "generate-reminders",
    { session, memberId },
  );
  if (!res.ok) return res;
  if (res.data.draft) {
    return { ok: true, data: { kind: "draft", draft: res.data.draft } };
  }
  return { ok: true, data: { kind: "skipped" } };
}

export interface ReviewInput {
  status: ReminderDraftStatus;
  editedMail?: string | null;
  note?: string | null;
}

export async function reviewDraft(
  id: string,
  review: ReviewInput,
): Promise<Result<Partial<ReminderDraft>>> {
  const patch = {
    status: review.status,
    edited_mail: review.editedMail ?? null,
    review_note: review.note?.trim() || null,
    // draft로 되돌리면 검토 시각도 비운다 (DB 제약: draft일 때만 reviewed_at이 비어 있다)
    reviewed_at: review.status === "draft" ? null : new Date().toISOString(),
  };
  const { error } = await supabase
    .from("checkin_reminder_drafts")
    .update(patch)
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: patch };
}

export interface QuestionSuggestion {
  question: string;
  reason: string;
}

export async function suggestQuestions(
  session: string,
): Promise<Result<QuestionSuggestion[]>> {
  const res = await invoke<{ candidates: QuestionSuggestion[] }>(
    "suggest-questions",
    { session, bank: QUESTION_BANK },
  );
  return res.ok ? { ok: true, data: res.data.candidates } : res;
}

// 질문을 승인한다. 승인하는 순간 글 등록 화면과 홈 배너에 보인다 (회차당 하나, 이미 있으면 바꾼다)
export async function approveSessionQuestion(
  session: string,
  question: string,
  memberId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("checkin_session_questions").upsert(
    {
      session,
      question: question.trim(),
      status: "approved",
      approved_at: new Date().toISOString(),
      created_by: memberId,
    },
    { onConflict: "session" },
  );
  return error ? { ok: false, message: error.message } : { ok: true };
}
