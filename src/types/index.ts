export type AvatarColor =
  | "yellow"
  | "orange"
  | "green"
  | "blue"
  | "purple"
  | "red"
  | "gray"
  | "navy"
  | "pink"
  | "teal";

export type AvatarShape = "round" | "blob1" | "blob2" | "blob3";

export type AvatarEyes =
  | "dots"
  | "happy"
  | "wink"
  | "sad"
  | "crying"
  | "angry"
  | "sparkle"
  | "cross"
  | "heart"
  | "round"
  | "closed"
  | "stripe"
  | "bigdot"
  | "slash"
  | "swirl"
  | "arch";

export type AvatarNose = "none" | "dot" | "dots" | "circle" | "hook";

export type AvatarMouth =
  | "smile"
  | "grin"
  | "flat"
  | "frown"
  | "wavy"
  | "teeth"
  | "open"
  | "fang"
  | "squiggle"
  | "bigteeth"
  | "onetooth"
  | "spiky"
  | "egg"
  | "swoosh"
  | "arc"
  | "ring"
  | "ahh"
  | "laugh"
  | "pout"
  | "curl";

export interface AvatarConfig {
  color: AvatarColor;
  shape: AvatarShape;
  eyes: AvatarEyes;
  nose: AvatarNose;
  mouth: AvatarMouth;
}

export interface Retrospective {
  id: string;
  member_id: string;
  title: string;
  source_url: string | null;
  source_type: "notion" | "tistory" | "other";
  content_type: "url" | "written";
  content_html: string | null;
  content_markdown: string;
  session: string;
  presentation_order: number | null;
  avatar: AvatarConfig | null;
  created_at: string;
  updated_at: string;
  checkin_members: { nickname: string; avatar_url: string | null } | null;
}

export interface Comment {
  id: string;
  retrospective_id: string;
  member_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  checkin_members: { nickname: string; avatar_url: string | null } | null;
}

export type ReactionTargetType = "retrospective" | "comment";

export interface Reaction {
  id: string;
  target_type: ReactionTargetType;
  target_id: string;
  member_id: string;
  emoji: string;
  created_at: string;
  checkin_members: { nickname: string } | null;
}

// 반응 칩 하나로 묶인 집계 결과 (렌더 타임에 계산)
export interface ReactionGroup {
  emoji: string;
  count: number;
  mine: boolean; // 현재 유저가 이 이모지를 눌렀는지
  memberNames: string[]; // 호버 툴팁용
}

// 반응 기본 이모지 (원탭). 프리뷰 B 채택.
export const DEFAULT_REACTION_EMOJIS = ["👍", "👏🏻", "🥹", "😂", "😄"] as const;

export interface WriteArticleForm {
  title: string;
  session: string;
  content: object;
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
