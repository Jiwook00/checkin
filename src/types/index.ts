export interface Retrospective {
  id: string;
  member_id: string;
  title: string;
  source_url: string;
  source_type: "notion" | "tistory" | "other";
  content_html: string | null;
  content_markdown: string;
  session: string;
  presentation_order: number | null;
  created_at: string;
  updated_at: string;
  checkin_members: { nickname: string; avatar_url: string | null } | null;
}

export interface AddArticleForm {
  title: string;
  source_url: string;
  session: string;
}

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

export interface DateInfo {
  date: number;
  dayName: string;
  isWeekend: boolean;
}

export interface VotePoll {
  id: string;
  type: "online" | "offline";
  location: string | null;
  date_from: string; // "2026-03-01"
  date_to: string; // "2026-03-10"
  time_weekday: string | null; // "22:00" (온라인 전용)
  time_start: string; // "10:00"
  time_end: string; // "22:00" or "18:00"
  session: string;
  year: number;
  month: number;
  status: "open" | "closed" | "confirmed";
  confirmed_date: string | null; // "2026-03-07"
  confirmed_time: string | null; // "22:00" — 확정 시각
  meeting_url: string | null;
  meeting_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoteDateSelection {
  date: number;
  hours: number[];
}

export interface Announcement {
  id: string;
  content: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  checkin_members: { nickname: string } | null;
}

export interface VoteResponse {
  id: string;
  poll_id: string;
  member_id: string;
  selected_dates: VoteDateSelection[];
  cannot_attend: boolean;
  created_at: string;
  updated_at: string;
}

export interface TallyVoter {
  memberId: string;
  name: string;
  avatarUrl: string | null;
}

export interface TallyItem {
  date: number;
  dayName: string;
  isWeekend: boolean;
  count: number;
  time: string;
  voters: TallyVoter[];
}

export interface PollFormData {
  dateFrom: string;
  dateTo: string;
  timeWeekday: string | null;
  timeStart: string;
  timeEnd: string;
  location: string | null;
}
