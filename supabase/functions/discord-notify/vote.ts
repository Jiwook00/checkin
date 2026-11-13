// 일정 투표 공지 (이슈 #100). 세 시점 모두 ref_id = poll id 라서 시점마다 한 번만 나간다
//
// - vote_opened        : 투표 생성 직후 (트리거). 후보 날짜·방식·마감일·투표 링크
// - vote_deadline_soon : vote_deadline 전날 (pg_cron). 남은 인원 수만 알리고 이름은 쓰지 않는다
// - vote_confirmed     : 관리자가 확정 (트리거). 날짜·시간·장소
//
// 회의 링크·비밀번호는 넣지 않는다. 웹앱은 멤버 전용이고, 디스코드 채널에 복사하면 웹앱 밖에 남는다

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMBED_COLOR,
  type WebhookPayload,
} from "../_shared/discord/webhook.ts";

export const VOTE_EVENT_TYPES = [
  "vote_opened",
  "vote_deadline_soon",
  "vote_confirmed",
] as const;
export type VoteEventType = (typeof VOTE_EVENT_TYPES)[number];

export interface PollRow {
  id: string;
  type: "online" | "offline";
  status: "open" | "closed" | "confirmed";
  month: number;
  location: string | null;
  date_from: string;
  date_to: string;
  dates: string[] | null;
  vote_deadline: string | null;
  confirmed_date: string | null;
  confirmed_time: string | null;
}

export const POLL_COLUMNS =
  "id, type, status, month, location, date_from, date_to, dates, vote_deadline, confirmed_date, confirmed_time";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function parseYmd(value: string): { month: number; day: number; dow: string } {
  const [y, m, d] = value.split("-").map(Number);
  const dow = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return { month: m, day: d, dow };
}

/** "11월 14일(토)" */
export function formatDate(value: string): string {
  const { month, day, dow } = parseYmd(value);
  return `${month}월 ${day}일(${dow})`;
}

/** 같은 달이면 뒤쪽 날짜의 "n월"을 뺀다: "11월 7일(토) ~ 15일(일)" */
function formatCandidates(poll: PollRow): string {
  const shorten = (value: string, prevMonth: number) => {
    const { month, day, dow } = parseYmd(value);
    return month === prevMonth ? `${day}일(${dow})` : formatDate(value);
  };
  const firstMonth = parseYmd(poll.date_from).month;

  if (poll.dates && poll.dates.length > 0) {
    const [first, ...rest] = poll.dates;
    return [formatDate(first), ...rest.map((d) => shorten(d, firstMonth))].join(
      " · ",
    );
  }
  return `${formatDate(poll.date_from)} ~ ${shorten(poll.date_to, firstMonth)}`;
}

function formatMode(poll: PollRow): string {
  if (poll.type === "online") return "온라인";
  return poll.location ? `오프라인 · ${poll.location}` : "오프라인";
}

export function voteOpenedPayload(
  poll: PollRow,
  siteUrl: string,
): WebhookPayload {
  const fields = [
    { name: "후보 날짜", value: formatCandidates(poll) },
    { name: "방식", value: formatMode(poll), inline: true },
  ];
  if (poll.vote_deadline) {
    fields.push({
      name: "마감",
      value: `${formatDate(poll.vote_deadline)}까지`,
      inline: true,
    });
  }
  return {
    embeds: [
      {
        title: `${poll.month}월 회고 일정 투표가 열렸어요`,
        description: "가능한 날짜를 골라주세요.",
        url: `${siteUrl}/vote`,
        color: EMBED_COLOR,
        fields,
      },
    ],
  };
}

export function voteDeadlineSoonPayload(
  poll: PollRow & { vote_deadline: string },
  remaining: number,
  siteUrl: string,
): WebhookPayload {
  return {
    embeds: [
      {
        title: `${poll.month}월 회고 일정 투표가 내일 마감돼요`,
        description: `아직 ${remaining}명 남았어요. ${formatDate(poll.vote_deadline)}까지 투표해주세요.`,
        url: `${siteUrl}/vote`,
        color: EMBED_COLOR,
      },
    ],
  };
}

export function voteConfirmedPayload(
  poll: PollRow & { confirmed_date: string },
  siteUrl: string,
): WebhookPayload {
  const fields = [
    { name: "날짜", value: formatDate(poll.confirmed_date), inline: true },
  ];
  if (poll.confirmed_time) {
    fields.push({ name: "시간", value: poll.confirmed_time, inline: true });
  }
  fields.push({ name: "방식", value: formatMode(poll), inline: true });
  return {
    embeds: [
      {
        title: `${poll.month}월 회고 일정이 정해졌어요`,
        url: `${siteUrl}/vote`,
        color: EMBED_COLOR,
        fields,
      },
    ],
  };
}

/** 아직 응답하지 않은 멤버 수. 불참 응답도 응답으로 센다. 누가 남았는지는 돌려주지 않는다 */
export async function countRemaining(
  admin: SupabaseClient,
  pollId: string,
): Promise<number | null> {
  const [members, responses] = await Promise.all([
    admin.from("checkin_members").select("id"),
    admin
      .from("checkin_vote_responses")
      .select("member_id")
      .eq("poll_id", pollId),
  ]);
  if (members.error || responses.error) return null;
  const responded = new Set(
    (responses.data ?? []).map((r) => r.member_id as string),
  );
  return (members.data ?? []).filter((m) => !responded.has(m.id as string))
    .length;
}
