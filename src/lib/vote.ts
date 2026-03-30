import { supabase } from "./supabase";
import type {
  VotePoll,
  VoteResponse,
  VoteDateSelection,
  DateInfo,
} from "../types";

const AVATAR_COLORS = [
  "bg-sky-400",
  "bg-violet-400",
  "bg-rose-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-pink-400",
  "bg-indigo-400",
  "bg-teal-400",
];

export function memberColorClass(memberId: string): string {
  let hash = 0;
  for (let i = 0; i < memberId.length; i++) {
    hash = (hash * 31 + memberId.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export async function getActivePoll(): Promise<VotePoll | null> {
  // open poll 우선, 없으면 가장 최근 confirmed
  const { data: openPoll } = await supabase
    .from("checkin_vote_polls")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openPoll) return openPoll as VotePoll;

  const { data: confirmedPoll } = await supabase
    .from("checkin_vote_polls")
    .select("*")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return confirmedPoll as VotePoll | null;
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

export interface MemberInfo {
  nickname: string;
  avatarUrl: string | null;
}

export async function getMemberInfo(): Promise<Record<string, MemberInfo>> {
  const { data } = await supabase
    .from("checkin_members")
    .select("id, nickname, avatar_url");
  const map: Record<string, MemberInfo> = {};
  for (const m of data ?? []) {
    map[m.id as string] = {
      nickname: m.nickname as string,
      avatarUrl: (m.avatar_url as string | null) ?? null,
    };
  }
  return map;
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

  // 기존 open/confirmed poll을 모두 closed로 전환
  await supabase
    .from("checkin_vote_polls")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .in("status", ["open", "confirmed"]);

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
  confirmedTime: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("checkin_vote_polls")
    .update({
      status: "confirmed",
      confirmed_date: confirmedDate,
      confirmed_time: confirmedTime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pollId);
  return { error: error?.message ?? null };
}

export interface UpdatePollMetaData {
  location?: string | null;
  meeting_url?: string | null;
  meeting_password?: string | null;
}

export async function updatePollMeta(
  pollId: string,
  data: UpdatePollMetaData,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("checkin_vote_polls")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", pollId);
  return { error: error?.message ?? null };
}

export interface UpdatePollScheduleData {
  date_from: string;
  date_to: string;
  time_weekday: string | null;
  time_start: string;
  time_end: string;
}

export async function updatePollSchedule(
  pollId: string,
  data: UpdatePollScheduleData,
): Promise<{ error: string | null }> {
  const fromDate = new Date(data.date_from + "T00:00:00");
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth() + 1;
  const session = `${year}-${String(month).padStart(2, "0")}`;

  const { error } = await supabase
    .from("checkin_vote_polls")
    .update({
      ...data,
      year,
      month,
      session,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pollId);
  return { error: error?.message ?? null };
}

export async function deletePoll(
  pollId: string,
): Promise<{ error: string | null }> {
  await supabase.from("checkin_vote_responses").delete().eq("poll_id", pollId);
  const { error } = await supabase
    .from("checkin_vote_polls")
    .delete()
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
  cannotAttend: boolean = false,
): Promise<{ error: string | null }> {
  const weekdayHour = poll.time_weekday
    ? parseInt(poll.time_weekday.split(":")[0])
    : 22;

  const selected: VoteDateSelection[] = [];
  if (!cannotAttend) {
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
  }

  const { error } = await supabase.from("checkin_vote_responses").upsert(
    {
      poll_id: pollId,
      member_id: memberId,
      selected_dates: selected,
      cannot_attend: cannotAttend,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "poll_id,member_id" },
  );

  return { error: error?.message ?? null };
}
