// generate-reminders의 입력 만들기 (이슈 #79)
//
// DB 조회와 분리한 순수 함수들이다. 회차 계산, 공지 구간, 직전 회고 대표글 선택.
// 하네스의 합성 입력(scripts/eval/generate.ts의 buildNotice·pickVoteOpen)과 같은 문구 형식을 쓰되,
// 값은 해시가 아니라 실제 투표 회차(checkin_vote_polls)에서 가져온다.

import type { Notice } from "../_shared/reminder/generate.ts";
import {
  classifySource,
  compareRepresentative,
  type Retro,
  type RetroRow,
} from "../_shared/reminder/source.ts";

export const SITE = "https://monthly-checkin.vercel.app";

export function isSession(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** 회고 회차 "2026-10" → 직전 회차 "2026-09" */
export function prevMonth(session: string): string {
  const [y, m] = session.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** 회고 회차 "2026-10" → 그 모임의 투표 회차 "2026-11" (회고 회차와 투표 회차는 한 달 어긋난다) */
export function nextMonth(session: string): string {
  const [y, m] = session.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export interface PollInfo {
  status: "open" | "closed" | "confirmed";
  confirmed_date: string | null;
  confirmed_time: string | null;
  type: "online" | "offline";
  location: string | null;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "15:30" → "오후 3시 30분" */
function formatTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${h12}시${min ? ` ${min}분` : ""}`;
}

/** 투표가 열려 있는가. 생성 프롬프트(LLM)는 이 boolean만 본다 */
export function isVoteOpen(poll: PollInfo | null): boolean {
  return poll?.status === "open";
}

/**
 * 공지 구간: 글쓰기 CTA + 일정 줄. LLM이 아니라 코드가 붙인다 (ADR 0006).
 * 투표 회차가 없거나, 닫혔지만 아직 확정 전이면 일정 줄을 비운다 (날짜를 지어내지 않는다)
 */
export function buildNotice(session: string, poll: PollInfo | null): Notice {
  const month = Number(session.split("-")[1]);
  const writeLine = `${month}월 회고 쓰러 가기 → ${SITE}`;

  let scheduleLine = "";
  if (poll?.status === "open") {
    scheduleLine = `다음 모임 일정은 투표로 정하고 있어요 → ${SITE}/vote`;
  } else if (poll?.status === "confirmed" && poll.confirmed_date) {
    const d = new Date(`${poll.confirmed_date}T00:00:00Z`);
    const when = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`;
    const time = poll.confirmed_time
      ? ` ${formatTime(poll.confirmed_time)}`
      : "";
    const where =
      poll.type === "online"
        ? "온라인"
        : poll.location
          ? `오프라인 · ${poll.location}`
          : "오프라인";
    scheduleLine = `다음 모임 — ${when}${time} · ${where}`;
  }
  return { writeLine, scheduleLine };
}

export type SourceState = "none" | "failed" | "ambiguous" | "normal";

export interface PrevSource {
  retro: Retro | null;
  state: SourceState;
  // 콜백 재료를 뽑을 본문. failed·빈 본문이면 null (콜백 없이 생성)
  markdown: string | null;
}

/**
 * 직전 회차 회고 중 콜백의 재료로 쓸 글 하나. 평가셋과 같은 규칙(classifySource·compareRepresentative)이다:
 * 본문 정상 > 모호 > 실패, 긴 글, 먼저 쓴 글. 반응 수 같은 가변 기준은 쓰지 않는다 (결정적이어야 한다).
 * ambiguous(degraded, 짧은 직접 작성)는 평가셋에서 제외했던 영역이지만 쓴다. 지어낸 항목은 근거 검증이 거른다 (ADR 0007)
 */
export function pickPrevSource(rows: RetroRow[]): PrevSource {
  if (rows.length === 0) return { retro: null, state: "none", markdown: null };
  const retro = rows.map(classifySource).sort(compareRepresentative)[0];
  const usable = retro.state !== "failed" && retro.markdown.length > 0;
  return {
    retro,
    state: retro.state,
    markdown: usable ? retro.markdown : null,
  };
}
