import { useEffect, useReducer, useRef, useState } from "react";
import type { VotePoll, VoteResponse, DateInfo } from "../types";
import { DAY_NAMES } from "../types";
import {
  getVoteResponses,
  getTotalMemberCount,
  upsertVoteResponse,
} from "../lib/vote";

const WEEKEND_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function buildDates(year: number, month: number): DateInfo[] {
  return Array.from({ length: 10 }, (_, i) => {
    const d = i + 1;
    const dow = new Date(year, month - 1, d).getDay();
    return {
      date: d,
      dayName: DAY_NAMES[dow],
      isWeekend: dow === 0 || dow === 6,
    };
  });
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

function computeWeekdayVotes(
  others: VoteResponse[],
  dates: DateInfo[],
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const { date } of dates.filter((d) => !d.isWeekend)) {
    let count = 0;
    for (const r of others) {
      if (r.mode === "available") {
        if (r.selected_dates.some((s) => s.date === date)) count++;
      } else {
        if (!r.selected_dates.some((s) => s.date === date)) count++;
      }
    }
    if (count > 0) result[date] = count;
  }
  return result;
}

function computeWeekendHourVotes(
  others: VoteResponse[],
  dates: DateInfo[],
): Record<number, Record<number, number>> {
  const result: Record<number, Record<number, number>> = {};
  for (const { date } of dates.filter((d) => d.isWeekend)) {
    for (const hour of WEEKEND_HOURS) {
      let count = 0;
      for (const r of others) {
        if (r.mode === "available") {
          const sel = r.selected_dates.find((s) => s.date === date);
          if (sel?.hours.includes(hour)) count++;
        } else {
          if (!r.selected_dates.some((s) => s.date === date)) count++;
        }
      }
      if (count > 0) {
        if (!result[date]) result[date] = {};
        result[date][hour] = count;
      }
    }
  }
  return result;
}

// --- 투표 UI 상태 (useReducer) ---

type Mode = "available" | "unavailable";

interface VoteState {
  mode: Mode;
  selectedDates: Set<number>;
  weekendHours: Record<number, Set<number>>;
  activeDate: number | null;
  saved: boolean;
  saveError: string | null;
}

type VoteAction =
  | { type: "SET_MODE"; mode: Mode }
  | { type: "TOGGLE_DATE"; date: number }
  | { type: "TOGGLE_HOUR"; date: number; hour: number }
  | { type: "SET_ACTIVE_DATE"; date: number | null }
  | { type: "MARK_SAVED" }
  | { type: "MARK_UNSAVED" }
  | { type: "SET_SAVE_ERROR"; error: string | null }
  | {
      type: "RESTORE";
      mode: Mode;
      selectedDates: Set<number>;
      weekendHours: Record<number, Set<number>>;
      activeDate: number | null;
    };

function voteReducer(state: VoteState, action: VoteAction): VoteState {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        mode: action.mode,
        selectedDates: new Set(),
        weekendHours: {},
        saved: false,
        saveError: null,
      };
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
        saveError: null,
      };
    }
    case "TOGGLE_HOUR": {
      const cur = state.weekendHours[action.date]
        ? new Set(state.weekendHours[action.date])
        : new Set<number>();
      if (cur.has(action.hour)) cur.delete(action.hour);
      else cur.add(action.hour);
      // 시간 선택 시 날짜도 자동 선택
      const nextDates = new Set(state.selectedDates);
      nextDates.add(action.date);
      return {
        ...state,
        selectedDates: nextDates,
        weekendHours: { ...state.weekendHours, [action.date]: cur },
        saved: false,
        saveError: null,
      };
    }
    case "SET_ACTIVE_DATE":
      return { ...state, activeDate: action.date };
    case "MARK_SAVED":
      return { ...state, saved: true, saveError: null };
    case "MARK_UNSAVED":
      return { ...state, saved: false };
    case "SET_SAVE_ERROR":
      return { ...state, saveError: action.error };
    case "RESTORE":
      return {
        ...state,
        mode: action.mode,
        selectedDates: action.selectedDates,
        weekendHours: action.weekendHours,
        activeDate: action.activeDate,
        saved: true,
        saveError: null,
      };
    default:
      return state;
  }
}

