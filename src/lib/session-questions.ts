import { supabase } from "./supabase";
import type { SessionQuestions } from "../types";

// 승인된 공통 질문을 회고 세션별로 한 번에 가져온다. RLS도 approved만 허용하지만 의도를 코드에도 남긴다
export async function fetchSessionQuestions(): Promise<SessionQuestions> {
  const { data, error } = await supabase
    .from("checkin_session_questions")
    .select("session, question")
    .eq("status", "approved");
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.session, r.question]));
}
