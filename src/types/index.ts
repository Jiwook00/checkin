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

// 글별 참여 신호 집계 (checkin_retrospective_engagement 뷰)
export interface RetrospectiveEngagement {
  retrospective_id: string;
  comment_count: number;
  reaction_count: number;
  reaction_emojis: string[]; // 많이 눌린 순 최대 3개
}

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

// 복수 시간대(시간 그리드)로 선택하는 날인지 판정.
// - 오프라인: 모든 날 (시간 범위 기반)
// - 온라인: 주말만 (평일은 고정 시간)
export function usesHourGrid(
  isWeekend: boolean,
  pollType: "online" | "offline",
): boolean {
  return pollType === "offline" || isWeekend;
}

export interface VotePoll {
  id: string;
  type: "online" | "offline";
  location: string | null;
  date_from: string; // "2026-03-01" (dates 사용 시 목록의 최소값)
  date_to: string; // "2026-03-10" (dates 사용 시 목록의 최대값)
  dates: string[] | null; // 특정 날짜 목록 ["2026-03-07", ...]. null 이면 date_from~date_to 범위 사용

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
  dates: string[] | null; // 특정 날짜 모드일 때 목록, 범위 모드일 때 null
  timeWeekday: string | null;
  timeStart: string;
  timeEnd: string;
  location: string | null;
}