const initialVoteState: VoteState = {
  mode: "available",
  selectedDates: new Set(),
  weekendHours: {},
  activeDate: null,
  saved: false,
  saveError: null,
};

// ---

interface Props {
  memberId: string;
  poll: VotePoll | null;
}

export default function VotePage({ memberId, poll }: Props) {
  const [responses, setResponses] = useState<VoteResponse[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [voteState, dispatch] = useReducer(voteReducer, initialVoteState);
  const { mode, selectedDates, weekendHours, activeDate, saved, saveError } =
    voteState;

  const initializedRef = useRef(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(false);

      if (!poll) {
        setLoading(false);
        return;
      }

      const [allResponses, memberCount] = await Promise.all([
        getVoteResponses(poll.id),
        getTotalMemberCount(),
      ]);

      if (allResponses === null || memberCount === null) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      setResponses(allResponses);
      setTotalMembers(memberCount);

      if (!initializedRef.current) {
        initializedRef.current = true;
        const mine = allResponses.find((r) => r.member_id === memberId);
        if (mine) {
          const dates = new Set(mine.selected_dates.map((s) => s.date));
          const hours: Record<number, Set<number>> = {};
          if (mine.mode === "available") {
            for (const s of mine.selected_dates) {
              if (s.hours.length > 0) {
                hours[s.date] = new Set(s.hours.filter((h) => h !== 22));
              }
            }
          }
          dispatch({
            type: "RESTORE",
            mode: mine.mode,
            selectedDates: dates,
            weekendHours: hours,
            activeDate: mine.selected_dates[0]?.date ?? null,
          });
        } else {
          dispatch({ type: "SET_ACTIVE_DATE", date: 2 });
        }
      }

      setLoading(false);
    }

    load();
  }, [memberId, poll]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-stone-400">불러오는 중...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-400">
          데이터를 불러오지 못했어요. 새로고침해주세요.
        </p>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-stone-400">
          현재 진행 중인 일정 조율이 없어요
        </p>
      </div>
    );
  }

  const dates = buildDates(poll.year, poll.month);
  const calendarRows = buildCalendarRows(poll.year, poll.month);
  const otherResponses = responses.filter((r) => r.member_id !== memberId);
  const weekdayVotes = computeWeekdayVotes(otherResponses, dates);
  const weekendHourVotes = computeWeekendHourVotes(otherResponses, dates);

  const respondedCount = new Set(responses.map((r) => r.member_id)).size;
  const activeDateInfo = dates.find((d) => d.date === activeDate);
  const maxVoteCount =
    Object.keys(weekdayVotes).length > 0
      ? Math.max(...Object.values(weekdayVotes))
      : 0;

  const getSummaryLines = () => {
    if (mode === "available") {
      return dates
        .filter((d) => selectedDates.has(d.date))
        .map((d) => {
          if (!d.isWeekend) return `${d.date}일 (${d.dayName}) 22:00`;
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
    } else {
      const availDates = dates.filter((d) => !selectedDates.has(d.date));
      return availDates.map((d) => {
        if (!d.isWeekend) return `${d.date}일 (${d.dayName}) 22:00`;
        return `${d.date}일 (${d.dayName}) 전체`;
      });
    }
  };

  const canSave = (() => {
    if (mode === "unavailable") return selectedDates.size < dates.length;
    if (selectedDates.size === 0) return false;
    // 주말 선택 시 시간이 하나도 없으면 저장 불가
    for (const date of selectedDates) {
      const info = dates.find((d) => d.date === date);
      if (info?.isWeekend && !(weekendHours[date]?.size > 0)) return false;
    }
    return true;
  })();

  const handleSave = async () => {
    setSaving(true);
    dispatch({ type: "SET_SAVE_ERROR", error: null });
    const { error } = await upsertVoteResponse(
      poll.id,
      memberId,
      mode,
      selectedDates,
      weekendHours,
      dates,
    );
    if (error) {
      dispatch({
        type: "SET_SAVE_ERROR",
        error: "저장에 실패했어요. 다시 시도해주세요.",
      });
    } else {
      dispatch({ type: "MARK_SAVED" });
      const updated = await getVoteResponses(poll.id);
      setResponses(updated);
    }
    setSaving(false);
  };

  const MONTH_KO = `${poll.year}년 ${poll.month}월`;
  const retroMonth = poll.month === 1 ? 12 : poll.month - 1;
  const retroYear = poll.month === 1 ? poll.year - 1 : poll.year;
  const sessionLabel = `${poll.month}월에 하는 ${retroYear}년 ${retroMonth}월 회고`;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더: 세션명 + 응답 현황 */}
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              {sessionLabel}
            </span>
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-3 py-1.5">
            {respondedCount}/{totalMembers}명 응답 완료
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* 모드 토글: 가능한 날 / 불가능한 날 */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex bg-stone-100 rounded-full p-0.5 gap-0.5">
            <button
              onClick={() => dispatch({ type: "SET_MODE", mode: "available" })}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === "available" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
            >
              가능한 날 선택
            </button>
            <button
              onClick={() =>
                dispatch({ type: "SET_MODE", mode: "unavailable" })
              }
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === "unavailable" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
            >
              불가능한 날 선택
            </button>
          </div>
          <span className="text-xs text-stone-400">
            {mode === "available"
              ? "참여 가능한 날짜와 시간을 선택하세요"
              : "참여할 수 없는 날짜를 선택하세요 — 나머지는 모두 가능으로 처리돼요"}
          </span>
        </div>

        {/* 메인 2열 그리드: 왼쪽 달력 / 오른쪽 상세 패널 */}
        <div className="grid grid-cols-[1fr_1.15fr] gap-6 items-start">
          {/* 왼쪽: 달력 */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-stone-800">
                {MONTH_KO}
              </span>
              <span className="text-xs text-stone-400 bg-stone-50 rounded-full px-2 py-0.5">
                1일 ~ 10일
              </span>
            </div>

            {/* 요일 헤더 */}
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

            {/* 날짜 그리드 */}
            {calendarRows.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7">
                {row.map((day, di) => {
                  if (!day) return <div key={di} className="aspect-square" />;
                  const inRange = day <= 10;
                  const isMarked = selectedDates.has(day);
                  const isActive = activeDate === day;
                  const isSun = di === 0;
                  const isSat = di === 6;
                  const dateInfo = dates.find((d) => d.date === day);
                  const isWeekend = dateInfo?.isWeekend ?? false;
                  const weekdayCount =
                    inRange && !isWeekend ? (weekdayVotes[day] ?? 0) : 0;
                  const weekendMaxCount =
                    inRange && isWeekend && weekendHourVotes[day]
                      ? Math.max(...Object.values(weekendHourVotes[day]))
                      : 0;
                  const isTopVote =
                    weekdayCount === maxVoteCount && weekdayCount > 0;

                  if (!inRange) {
                    return (
                      <div
                        key={di}
                        className={`aspect-square flex items-center justify-center text-xs ${isSun ? "text-red-200" : isSat ? "text-blue-200" : "text-stone-200"}`}
                      >
                        {day}
                      </div>
                    );
                  }

                  const isUnavailableMode = mode === "unavailable";
                  const markedStyle = isUnavailableMode
                    ? "bg-stone-200 text-stone-500 line-through"
                    : "bg-stone-900 text-white";

                  return (
                    <button
                      key={di}
                      onClick={() =>
                        dispatch({ type: "TOGGLE_DATE", date: day })
                      }
                      className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg transition-all relative
                        ${isMarked ? markedStyle : isActive ? "ring-2 ring-stone-300 text-stone-800 font-semibold" : isTopVote ? "bg-emerald-50 ring-1 ring-emerald-200 text-stone-900" : "hover:bg-stone-50 text-stone-700 font-medium"}
                        ${isWeekend && !isMarked && !isActive && isSun ? "text-red-500" : ""}
                        ${isWeekend && !isMarked && !isActive && isSat ? "text-blue-500" : ""}
                      `}
                    >
                      <span>{day}</span>
                      {inRange && !isWeekend && weekdayCount > 0 && (
                        <span
                          className={`text-[9px] leading-none mt-0.5 font-bold ${isMarked ? "text-stone-400" : isTopVote ? "text-emerald-600" : "text-stone-400"}`}
                        >
                          {weekdayCount}명
                        </span>
                      )}
                      {inRange && isWeekend && weekendMaxCount > 0 && (
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
            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <div
                  className={`w-3 h-3 rounded ${mode === "unavailable" ? "bg-stone-200" : "bg-stone-900"}`}
                />
                <span>{mode === "available" ? "내가 가능" : "불가능"}</span>
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
              {(Object.keys(weekdayVotes).length > 0 ||
                Object.keys(weekendHourVotes).length > 0) && (
                <div className="flex items-center gap-1 text-xs text-stone-400">
                  <span className="text-[10px] font-bold">N명</span>
                  <span>= 셀 안 응답 인원</span>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 선택 날짜 상세 패널 + 저장 카드 */}
          <div className="space-y-4">
            {activeDateInfo ? (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                {/* 날짜 헤더 */}
                <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-400 mb-0.5">선택한 날짜</p>
                    <p className="text-lg font-black text-stone-900">
                      {poll.month}월 {activeDate}일 ({activeDateInfo.dayName})
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {activeDateInfo.isWeekend ? "주말" : "평일"}
                    </p>
                  </div>
                  {/* 평일만 다른 멤버 22:00 응답 수 표시 */}
                  {!activeDateInfo.isWeekend &&
                    weekdayVotes[activeDate!] !== undefined && (
                      <div className="text-right">
                        <p className="text-xs text-stone-400 mb-1">
                          다른 멤버 응답
                        </p>
                        <p className="text-xl font-black text-stone-900">
                          {weekdayVotes[activeDate!]}
                          <span className="text-sm font-normal text-stone-400">
                            /{totalMembers - 1}명
                          </span>
                        </p>
                        <p className="text-xs text-stone-400">22:00 가능</p>
                      </div>
                    )}
                </div>

                <div className="p-5">
                  {mode === "unavailable" ? (
                    /* 불가능 모드: 날짜 단위 토글만 */
                    <div>
                      <button
                        onClick={() =>
                          dispatch({
                            type: "TOGGLE_DATE",
                            date: activeDateInfo.date,
                          })
                        }
                        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                          selectedDates.has(activeDateInfo.date)
                            ? "border-stone-300 bg-stone-100 text-stone-500"
                            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                        }`}
                      >
                        {selectedDates.has(activeDateInfo.date)
                          ? "✕ 이 날 불가능"
                          : "이 날짜 불가능으로 표시"}
                      </button>
                      {activeDateInfo.isWeekend && (
                        <p className="text-xs text-stone-400 text-center mt-2">
                          주말 전체를 불가능으로 처리합니다
                        </p>
                      )}
                    </div>
                  ) : activeDateInfo.isWeekend ? (
                    /* 가능 모드 + 주말: 시간 복수 선택 */
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-stone-600">
                          참여 가능한 시작 시간
                        </p>
                        <p className="text-xs text-stone-400">복수 선택 가능</p>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        {WEEKEND_HOURS.map((hour) => {
                          const mySelected =
                            weekendHours[activeDateInfo.date]?.has(hour) ??
                            false;
                          const othersCount =
                            weekendHourVotes[activeDateInfo.date]?.[hour] ?? 0;
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
                              className={`py-2 rounded-lg text-xs font-medium transition-all relative ${
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
                    /* 가능 모드 + 평일: 22:00 단일 토글 */
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-semibold text-stone-800">
                            22:00 시작
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            평일은 밤 10시 시작으로 고정
                          </p>
                        </div>
                        {weekdayVotes[activeDateInfo.date] !== undefined && (
                          <span className="text-xs text-stone-500">
                            다른 멤버 {weekdayVotes[activeDateInfo.date]}명 가능
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
                          ? "✓ 22:00 가능"
                          : "22:00 가능으로 표시"}
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
                  {mode === "available"
                    ? "내 가능 일정 요약"
                    : "불가능한 날 기준 가능 일정"}
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
                    {saveError && (
                      <p className="text-xs text-red-500 mb-2">{saveError}</p>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? "저장 중..." : "저장하기"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
