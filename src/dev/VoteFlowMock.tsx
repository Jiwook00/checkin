// DEV ONLY — 전체 플로우 모킹 테스트 (새 데이터 구조 기준)
// MockPoll: type, location, date_from, date_to, time 필드 포함
// MockResponse: mode 컬럼 없음
// /dev/5 에서 접근
import { useReducer, useState } from "react";
import { DAY_NAMES, type DateInfo, type VoteDateSelection } from "../types";
import { Switcher } from "./shared";

// ── 새 데이터 구조 (API 응답 형태) ───────────────────────────────────────────

interface MockPoll {
  id: string;
  type: "online" | "offline";
  location: string; // 온라인: 화상회의 링크, 오프라인: 장소명
  date_from: string; // "2026-03-01"
  date_to: string; // "2026-03-10"
  time_weekday: string | null; // "22:00" (온라인 전용, 오프라인 null)
  time_start: string; // "10:00"
  time_end: string; // "22:00" or "18:00"
  status: "open" | "confirmed";
  confirmed_date: string | null;
  year: number;
  month: number;
}

interface MockResponse {
  id: string;
  poll_id: string;
  member_id: string;
  selected_dates: VoteDateSelection[]; // mode 필드 없음
}

interface TallyItem {
  date: number;
  dayName: string;
  isWeekend: boolean;
  count: number;
  time: string;
}

