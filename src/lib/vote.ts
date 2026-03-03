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
    .in("status", ["open", "confirmed"])
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

export interface CreatePollData {
  type: "online" | "offline";
  location: string | null;
  date_from: string;
  date_to: string;
  time_weekday: string | null;
  time_start: string;
  time_end: string;
}

export async function createPoll(
  data: CreatePollData,
): Promise<{ poll: VotePoll | null; error: string | null }> {
  const fromDate = new Date(data.date_from + "T00:00:00");
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth() + 1;
  const session = `${year}-${String(month).padStart(2, "0")}`;

  const { data: poll, error } = await supabase
    .from("checkin_vote_polls")
    .insert({
      type: data.type,
      location: data.location,
      date_from: data.date_from,
      date_to: data.date_to,
      time_weekday: data.time_weekday,
      time_start: data.time_start,
      time_end: data.time_end,
      session,
      year,
      month,
    })
    .select()
    .single();

  return { poll: poll as VotePoll | null, error: error?.message ?? null };
}

export async function confirmPoll(
  pollId: string,
  confirmedDate: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("checkin_vote_polls")
    .update({
      status: "confirmed",
      confirmed_date: confirmedDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pollId);
  return { error: error?.message ?? null };
}

export async function upsertVoteResponse(
  pollId: string,
  memberId: string,
  selectedDates: Set<number>,
  weekendHours: Record<number, Set<number>>,
  dateInfos: DateInfo[],
  poll: VotePoll,
): Promise<{ error: string | null }> {
  const weekdayHour = poll.time_weekday
    ? parseInt(poll.time_weekday.split(":")[0])
    : 22;

  const selected: VoteDateSelection[] = [];
  for (const date of selectedDates) {
    const info = dateInfos.find((d) => d.date === date);
    if (!info) continue;

    if (info.isWeekend) {
      const hours = weekendHours[date]
        ? [...weekendHours[date]].sort((a, b) => a - b)
        : [];
      selected.push({ date, hours });
    } else {
      selected.push({ date, hours: [weekdayHour] });
    }
  }

  const { error } = await supabase.from("checkin_vote_responses").upsert(
    {
      poll_id: pollId,
      member_id: memberId,
      selected_dates: selected,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "poll_id,member_id" },
  );

  return { error: error?.message ?? null };
}
