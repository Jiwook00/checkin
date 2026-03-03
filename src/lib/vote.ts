import { supabase } from "./supabase";
import type {
  VotePoll,
  VoteResponse,
  VoteDateSelection,
  DateInfo,
} from "../types";

export async function getActivePoll(): Promise<VotePoll | null> {
  const { data } = await supabase
    .from("checkin_vote_polls")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as VotePoll | null;
}

export async function getVoteResponses(
  pollId: string,
): Promise<VoteResponse[]> {
  const { data } = await supabase
    .from("checkin_vote_responses")
    .select("*")
    .eq("poll_id", pollId);
  return (data ?? []) as VoteResponse[];
}

export async function getTotalMemberCount(): Promise<number> {
  const { count } = await supabase
    .from("checkin_members")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function upsertVoteResponse(
  pollId: string,
  memberId: string,
  mode: "available" | "unavailable",
  selectedDates: Set<number>,
  weekendHours: Record<number, Set<number>>,
  dateInfos: DateInfo[],
): Promise<{ error: string | null }> {
  const selected: VoteDateSelection[] = [];

  for (const date of selectedDates) {
    const info = dateInfos.find((d) => d.date === date);
    if (!info) continue;

    if (mode === "available") {
      if (info.isWeekend) {
        const hours = weekendHours[date]
          ? [...weekendHours[date]].sort((a, b) => a - b)
          : [];
        selected.push({ date, hours });
      } else {
        selected.push({ date, hours: [22] });
      }
    } else {
      selected.push({ date, hours: [] });
    }
  }

  const { error } = await supabase.from("checkin_vote_responses").upsert(
    {
      poll_id: pollId,
      member_id: memberId,
      mode,
      selected_dates: selected,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "poll_id,member_id" },
  );

  return { error: error?.message ?? null };
}