type PollFormData = {
  type: "online" | "offline";
  location: string;
  dateFrom: string;
  dateTo: string;
  timeWeekday: string | null;
  timeStart: string;
  timeEnd: string;
};

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function buildDatesInRange(dateFrom: string, dateTo: string): DateInfo[] {
  const fromMs = new Date(dateFrom + "T00:00:00").getTime();
  const toMs = new Date(dateTo + "T00:00:00").getTime();
  const DAY_MS = 86_400_000;
  const dates: DateInfo[] = [];
  for (let ms = fromMs; ms <= toMs; ms += DAY_MS) {
    const d = new Date(ms);
    const dow = d.getDay();
    dates.push({
      date: d.getDate(),
      dayName: DAY_NAMES[dow],
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return dates;
}

function buildCalendarRows(year: number, month: number): (number | null)[][] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function getWeekendHours(poll: MockPoll): number[] {
  const start = parseInt(poll.time_start);
  const end = parseInt(poll.time_end);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function getWeekdayHour(poll: MockPoll): number {
  return parseInt(poll.time_weekday ?? "22");
}

function isDateClickable(dateInfo: DateInfo, poll: MockPoll): boolean {
  // 오프라인 poll은 주말만 클릭 가능
  if (poll.type === "offline" && !dateInfo.isWeekend) return false;
  return true;
}

// ── 집계 함수 ─────────────────────────────────────────────────────────────────

function computeWeekdayVotes(
  responses: MockResponse[],
  dates: DateInfo[],
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const { date } of dates.filter((d) => !d.isWeekend)) {
    let count = 0;
    for (const r of responses) {
      if (r.selected_dates.some((s) => s.date === date)) count++;
    }
    if (count > 0) result[date] = count;
  }
  return result;
}

function computeWeekendHourVotes(
  responses: MockResponse[],
  dates: DateInfo[],
): Record<number, Record<number, number>> {
  const result: Record<number, Record<number, number>> = {};
  for (const { date } of dates.filter((d) => d.isWeekend)) {
    for (const r of responses) {
      const sel = r.selected_dates.find((s) => s.date === date);
      if (sel) {
        for (const hour of sel.hours) {
          if (!result[date]) result[date] = {};
          result[date][hour] = (result[date][hour] ?? 0) + 1;
        }
      }
    }
  }
  return result;
}

function computeVoteTally(
  responses: MockResponse[],
  dates: DateInfo[],
  poll: MockPoll,
): TallyItem[] {
  return dates
    .map((dateInfo) => {
      const responding = responses.filter((r) =>
        r.selected_dates.some((s) => s.date === dateInfo.date),
      );
      if (responding.length === 0) return null;

      let time: string;
      if (!dateInfo.isWeekend) {
        time = poll.time_weekday ?? "22:00";
      } else {
        const hourCounts: Record<number, number> = {};
        for (const r of responding) {
          const sel = r.selected_dates.find((s) => s.date === dateInfo.date);
          for (const h of sel?.hours ?? []) {
            hourCounts[h] = (hourCounts[h] ?? 0) + 1;
          }
        }
        const entries = Object.entries(hourCounts);
        if (entries.length > 0) {
          const topHour = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
          time = `${topHour}:00`;
        } else {
          time = poll.time_start;
        }
      }
      return {
        date: dateInfo.date,
        dayName: dateInfo.dayName,
        isWeekend: dateInfo.isWeekend,
        count: responding.length,
        time,
      };
    })
    .filter((item): item is TallyItem => item !== null)
    .sort((a, b) => b.count - a.count);
}

// ── Vote 상태 관리 (useReducer) ───────────────────────────────────────────────

interface VoteState {
  selectedDates: Set<number>;
  weekendHours: Record<number, Set<number>>;
  activeDate: number | null;
  saved: boolean;
}

type VoteAction =
  | { type: "TOGGLE_DATE"; date: number }
  | { type: "TOGGLE_HOUR"; date: number; hour: number }
  | { type: "SET_ACTIVE_DATE"; date: number | null }
  | { type: "MARK_SAVED" }
  | { type: "MARK_UNSAVED" }
  | { type: "RESET" };

function voteReducer(state: VoteState, action: VoteAction): VoteState {
  switch (action.type) {
    case "TOGGLE_DATE": {
      const next = new Set(state.selectedDates);
      const nextHours = { ...state.weekendHours };
      if (next.has(action.date)) {
        next.delete(action.date);
        delete nextHours[action.date];
      } else {
        next.add(action.date);
      }
      return {
        ...state,
        selectedDates: next,
        weekendHours: nextHours,
        activeDate: action.date,
        saved: false,
      };
    }
    case "TOGGLE_HOUR": {
      const cur = state.weekendHours[action.date]
        ? new Set(state.weekendHours[action.date])
        : new Set<number>();
      if (cur.has(action.hour)) cur.delete(action.hour);
      else cur.add(action.hour);
      const nextDates = new Set(state.selectedDates);
      nextDates.add(action.date);
      return {
        ...state,
        selectedDates: nextDates,
        weekendHours: { ...state.weekendHours, [action.date]: cur },
        saved: false,
      };
    }
    case "SET_ACTIVE_DATE":
      return { ...state, activeDate: action.date };
    case "MARK_SAVED":
      return { ...state, saved: true };
    case "MARK_UNSAVED":
      return { ...state, saved: false };
    case "RESET":
      return {
        selectedDates: new Set(),
        weekendHours: {},
        activeDate: null,
        saved: false,
      };
    default:
      return state;
  }
}

const initialVoteState: VoteState = {
  selectedDates: new Set(),
  weekendHours: {},
  activeDate: null,
  saved: false,
};

// ── 목 멤버 ───────────────────────────────────────────────────────────────────

const MOCK_ME_ID = "me";
const MOCK_MEMBERS = [
  { id: "m1", name: "김민준" },
  { id: "m2", name: "이서연" },
  { id: "m3", name: "박지호" },
  { id: "m4", name: "최유나" },
];
const TOTAL_MEMBERS = MOCK_MEMBERS.length + 1; // me + others

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function VoteFlowMock() {
  const [poll, setPoll] = useState<MockPoll | null>(null);
  const [responses, setResponses] = useState<MockResponse[]>([]);
  const [createStep, setCreateStep] = useState<"preset" | "form" | null>(null);
  const [pollType, setPollType] = useState<"online" | "offline">("online");
  const [closePhase, setClosePhase] = useState<"dialog" | "date-modal" | null>(
    null,
  );
  const [confirmedDate, setConfirmedDate] = useState<number | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);

  const [voteState, dispatch] = useReducer(voteReducer, initialVoteState);
  const { selectedDates, weekendHours, activeDate, saved } = voteState;

  // ── 파생 값 ──────────────────────────────────────────────────────────────────
  const dates = poll ? buildDatesInRange(poll.date_from, poll.date_to) : [];
  const calendarRows = poll ? buildCalendarRows(poll.year, poll.month) : [];
  const weekendHourRange = poll ? getWeekendHours(poll) : [];
  const otherResponses = responses.filter((r) => r.member_id !== MOCK_ME_ID);
  const weekdayVotes = poll ? computeWeekdayVotes(otherResponses, dates) : {};
  const weekendHourVotes = poll
    ? computeWeekendHourVotes(otherResponses, dates)
    : {};
  const voteTally = poll ? computeVoteTally(responses, dates, poll) : [];
  const respondedCount = new Set(responses.map((r) => r.member_id)).size;
  const activeDateInfo = dates.find((d) => d.date === activeDate);
  const maxVoteCount =
    Object.values(weekdayVotes).length > 0
      ? Math.max(...Object.values(weekdayVotes))
      : 0;

  const canSave = (() => {
    if (selectedDates.size === 0) return false;
    for (const date of selectedDates) {
      const info = dates.find((d) => d.date === date);
      if (info?.isWeekend && !(weekendHours[date]?.size > 0)) return false;
    }
    return true;
  })();

  const getSummaryLines = () =>
    dates
      .filter((d) => selectedDates.has(d.date))
      .map((d) => {
        if (!d.isWeekend)
          return `${d.date}일 (${d.dayName}) ${poll?.time_weekday ?? "22:00"}`;
        const h = weekendHours[d.date];
        const hList =
          h && h.size > 0
            ? [...h]
                .sort((a, b) => a - b)
                .map((hr) => `${hr}시`)
                .join(" · ")
            : "시간 미선택";
        return `${d.date}일 (${d.dayName}) — ${hList}`;
      });

  // ── 핸들러 ───────────────────────────────────────────────────────────────────

  const handleCreatePoll = (data: PollFormData) => {
    const from = new Date(data.dateFrom + "T00:00:00");
    setPoll({
      id: "mock-poll-1",
      type: data.type,
      location: data.location,
      date_from: data.dateFrom,
      date_to: data.dateTo,
      time_weekday: data.timeWeekday,
      time_start: data.timeStart,
      time_end: data.timeEnd,
      status: "open",
      confirmed_date: null,
      year: from.getFullYear(),
      month: from.getMonth() + 1,
    });
    setCreateStep(null);
    dispatch({ type: "RESET" });
  };

  const handleSaveVote = () => {
    if (!poll) return;
    const selected: VoteDateSelection[] = [...selectedDates].map((date) => {
      const info = dates.find((d) => d.date === date)!;
      const hours = info.isWeekend
        ? [...(weekendHours[date] ?? new Set<number>())].sort((a, b) => a - b)
        : [getWeekdayHour(poll)];
      return { date, hours };
    });
    setResponses((prev) => {
      const without = prev.filter((r) => r.member_id !== MOCK_ME_ID);
      if (selected.length === 0) return without;
      return [
        ...without,
        {
          id: "my-response",
          poll_id: poll.id,
          member_id: MOCK_ME_ID,
          selected_dates: selected,
        },
      ];
    });
    dispatch({ type: "MARK_SAVED" });
  };

  const handleConfirm = () => {
    if (!confirmedDate || !poll) return;
    const d = confirmedDate.toString().padStart(2, "0");
    const m = poll.month.toString().padStart(2, "0");
    setPoll((prev) =>
      prev
        ? {
            ...prev,
            status: "confirmed",
            confirmed_date: `${prev.year}-${m}-${d}`,
          }
        : null,
    );
    setClosePhase(null);
  };

  // 다른 멤버 투표 추가 (Dev Panel 전용)
  const addMockVotes = (preset: "weekday-heavy" | "mixed") => {
    if (!poll) return;
    const newResponses: MockResponse[] = MOCK_MEMBERS.map((member, i) => {
      let selected: VoteDateSelection[];
      if (preset === "weekday-heavy") {
        // 모두 평일 투표 (온라인) 또는 모두 첫 주말 (오프라인)
        selected = dates
          .filter((d) =>
            poll.type === "online" ? !d.isWeekend : d.isWeekend && d.date <= 9,
          )
          .map((d) => ({
            date: d.date,
            hours: d.isWeekend
              ? [parseInt(poll.time_start)]
              : [getWeekdayHour(poll)],
          }));
      } else {
        // 혼합: 멤버별로 다른 날짜 선택
        const allClickable = dates.filter((d) => isDateClickable(d, poll));
        selected = allClickable
          .filter((_, idx) => (idx + i) % 3 !== 0)
          .map((d) => ({
            date: d.date,
            hours: d.isWeekend
              ? [parseInt(poll.time_start), parseInt(poll.time_start) + 2]
              : [getWeekdayHour(poll)],
          }));
      }
      return {
        id: `response-${member.id}`,
        poll_id: poll.id,
        member_id: member.id,
        selected_dates: selected,
      };
    });
    setResponses((prev) => [
      ...prev.filter((r) => r.member_id === MOCK_ME_ID),
      ...newResponses,
    ]);
  };

  const handleReset = () => {
    setPoll(null);
    setResponses([]);
    setCreateStep(null);
    setClosePhase(null);
    setConfirmedDate(null);
    dispatch({ type: "RESET" });
  };

  // ── 렌더 ──────────────────────────────────────────────────────────────────────

  const confirmedTallyItem = voteTally.find((t) => t.date === confirmedDate);

  const MONTH_KO = poll ? `${poll.year}년 ${poll.month}월` : "";
  const retroMonth = poll ? (poll.month === 1 ? 12 : poll.month - 1) : 0;
  const retroYear = poll ? (poll.month === 1 ? poll.year - 1 : poll.year) : 0;
  const sessionLabel = poll
    ? `${poll.month}월에 하는 ${retroYear}년 ${retroMonth}월 회고`
    : "";

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            {poll && (
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
                {sessionLabel}
              </span>
            )}
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {poll && (
              <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-3 py-1.5">
                {respondedCount}/{TOTAL_MEMBERS}명 응답 완료
              </span>
            )}
            {poll?.status === "open" && closePhase === null && (
              <button
                onClick={() => setClosePhase("dialog")}
                className="text-xs text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 hover:border-stone-400 transition-all"
              >
                일정 마감
              </button>
            )}
            {poll?.status === "confirmed" && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-3 py-1.5">
                확정됨
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* ── poll 없음: 생성 플로우 ── */}
        {!poll && createStep === null && (
          <div className="py-14">
            <EmptyState onStart={() => setCreateStep("preset")} />
          </div>
        )}
        {!poll && createStep === "preset" && (
          <div className="py-6">
            <PresetSelect
              onSelect={(type) => {
                setPollType(type);
                setCreateStep("form");
              }}
              onBack={() => setCreateStep(null)}
            />
          </div>
        )}
        {!poll && createStep === "form" && (
          <div className="py-6">
            <PollForm
              pollType={pollType}
              onBack={() => setCreateStep("preset")}
              onSubmit={handleCreatePoll}
            />
          </div>
        )}

        {/* ── poll 확정 완료 화면 ── */}
        {poll?.status === "confirmed" && confirmedTallyItem && (
          <div className="text-center">
            <div className="bg-white rounded-2xl border border-emerald-200 p-8 max-w-sm mx-auto">
              <div className="text-4xl mb-4">🎉</div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">
                일정 확정
              </p>
              <p className="text-2xl font-black text-stone-900 mb-1">
                {poll.month}월 {confirmedTallyItem.date}일 (
                {confirmedTallyItem.dayName})
              </p>
              <p className="text-lg font-bold text-stone-600 mb-4">
                {confirmedTallyItem.time} 시작
              </p>
              {poll.location && (
                <p className="text-xs text-stone-500 mb-3 bg-stone-50 rounded-lg px-3 py-2">
                  📍 {poll.location}
                </p>
              )}
              <p className="text-sm text-stone-400 mb-3">
                {confirmedTallyItem.count}명이 참여 가능한 날짜예요
              </p>
              <div className="flex justify-center gap-1">
                {Array.from({ length: TOTAL_MEMBERS }, (_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-sm ${i < confirmedTallyItem.count ? "bg-emerald-500" : "bg-stone-200"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── poll 투표 중 ── */}
        {poll?.status === "open" && (
          <>
            <p className="text-xs text-stone-400 mb-5">
              {poll.type === "online"
                ? "가능한 날짜를 선택하세요. 평일은 22:00, 주말은 시간도 선택해주세요."
                : "가능한 날짜를 선택하세요. 참여 가능한 시간대를 선택해주세요."}
            </p>

            <div className="grid grid-cols-[1fr_1.15fr] gap-6 items-start">
              {/* 왼쪽: 달력 */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-stone-800">
                    {MONTH_KO}
                  </span>
                  <span className="text-xs text-stone-400 bg-stone-50 rounded-full px-2 py-0.5">
                    {poll.date_from.slice(8)}일 ~ {poll.date_to.slice(8)}일
                  </span>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {DAY_NAMES.map((d, i) => (
                    <div
                      key={d}
                      className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-stone-400"}`}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                {calendarRows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-7">
                    {row.map((day, di) => {
                      if (!day)
                        return <div key={di} className="aspect-square" />;
                      const dateInfo = dates.find((d) => d.date === day);
                      const inRange = !!dateInfo;
                      const clickable =
                        inRange && isDateClickable(dateInfo!, poll);
                      const isMarked = selectedDates.has(day);
                      const isActive = activeDate === day;
                      const isSun = di === 0;
                      const isSat = di === 6;
                      const isWeekend = dateInfo?.isWeekend ?? false;
                      const weekdayCount = !isWeekend
                        ? (weekdayVotes[day] ?? 0)
                        : 0;
                      const weekendMaxCount =
                        isWeekend && weekendHourVotes[day]
                          ? Math.max(...Object.values(weekendHourVotes[day]))
                          : 0;
                      const isTopVote =
                        weekdayCount === maxVoteCount && weekdayCount > 0;

                      if (!inRange || !clickable) {
                        return (
                          <div
                            key={di}
                            className={`aspect-square flex items-center justify-center text-xs ${isSun ? "text-red-200" : isSat ? "text-blue-200" : "text-stone-200"}`}
                          >
                            {day}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={di}
                          onClick={() =>
                            dispatch({ type: "TOGGLE_DATE", date: day })
                          }
                          className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg transition-all
                            ${isMarked ? "bg-stone-900 text-white" : isActive ? "ring-2 ring-stone-300 text-stone-800 font-semibold" : isTopVote ? "bg-emerald-50 ring-1 ring-emerald-200 text-stone-900" : "hover:bg-stone-50 text-stone-700 font-medium"}
                            ${isWeekend && !isMarked && !isActive && isSun ? "text-red-500" : ""}
                            ${isWeekend && !isMarked && !isActive && isSat ? "text-blue-500" : ""}
                          `}
                        >
                          <span>{day}</span>
                          {!isWeekend && weekdayCount > 0 && (
                            <span
                              className={`text-[9px] leading-none mt-0.5 font-bold ${isMarked ? "text-stone-400" : isTopVote ? "text-emerald-600" : "text-stone-400"}`}
                            >
                              {weekdayCount}명
                            </span>
                          )}
                          {isWeekend && weekendMaxCount > 0 && (
                            <span
                              className={`text-[9px] leading-none mt-0.5 font-bold ${isMarked ? "text-stone-400" : "text-blue-400"}`}
                            >
                              {weekendMaxCount}명
                            </span>
                          )}
                          {isWeekend && weekendMaxCount === 0 && (
                            <span
                              className={`text-[9px] leading-none ${isMarked ? "opacity-60" : "opacity-40"}`}
                            >
                              주말
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {/* 범례 */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <div className="w-3 h-3 rounded bg-stone-900" />
                    <span>내가 가능</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <div className="w-3 h-3 rounded ring-2 ring-stone-300" />
                    <span>선택 중</span>
                  </div>
                  {maxVoteCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-400">
                      <div className="w-3 h-3 rounded bg-emerald-50 ring-1 ring-emerald-200" />
                      <span>최다 득표</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽: 선택 날짜 상세 + 저장 카드 */}
              <div className="space-y-4">
                {activeDateInfo ? (
                  <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-stone-400 mb-0.5">
                          선택한 날짜
                        </p>
                        <p className="text-lg font-black text-stone-900">
                          {poll.month}월 {activeDate}일 (
                          {activeDateInfo.dayName})
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {activeDateInfo.isWeekend ? "주말" : "평일"}
                        </p>
                      </div>
                      {!activeDateInfo.isWeekend &&
                        weekdayVotes[activeDate!] !== undefined && (
                          <div className="text-right">
                            <p className="text-xs text-stone-400 mb-1">
                              다른 멤버 응답
                            </p>
                            <p className="text-xl font-black text-stone-900">
                              {weekdayVotes[activeDate!]}
                              <span className="text-sm font-normal text-stone-400">
                                /{TOTAL_MEMBERS - 1}명
                              </span>
                            </p>
                            <p className="text-xs text-stone-400">
                              {poll.time_weekday} 가능
                            </p>
                          </div>
                        )}
                    </div>

                    <div className="p-5">
                      {activeDateInfo.isWeekend ? (
                        // 주말: 시간 복수 선택 (time_start ~ time_end)
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-stone-600">
                              참여 가능한 시작 시간
                            </p>
                            <p className="text-xs text-stone-400">
                              {poll.time_start} ~ {poll.time_end}
                            </p>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 mb-3">
                            {weekendHourRange.map((hour) => {
                              const mySelected =
                                weekendHours[activeDateInfo.date]?.has(hour) ??
                                false;
                              const othersCount =
                                weekendHourVotes[activeDateInfo.date]?.[hour] ??
                                0;
                              return (
                                <button
                                  key={hour}
                                  onClick={() =>
                                    dispatch({
                                      type: "TOGGLE_HOUR",
                                      date: activeDateInfo.date,
                                      hour,
                                    })
                                  }
                                  className={`py-2 rounded-lg text-xs font-medium transition-all ${
                                    mySelected
                                      ? "bg-stone-900 text-white"
                                      : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200"
                                  }`}
                                >
                                  <span>{hour}시</span>
                                  {othersCount > 0 && (
                                    <span
                                      className={`block text-[9px] ${mySelected ? "text-stone-300" : "text-stone-400"}`}
                                    >
                                      {othersCount}명
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {selectedDates.has(activeDateInfo.date) && (
                            <button
                              onClick={() =>
                                dispatch({
                                  type: "TOGGLE_DATE",
                                  date: activeDateInfo.date,
                                })
                              }
                              className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600"
                            >
                              이 날짜 선택 해제
                            </button>
                          )}
                        </div>
                      ) : (
                        // 평일: time_weekday 단일 토글
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm font-semibold text-stone-800">
                                {poll.time_weekday} 시작
                              </p>
                              <p className="text-xs text-stone-400 mt-0.5">
                                평일은 {poll.time_weekday} 시작으로 고정
                              </p>
                            </div>
                            {weekdayVotes[activeDateInfo.date] !==
                              undefined && (
                              <span className="text-xs text-stone-500">
                                다른 멤버 {weekdayVotes[activeDateInfo.date]}명
                                가능
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              dispatch({
                                type: "TOGGLE_DATE",
                                date: activeDateInfo.date,
                              })
                            }
                            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                              selectedDates.has(activeDateInfo.date)
                                ? "border-stone-900 bg-stone-900 text-white"
                                : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                            }`}
                          >
                            {selectedDates.has(activeDateInfo.date)
                              ? `✓ ${poll.time_weekday} 가능`
                              : `${poll.time_weekday} 가능으로 표시`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-8 text-center">
                    <p className="text-sm text-stone-400">
                      달력에서 날짜를 선택하세요
                    </p>
                  </div>
                )}

                {/* 선택 요약 + 저장 카드 */}
                {canSave && (
                  <div className="bg-white rounded-2xl border border-stone-200 p-5">
                    <p className="text-xs font-semibold text-stone-500 mb-3">
                      내 가능 일정 요약
                    </p>
                    {saved ? (
                      <div className="text-center py-2">
                        <p className="text-sm font-bold text-stone-900 mb-1">
                          ✓ 저장됐어요
                        </p>
                        <div className="space-y-1">
                          {getSummaryLines().map((line, i) => (
                            <p key={i} className="text-xs text-stone-500">
                              {line}
                            </p>
                          ))}
                        </div>
                        <button
                          onClick={() => dispatch({ type: "MARK_UNSAVED" })}
                          className="mt-3 text-xs text-stone-400 underline"
                        >
                          수정하기
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1 mb-4">
                          {getSummaryLines().map((line, i) => (
                            <p key={i} className="text-xs text-stone-600">
                              {line}
                            </p>
                          ))}
                        </div>
                        <button
                          onClick={handleSaveVote}
                          className="w-full py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors"
                        >
                          저장하기
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 마감 확인 다이얼로그 ── */}
      {closePhase === "dialog" && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-base font-black text-stone-900 mb-1">
              일정을 마감할까요?
            </p>
            <p className="text-sm text-stone-400 mb-5 leading-relaxed">
              마감 후에는 투표 변경이 불가해요.
              <br />
              가장 많이 선택된 날짜로 확정 날짜를 고를 수 있어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setClosePhase(null)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => setClosePhase("date-modal")}
                className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors"
              >
                마감하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 날짜 확정 모달 ── */}
      {closePhase === "date-modal" && poll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
                마감 완료
              </p>
              <h2 className="text-lg font-black text-stone-900">
                확정 날짜를 선택하세요
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                득표 수를 참고해 최종 날짜를 골라주세요
              </p>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              <div className="space-y-2">
                {voteTally.length > 0 ? (
                  voteTally.map((item) => {
                    const isTop = item.count === voteTally[0]?.count;
                    const isSelected = confirmedDate === item.date;
                    return (
                      <button
                        key={item.date}
                        onClick={() => setConfirmedDate(item.date)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? "border-stone-900 bg-stone-900 text-white"
                            : isTop
                              ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400"
                              : "border-stone-100 bg-white hover:border-stone-200"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                          <span
                            className={`text-sm font-black ${isSelected ? "text-white" : "text-stone-900"}`}
                          >
                            {item.date}
                          </span>
                          <span
                            className={`text-[10px] ${isSelected ? "text-stone-300" : "text-stone-400"}`}
                          >
                            {item.dayName}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p
                            className={`text-sm font-semibold ${isSelected ? "text-white" : "text-stone-800"}`}
                          >
                            {poll.month}월 {item.date}일 ({item.dayName}){" "}
                            {item.time}
                          </p>
                          {isTop && !isSelected && (
                            <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                              최다 득표
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p
                            className={`text-sm font-black ${isSelected ? "text-white" : "text-stone-900"}`}
                          >
                            {item.count}
                            <span className="text-xs font-normal text-stone-400">
                              /{TOTAL_MEMBERS}명
                            </span>
                          </p>
                          <div className="flex gap-0.5 justify-end mt-1">
                            {Array.from({ length: TOTAL_MEMBERS }, (_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-sm ${
                                  i < item.count
                                    ? isSelected
                                      ? "bg-white"
                                      : isTop
                                        ? "bg-emerald-500"
                                        : "bg-stone-500"
                                    : isSelected
                                      ? "bg-white/20"
                                      : "bg-stone-200"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-stone-400 text-center py-4">
                    아직 투표 데이터가 없어요
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-stone-100 flex gap-2">
              <button
                onClick={() => {
                  setClosePhase(null);
                  setConfirmedDate(null);
                }}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
              >
                취소
              </button>
              <button
                disabled={!confirmedDate}
                onClick={handleConfirm}
                className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirmedDate ? "이 날짜로 확정" : "날짜를 선택하세요"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dev Panel ── */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40">
        <button
          onClick={() => setShowDevPanel((v) => !v)}
          className="bg-violet-600 text-white text-xs font-bold rounded-full px-3 py-2 shadow-lg hover:bg-violet-700 transition-colors mb-2 block w-full"
        >
          {showDevPanel ? "✕ Dev" : "⚙ Dev"}
        </button>
        {showDevPanel && (
          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xl w-56 space-y-3">
            {/* 현재 상태 */}
            <div>
              <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1.5">
                현재 상태
              </p>
              <div className="bg-stone-50 rounded-lg p-2 space-y-1 text-[10px] font-mono text-stone-600">
                <p>poll: {poll ? `${poll.type} / ${poll.status}` : "null"}</p>
                {poll && (
                  <>
                    <p>
                      range: {poll.date_from.slice(5)} ~ {poll.date_to.slice(5)}
                    </p>
                    <p>
                      time: {poll.type === "online" ? poll.time_weekday : "-"} /{" "}
                      {poll.time_start}~{poll.time_end}
                    </p>
                    {poll.location && <p>loc: {poll.location.slice(0, 20)}</p>}
                  </>
                )}
                <p>responses: {responses.length}개</p>
                <p>
                  my vote:{" "}
                  {responses.find((r) => r.member_id === MOCK_ME_ID)
                    ? `${responses.find((r) => r.member_id === MOCK_ME_ID)!.selected_dates.length}일`
                    : "없음"}
                </p>
              </div>
            </div>

            {/* 다른 멤버 투표 추가 */}
            {poll?.status === "open" && (
              <div>
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1.5">
                  다른 멤버 투표 추가
                </p>
                <div className="space-y-1.5">
                  <button
                    onClick={() => addMockVotes("weekday-heavy")}
                    className="w-full text-xs bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg px-3 py-2 text-left transition-colors"
                  >
                    {poll.type === "online"
                      ? "📅 평일 집중 투표"
                      : "📅 첫째주 주말 투표"}
                  </button>
                  <button
                    onClick={() => addMockVotes("mixed")}
                    className="w-full text-xs bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg px-3 py-2 text-left transition-colors"
                  >
                    🎲 혼합 투표 (분산)
                  </button>
                  <button
                    onClick={() =>
                      setResponses((prev) =>
                        prev.filter((r) => r.member_id === MOCK_ME_ID),
                      )
                    }
                    className="w-full text-xs bg-stone-50 text-stone-500 hover:bg-stone-100 rounded-lg px-3 py-2 text-left transition-colors"
                  >
                    🗑 다른 멤버 투표 초기화
                  </button>
                </div>
              </div>
            )}

            {/* 리셋 */}
            <button
              onClick={handleReset}
              className="w-full text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-3 py-2 transition-colors font-semibold"
            >
              ↺ 처음부터 (전체 리셋)
            </button>

            {/* 데이터 구조 확인 */}
            {responses.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1.5">
                  응답 데이터 구조
                </p>
                <div className="bg-stone-50 rounded-lg p-2 text-[9px] font-mono text-stone-500 max-h-32 overflow-y-auto">
                  {JSON.stringify(responses[0], null, 2).slice(0, 200)}...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Switcher current={5} total={5} />
    </div>
  );
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────────

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center">
      <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-12 max-w-sm mx-auto">
        <div className="text-4xl mb-4">📅</div>
        <p className="text-sm font-bold text-stone-700 mb-2">
          현재 진행 중인 일정 조율이 없어요
        </p>
        <p className="text-xs text-stone-400 mb-6 leading-relaxed">
          새 일정을 만들어 멤버들의
          <br />
          가능한 날짜를 모아보세요
        </p>
        <button
          onClick={onStart}
          className="bg-stone-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors"
        >
          + 새 일정 만들기
        </button>
      </div>
    </div>
  );
}

function PresetSelect({
  onSelect,
  onBack,
}: {
  onSelect: (type: "online" | "offline") => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="text-xs text-stone-400 hover:text-stone-600 mb-6 block transition-colors"
      >
        ← 돌아가기
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
          Step 1
        </p>
        <h2 className="text-xl font-black text-stone-900">
          미팅 유형을 선택하세요
        </h2>
        <p className="text-sm text-stone-400 mt-1.5">
          날짜·시간 기본값이 자동으로 설정돼요. 다음 단계에서 수정 가능해요.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSelect("online")}
          className="text-left bg-white rounded-2xl border-2 border-stone-200 p-6 hover:border-stone-900 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-4">💻</div>
          <p className="font-black text-stone-900 mb-3">온라인 미팅</p>
          <div className="space-y-1.5">
            <p className="text-xs text-stone-400">📆 매월 1~10일</p>
            <p className="text-xs text-stone-400">🌙 평일 22:00 고정</p>
            <p className="text-xs text-stone-400">☀️ 주말 10:00~22:00</p>
          </div>
        </button>
        <button
          onClick={() => onSelect("offline")}
          className="text-left bg-white rounded-2xl border-2 border-stone-200 p-6 hover:border-stone-900 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-4">🏢</div>
          <p className="font-black text-stone-900 mb-3">오프라인 미팅</p>
          <div className="space-y-1.5">
            <p className="text-xs text-stone-400">📆 첫째·둘째 주말</p>
            <p className="text-xs text-stone-400">🕙 10:00~18:00</p>
            <p className="text-xs text-stone-400">📍 장소 직접 입력</p>
          </div>
        </button>
      </div>
    </div>
  );
}

function PollForm({
  pollType,
  onBack,
  onSubmit,
}: {
  pollType: "online" | "offline";
  onBack: () => void;
  onSubmit: (data: PollFormData) => void;
}) {
  const isOnline = pollType === "online";
  const [dateFrom, setDateFrom] = useState(
    isOnline ? "2026-03-01" : "2026-03-07",
  );
  const [dateTo, setDateTo] = useState(isOnline ? "2026-03-10" : "2026-03-15");
  const [timeWeekday, setTimeWeekday] = useState("22:00");
  const [timeStart, setTimeStart] = useState("10:00");
  const [timeEnd, setTimeEnd] = useState(isOnline ? "22:00" : "18:00");
  const [location, setLocation] = useState("");

  const handleSubmit = () => {
    onSubmit({
      type: pollType,
      location,
      dateFrom,
      dateTo,
      timeWeekday: isOnline ? timeWeekday : null,
      timeStart,
      timeEnd,
    });
  };

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="text-xs text-stone-400 hover:text-stone-600 mb-6 block transition-colors"
      >
        ← 유형 다시 선택
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
          Step 2
        </p>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-stone-900">일정 상세 설정</h2>
          <span className="text-xs bg-stone-100 text-stone-500 rounded-full px-2.5 py-1 font-medium">
            {isOnline ? "💻 온라인" : "🏢 오프라인"}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        {/* 날짜 범위 */}
        <div className="p-5">
          <label className="text-xs font-semibold text-stone-500 block mb-3">
            날짜 범위
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
            />
            <span className="text-stone-400 flex-shrink-0">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
            />
          </div>
        </div>

        {/* 시간 설정 */}
        <div className="p-5">
          <label className="text-xs font-semibold text-stone-500 block mb-3">
            시간
          </label>
          <div className="space-y-2">
            {isOnline && (
              <div className="flex items-center justify-between bg-stone-50 rounded-xl px-4 py-2.5">
                <span className="text-sm text-stone-500">평일</span>
                <input
                  type="time"
                  value={timeWeekday}
                  onChange={(e) => setTimeWeekday(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            )}
            <div className="flex items-center justify-between bg-stone-50 rounded-xl px-4 py-2.5">
              <span className="text-sm text-stone-500">주말</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
                <span className="text-stone-400 text-xs">~</span>
                <input
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 장소 (오프라인) / 화상회의 링크 (온라인 선택사항) */}
        <div className="p-5">
          <label className="text-xs font-semibold text-stone-500 block mb-3">
            {isOnline ? "화상회의 링크 (선택)" : "장소"}
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={
              isOnline
                ? "예: https://meet.google.com/..."
                : "예: 강남역 카페, 잠실 공유 오피스"
            }
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-stone-400 placeholder:text-stone-300"
          />
        </div>

        {/* 제출 */}
        <div className="p-5">
          <button
            onClick={handleSubmit}
            className="w-full py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors"
          >
            일정 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
