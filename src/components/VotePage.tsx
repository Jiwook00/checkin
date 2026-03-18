import { useEffect, useReducer, useRef, useState } from "react";
import type { VotePoll, VoteResponse, DateInfo } from "../types";
import { DAY_NAMES } from "../types";
import {
  getVoteResponses,
  getTotalMemberCount,
  getMemberNicknames,
  upsertVoteResponse,
  createPoll,
  confirmPoll,
  updatePollMeta,
  updatePollSchedule,
  deletePoll,
  type UpdatePollMetaData,
  type UpdatePollScheduleData,
} from "../lib/vote";

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

function memberColorClass(memberId: string): string {
  let hash = 0;
  for (let i = 0; i < memberId.length; i++) {
    hash = (hash * 31 + memberId.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function buildDates(dateFrom: string, dateTo: string): DateInfo[] {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const result: DateInfo[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    const dow = cur.getDay();
    result.push({
      date: cur.getDate(),
      dayName: DAY_NAMES[dow],
      isWeekend: dow === 0 || dow === 6,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

function getWeekendHourRange(poll: VotePoll): number[] {
  const start = parseInt(poll.time_start.split(":")[0]);
  const end = parseInt(poll.time_end.split(":")[0]);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function isDateClickable(dateInfo: DateInfo, poll: VotePoll): boolean {
  if (poll.type === "offline") return dateInfo.isWeekend;
  return true;
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
      if (r.selected_dates.some((s) => s.date === date)) count++;
    }
    if (count > 0) result[date] = count;
  }
  return result;
}

function computeWeekendHourVotes(
  others: VoteResponse[],
  dates: DateInfo[],
  weekendHourRange: number[],
): Record<number, Record<number, number>> {
  const result: Record<number, Record<number, number>> = {};
  for (const { date } of dates.filter((d) => d.isWeekend)) {
    for (const hour of weekendHourRange) {
      let count = 0;
      for (const r of others) {
        const sel = r.selected_dates.find((s) => s.date === date);
        if (sel?.hours.includes(hour)) count++;
      }
      if (count > 0) {
        if (!result[date]) result[date] = {};
        result[date][hour] = count;
      }
    }
  }
  return result;
}

interface TallyVoter {
  memberId: string;
  name: string;
}

interface TallyItem {
  date: number;
  dayName: string;
  isWeekend: boolean;
  count: number;
  time: string;
  voters: TallyVoter[];
}

function computeVoteTally(
  allResponses: VoteResponse[],
  dates: DateInfo[],
  poll: VotePoll,
  memberNicknames: Record<string, string>,
): TallyItem[] {
  const items: TallyItem[] = [];

  for (const dateInfo of dates) {
    if (dateInfo.isWeekend) {
      // 주말: (날짜 × 시간) 단위로 각각 집계
      const hourCounts: Record<number, number> = {};
      const hourVoters: Record<number, TallyVoter[]> = {};
      for (const r of allResponses) {
        const sel = r.selected_dates.find((s) => s.date === dateInfo.date);
        for (const h of sel?.hours ?? []) {
          hourCounts[h] = (hourCounts[h] ?? 0) + 1;
          if (!hourVoters[h]) hourVoters[h] = [];
          hourVoters[h].push({
            memberId: r.member_id,
            name: memberNicknames[r.member_id] ?? r.member_id,
          });
        }
      }
      for (const [hourStr, count] of Object.entries(hourCounts)) {
        items.push({
          date: dateInfo.date,
          dayName: dateInfo.dayName,
          isWeekend: true,
          count,
          time: `${hourStr}:00`,
          voters: hourVoters[Number(hourStr)] ?? [],
        });
      }
    } else {
      // 평일: 날짜 단위 집계
      const avail = allResponses.filter((r) =>
        r.selected_dates.some((s) => s.date === dateInfo.date),
      );
      if (avail.length === 0) continue;
      items.push({
        date: dateInfo.date,
        dayName: dateInfo.dayName,
        isWeekend: false,
        count: avail.length,
        time: poll.time_weekday ?? "22:00",
        voters: avail.map((r) => ({
          memberId: r.member_id,
          name: memberNicknames[r.member_id] ?? r.member_id,
        })),
      });
    }
  }

  return items.sort((a, b) => b.count - a.count);
}

interface PollFormData {
  dateFrom: string;
  dateTo: string;
  timeWeekday: string | null;
  timeStart: string;
  timeEnd: string;
  location: string | null;
}

// --- 투표 UI 상태 (useReducer) ---

interface VoteState {
  selectedDates: Set<number>;
  weekendHours: Record<number, Set<number>>;
  activeDate: number | null;
  saved: boolean;
  saveError: string | null;
  cannotAttend: boolean;
}

type VoteAction =
  | { type: "TOGGLE_DATE"; date: number }
  | { type: "TOGGLE_HOUR"; date: number; hour: number }
  | { type: "SET_ACTIVE_DATE"; date: number | null }
  | { type: "MARK_SAVED" }
  | { type: "MARK_UNSAVED" }
  | { type: "SET_SAVE_ERROR"; error: string | null }
  | { type: "SET_CANNOT_ATTEND"; value: boolean }
  | {
      type: "RESTORE";
      selectedDates: Set<number>;
      weekendHours: Record<number, Set<number>>;
      activeDate: number | null;
      cannotAttend: boolean;
    };

function voteReducer(state: VoteState, action: VoteAction): VoteState {
  switch (action.type) {
    case "TOGGLE_DATE": {
      const next = new Set(state.selectedDates);
      if (next.has(action.date)) {
        next.delete(action.date);
      } else {
        next.add(action.date);
      }
      return {
        ...state,
        selectedDates: next,
        activeDate: action.date,
        cannotAttend: false,
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
      const nextDates = new Set(state.selectedDates);
      nextDates.add(action.date);
      return {
        ...state,
        selectedDates: nextDates,
        weekendHours: { ...state.weekendHours, [action.date]: cur },
        cannotAttend: false,
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
    case "SET_CANNOT_ATTEND":
      return {
        ...state,
        cannotAttend: action.value,
        selectedDates: action.value ? new Set() : state.selectedDates,
        weekendHours: action.value ? {} : state.weekendHours,
        saved: false,
        saveError: null,
      };
    case "RESTORE":
      return {
        ...state,
        selectedDates: action.selectedDates,
        weekendHours: action.weekendHours,
        activeDate: action.activeDate,
        cannotAttend: action.cannotAttend,
        saved: true,
        saveError: null,
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
  saveError: null,
  cannotAttend: false,
};

// ---

type CreateStep = "preset" | "form";
type PollType = "online" | "offline";
type ClosePhase = "tally" | "date-modal";

interface Props {
  memberId: string;
  poll: VotePoll | null;
  onPollChange: (poll: VotePoll | null) => void;
}

export default function VotePage({ memberId, poll, onPollChange }: Props) {
  const [responses, setResponses] = useState<VoteResponse[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [memberNicknames, setMemberNicknames] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [createStep, setCreateStep] = useState<CreateStep | null>(null);
  const [pollType, setPollType] = useState<PollType>("online");

  const [closePhase, setClosePhase] = useState<ClosePhase | null>(null);
  const [confirmedDate, setConfirmedDate] = useState<{
    date: number;
    time: string;
  } | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [voteState, dispatch] = useReducer(voteReducer, initialVoteState);
  const {
    selectedDates,
    weekendHours,
    activeDate,
    saved,
    saveError,
    cannotAttend,
  } = voteState;

  const initializedRef = useRef(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(false);

      if (!poll) {
        setLoading(false);
        return;
      }

      try {
        const [allResponses, memberCount, nicknames] = await Promise.all([
          getVoteResponses(poll.id),
          getTotalMemberCount(),
          getMemberNicknames(),
        ]);

        setResponses(allResponses);
        setTotalMembers(memberCount);
        setMemberNicknames(nicknames);

        if (!initializedRef.current) {
          initializedRef.current = true;
          const effectDates = buildDates(poll.date_from, poll.date_to);
          const mine = allResponses.find((r) => r.member_id === memberId);
          if (mine) {
            const restoredDates = new Set(
              mine.selected_dates.map((s) => s.date),
            );
            const restoredHours: Record<number, Set<number>> = {};
            for (const s of mine.selected_dates) {
              const info = effectDates.find((d) => d.date === s.date);
              if (info?.isWeekend && s.hours.length > 0) {
                restoredHours[s.date] = new Set(s.hours);
              }
            }
            dispatch({
              type: "RESTORE",
              selectedDates: restoredDates,
              weekendHours: restoredHours,
              activeDate: null,
              cannotAttend: mine.cannot_attend,
            });
          }
        }
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
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

  const handleCreatePoll = async (data: PollFormData) => {
    setCreating(true);
    const { poll: newPoll, error } = await createPoll({
      type: pollType,
      location: data.location,
      date_from: data.dateFrom,
      date_to: data.dateTo,
      time_weekday: data.timeWeekday,
      time_start: data.timeStart,
      time_end: data.timeEnd,
    });
    if (!error && newPoll) {
      onPollChange(newPoll);
      setCreateStep(null);
    }
    setCreating(false);
  };

  // --- 새 일정 만들기 플로우 (poll 없음 또는 confirmed 상태에서 다음 회차 생성) ---
  if (createStep === "preset") {
    return (
      <div className="py-12 px-6">
        <PresetSelect
          onSelect={(type) => {
            setPollType(type);
            setCreateStep("form");
          }}
          onBack={() => setCreateStep(null)}
        />
      </div>
    );
  }
  if (createStep === "form") {
    return (
      <div className="py-12 px-6">
        <PollForm
          pollType={pollType}
          onBack={() => setCreateStep("preset")}
          onSubmit={handleCreatePoll}
          disabled={creating}
        />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="py-20">
        <EmptyState onStart={() => setCreateStep("preset")} />
      </div>
    );
  }

  const handleDeletePoll = async () => {
    setDeleting(true);
    const { error } = await deletePoll(poll.id);
    if (!error) {
      onPollChange(null);
    }
    setDeleting(false);
    setDeleteConfirmOpen(false);
  };

  const handleUpdateMeta = async (data: UpdatePollMetaData) => {
    const { error } = await updatePollMeta(poll.id, data);
    if (!error) {
      onPollChange({ ...poll, ...data } as typeof poll);
      setEditModalOpen(false);
    }
  };

  const handleUpdateSchedule = async (data: UpdatePollScheduleData) => {
    const fromDate = new Date(data.date_from + "T00:00:00");
    const year = fromDate.getFullYear();
    const month = fromDate.getMonth() + 1;
    const { error } = await updatePollSchedule(poll.id, data);
    if (!error) {
      onPollChange({
        ...poll,
        ...data,
        year,
        month,
        session: `${year}-${String(month).padStart(2, "0")}`,
      });
      setEditModalOpen(false);
    }
  };

  // --- 활성 poll ---
  const dates = buildDates(poll.date_from, poll.date_to);
  const calendarRows = buildCalendarRows(poll.year, poll.month);
  const weekendHourRange = getWeekendHourRange(poll);
  const otherResponses = responses.filter((r) => r.member_id !== memberId);
  // 오른쪽 패널 "다른 멤버 응답" 표시용 (나 제외)
  const weekdayVotes = computeWeekdayVotes(otherResponses, dates);
  const weekendHourVotes = computeWeekendHourVotes(
    otherResponses,
    dates,
    weekendHourRange,
  );
  // 달력 셀 인원 표시용 (나 포함 전체)
  const allWeekdayVotes = computeWeekdayVotes(responses, dates);
  const allWeekendHourVotes = computeWeekendHourVotes(
    responses,
    dates,
    weekendHourRange,
  );
  const voteTally = computeVoteTally(responses, dates, poll, memberNicknames);

  const respondedCount = new Set(responses.map((r) => r.member_id)).size;
  const cannotAttendCount = responses.filter((r) => r.cannot_attend).length;
  const activeDateInfo = dates.find((d) => d.date === activeDate);
  const maxVoteCount =
    Object.keys(allWeekdayVotes).length > 0
      ? Math.max(...Object.values(allWeekdayVotes))
      : 0;

  const dateFromDay = parseInt(poll.date_from.split("-")[2]);
  const dateToDay = parseInt(poll.date_to.split("-")[2]);

  const getSummaryLines = () =>
    dates
      .filter((d) => selectedDates.has(d.date))
      .map((d) => {
        if (!d.isWeekend)
          return `${d.date}일 (${d.dayName}) ${poll.time_weekday ?? "22:00"}`;
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

  const canSave =
    cannotAttend ||
    (() => {
      if (selectedDates.size === 0) return false;
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
      selectedDates,
      weekendHours,
      dates,
      poll,
      cannotAttend,
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

  const handleConfirm = async () => {
    if (!confirmedDate) return;
    setConfirming(true);
    const dateStr = `${poll.year}-${String(poll.month).padStart(2, "0")}-${String(confirmedDate.date).padStart(2, "0")}`;
    const tallyTime = confirmedDate.time;
    const { error } = await confirmPoll(poll.id, dateStr, tallyTime);
    if (!error) {
      onPollChange({
        ...poll,
        status: "confirmed",
        confirmed_date: dateStr,
        confirmed_time: tallyTime,
      });
      setClosePhase(null);
      setConfirmedDate(null);
    }
    setConfirming(false);
  };

  const MONTH_KO = `${poll.year}년 ${poll.month}월`;
  const retroMonth = poll.month === 1 ? 12 : poll.month - 1;
  const retroYear = poll.month === 1 ? poll.year - 1 : poll.year;
  const sessionLabel = `${poll.month}월에 하는 ${retroYear}년 ${retroMonth}월 회고`;

  const confirmedDay = poll.confirmed_date
    ? parseInt(poll.confirmed_date.split("-")[2])
    : null;
  const confirmedDateInfo = confirmedDay
    ? dates.find((d) => d.date === confirmedDay)
    : null;
  const confirmedTallyItem = confirmedDay
    ? voteTally.find(
        (t) =>
          t.date === confirmedDay &&
          (!poll.confirmed_time || t.time === poll.confirmed_time),
      )
    : null;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-stone-100 px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-3xl mx-auto flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              {sessionLabel}
            </span>
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
            <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-3 py-1.5">
              {respondedCount}/{totalMembers}명
            </span>
            {poll.status === "open" && closePhase === null && (
              <>
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="hidden md:inline-flex text-xs text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 hover:border-stone-400 hover:text-stone-700 transition-all"
                >
                  수정
                </button>
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="hidden md:inline-flex text-xs text-stone-400 border border-stone-200 rounded-full px-3 py-1.5 hover:border-red-200 hover:text-red-500 transition-all"
                >
                  삭제
                </button>
                <button
                  onClick={() => setClosePhase("tally")}
                  className="text-xs text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 hover:border-stone-400 hover:text-stone-700 transition-all"
                >
                  현황 보기
                </button>
              </>
            )}
            {poll.status === "confirmed" && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-3 py-1.5">
                확정됨
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 md:px-6 md:py-6">
        {poll.status === "confirmed" ? (
          /* 확정 완료 화면 */
          <div className="text-center">
            <div className="bg-white rounded-2xl border border-emerald-200 p-8 max-w-sm mx-auto">
              <div className="text-4xl mb-4">🎉</div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">
                일정 확정
              </p>
              <p className="text-2xl font-black text-stone-900 mb-1">
                {poll.month}월 {confirmedDay}일 (
                {confirmedDateInfo?.dayName ?? ""})
              </p>
              <p className="text-lg font-bold text-stone-600 mb-4">
                {confirmedTallyItem?.time ??
                  poll.time_weekday ??
                  poll.time_start}{" "}
                시작
              </p>
              {confirmedTallyItem && (
                <>
                  <p className="text-sm text-stone-400 mb-3">
                    {confirmedTallyItem.count}명이 참여 가능한 날짜예요
                  </p>
                  <div className="flex justify-center gap-1">
                    {Array.from({ length: totalMembers }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-sm ${i < confirmedTallyItem.count ? "bg-emerald-500" : "bg-stone-200"}`}
                      />
                    ))}
                  </div>
                </>
              )}
              <div className="flex flex-col gap-2 mt-6">
                <button
                  onClick={() => setCreateStep("preset")}
                  className="w-full bg-stone-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-stone-700 transition-colors"
                >
                  + 다음 회차 일정 만들기
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditModalOpen(true)}
                    className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2 text-xs font-medium hover:border-stone-400 hover:text-stone-800 transition-colors"
                  >
                    일정 수정
                  </button>
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="flex-1 border border-stone-200 text-stone-400 rounded-xl py-2 text-xs font-medium hover:border-red-200 hover:text-red-500 transition-colors"
                  >
                    일정 삭제
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 투표 중 화면 */
          <>
            <p className="text-xs text-stone-400 mb-5">
              {poll.type === "offline"
                ? "가능한 주말을 선택하고 시작 시간을 골라주세요."
                : `가능한 날짜를 선택하세요. 평일은 ${poll.time_weekday ?? "22:00"}, 주말은 시간도 선택해주세요.`}
            </p>

            {/* 메인 레이아웃: 모바일 1열 / 데스크톱 2열 */}
            <div className="md:grid md:grid-cols-[1fr_1.15fr] md:gap-6 md:items-start">
              {/* 왼쪽: 달력 */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-stone-800">
                    {MONTH_KO}
                  </span>
                  <span className="text-xs text-stone-400 bg-stone-50 rounded-full px-2 py-0.5">
                    {dateFromDay}일 ~ {dateToDay}일
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
                      const weekdayCount =
                        inRange && !isWeekend ? (allWeekdayVotes[day] ?? 0) : 0;
                      const weekendMaxCount =
                        inRange && isWeekend && allWeekendHourVotes[day]
                          ? Math.max(...Object.values(allWeekendHourVotes[day]))
                          : 0;
                      const isTopVote =
                        weekdayCount === maxVoteCount && weekdayCount > 0;

                      if (!inRange || !clickable) {
                        return (
                          <div
                            key={di}
                            className={`aspect-square flex items-center justify-center text-xs ${!inRange ? (isSun ? "text-red-200" : isSat ? "text-blue-200" : "text-stone-200") : isSun ? "text-red-300" : isSat ? "text-blue-300" : "text-stone-300"}`}
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
                          className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg transition-all relative
                            ${isMarked ? "bg-stone-900 text-white" : isActive ? "ring-2 ring-stone-300 text-stone-800 font-semibold" : isTopVote ? "bg-emerald-50 ring-1 ring-emerald-200 text-stone-900" : "hover:bg-stone-50 text-stone-700 font-medium"}
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
                  {(Object.keys(allWeekdayVotes).length > 0 ||
                    Object.keys(allWeekendHourVotes).length > 0) && (
                    <div className="flex items-center gap-1 text-xs text-stone-400">
                      <span className="text-[10px] font-bold">N명</span>
                      <span>= 셀 안 응답 인원</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽(데스크톱): 선택 날짜 상세 패널 + 저장 카드 */}
              <div className="hidden md:block space-y-4">
                {activeDateInfo && !cannotAttend ? (
                  <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                    {/* 날짜 헤더 */}
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
                                /{totalMembers - 1}명
                              </span>
                            </p>
                            <p className="text-xs text-stone-400">
                              {poll.time_weekday ?? "22:00"} 가능
                            </p>
                          </div>
                        )}
                    </div>

                    <div className="p-5">
                      {activeDateInfo.isWeekend ? (
                        /* 주말: 시간 복수 선택 */
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
                        /* 평일: 고정 시간 토글 */
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm font-semibold text-stone-800">
                                {poll.time_weekday ?? "22:00"} 시작
                              </p>
                              <p className="text-xs text-stone-400 mt-0.5">
                                평일은 {poll.time_weekday ?? "22:00"} 시작으로
                                고정
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
                              ? `✓ ${poll.time_weekday ?? "22:00"} 가능`
                              : `${poll.time_weekday ?? "22:00"} 가능으로 표시`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : !cannotAttend ? (
                  <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-8 text-center">
                    <p className="text-sm text-stone-400">
                      달력에서 날짜를 선택하세요
                    </p>
                  </div>
                ) : null}

                {/* 선택 요약 + 저장 카드 */}
                {canSave && (
                  <div className="bg-white rounded-2xl border border-stone-200 p-5">
                    {cannotAttend ? (
                      saved ? (
                        <div className="text-center py-2">
                          <p className="text-sm font-bold text-stone-900 mb-1">
                            ✓ 참여 불가로 저장됐어요
                          </p>
                          <p className="text-xs text-stone-400 mt-1">
                            응답 완료로 카운트됩니다
                          </p>
                          <button
                            onClick={() => dispatch({ type: "MARK_UNSAVED" })}
                            className="mt-3 text-xs text-stone-400 underline"
                          >
                            수정하기
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-stone-500 mb-1">
                            이번 일정에 참여하기 어려워요
                          </p>
                          <p className="text-xs text-stone-400 mb-4">
                            불참으로 저장해도 응답 완료로 카운트됩니다.
                          </p>
                          {saveError && (
                            <p className="text-xs text-red-500 mb-2">
                              {saveError}
                            </p>
                          )}
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-50"
                          >
                            {saving ? "저장 중..." : "참여 불가로 저장하기"}
                          </button>
                          <button
                            onClick={() =>
                              dispatch({
                                type: "SET_CANNOT_ATTEND",
                                value: false,
                              })
                            }
                            className="mt-2 w-full text-xs text-stone-400 underline"
                          >
                            날짜 선택으로 돌아가기
                          </button>
                        </div>
                      )
                    ) : (
                      <>
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
                            {saveError && (
                              <p className="text-xs text-red-500 mb-2">
                                {saveError}
                              </p>
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
                      </>
                    )}
                  </div>
                )}

                {/* 참여 불가 버튼 */}
                {!cannotAttend && !saved && (
                  <button
                    onClick={() =>
                      dispatch({ type: "SET_CANNOT_ATTEND", value: true })
                    }
                    className="w-full py-3 border border-dashed border-stone-200 rounded-2xl text-xs text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-all"
                  >
                    이번에 참여 불가
                  </button>
                )}
              </div>
            </div>

            {/* 모바일 전용: 선택 칩 */}
            {selectedDates.size > 0 && !cannotAttend && (
              <div className="md:hidden flex flex-wrap gap-2 mt-3">
                {dates
                  .filter((d) => selectedDates.has(d.date))
                  .map((d) => {
                    const hrs = weekendHours[d.date];
                    const hourLabel = d.isWeekend
                      ? hrs && hrs.size > 0
                        ? [...hrs]
                            .sort((a, b) => a - b)
                            .map((h) => `${h}시`)
                            .join("·")
                        : "시간 미선택"
                      : (poll.time_weekday ?? "22:00");
                    return (
                      <div
                        key={d.date}
                        className="flex items-center gap-1.5 bg-stone-900 text-white rounded-full px-3 py-1.5 text-xs"
                      >
                        <span>
                          {d.date}일 ({d.dayName})
                        </span>
                        <span className="text-stone-400 text-[10px]">
                          {hourLabel}
                        </span>
                        <button
                          onClick={() =>
                            dispatch({ type: "TOGGLE_DATE", date: d.date })
                          }
                          className="text-stone-400 ml-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* 모바일 전용: 참석 불가 상태 카드 */}
            {cannotAttend && (
              <div className="md:hidden mt-4 bg-white rounded-2xl border border-stone-200 p-4">
                <p className="text-sm font-semibold text-stone-700 mb-1">
                  이번 일정에 참여하기 어려워요
                </p>
                <p className="text-xs text-stone-400">
                  아래 버튼으로 저장하거나 날짜 선택으로 돌아갈 수 있어요.
                </p>
              </div>
            )}

            {/* 모바일 전용: 바텀시트 딤 오버레이 */}
            {activeDateInfo && !cannotAttend && (
              <div
                className="md:hidden fixed inset-0 bg-stone-900/30 z-30"
                onClick={() =>
                  dispatch({ type: "SET_ACTIVE_DATE", date: null })
                }
              />
            )}

            {/* 모바일 전용: 바텀시트 */}
            {activeDateInfo && !cannotAttend && (
              <div
                className="md:hidden fixed left-0 right-0 bg-white rounded-t-3xl shadow-2xl ring-1 ring-stone-200/60 z-40"
                style={{ bottom: 68 }}
              >
                {/* 드래그 핸들 */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-stone-300" />
                </div>

                <div className="px-4 pt-2 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-base font-black text-stone-900">
                        {poll.month}월 {activeDate}일 ({activeDateInfo.dayName})
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {activeDateInfo.isWeekend ? "주말" : "평일"}
                        {activeDateInfo.isWeekend &&
                          weekendHourVotes[activeDateInfo.date] &&
                          Object.keys(weekendHourVotes[activeDateInfo.date])
                            .length > 0 && (
                            <span>
                              {" "}
                              · 다른 멤버{" "}
                              {
                                otherResponses.filter((r) =>
                                  r.selected_dates.some(
                                    (s) => s.date === activeDateInfo.date,
                                  ),
                                ).length
                              }
                              명 응답
                            </span>
                          )}
                        {!activeDateInfo.isWeekend &&
                          weekdayVotes[activeDate!] !== undefined && (
                            <span>
                              {" "}
                              · 다른 멤버 {weekdayVotes[activeDate!]}명 응답
                            </span>
                          )}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        dispatch({ type: "SET_ACTIVE_DATE", date: null })
                      }
                      className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  {activeDateInfo.isWeekend ? (
                    <>
                      <p className="text-[11px] font-semibold text-stone-600 mb-2.5">
                        참여 가능한 시작 시간을 선택하세요
                      </p>
                      <div className="grid grid-cols-4 gap-1.5 mb-4">
                        {weekendHourRange.map((hour) => {
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
                              className={`rounded-xl py-2.5 text-[11px] font-semibold flex flex-col items-center gap-0.5 border ${
                                mySelected
                                  ? "bg-stone-900 text-white border-transparent"
                                  : "border-stone-200 text-stone-500"
                              }`}
                            >
                              <span>{hour}시</span>
                              {othersCount > 0 && (
                                <span
                                  className={`text-[9px] ${mySelected ? "text-stone-400" : "text-blue-400"}`}
                                >
                                  {othersCount}명
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="mb-4">
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
                            : "border-stone-200 bg-white text-stone-700"
                        }`}
                      >
                        {selectedDates.has(activeDateInfo.date)
                          ? `✓ ${poll.time_weekday ?? "22:00"} 가능`
                          : `${poll.time_weekday ?? "22:00"} 가능으로 표시`}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      dispatch({ type: "SET_ACTIVE_DATE", date: null })
                    }
                    className="w-full bg-stone-900 text-white rounded-2xl py-3 text-sm font-bold"
                  >
                    완료
                  </button>
                </div>
              </div>
            )}

            {/* 모바일 전용: 하단 고정 액션바 */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 z-30 flex gap-2">
              {saveError && (
                <p className="absolute -top-6 left-4 text-xs text-red-500">
                  {saveError}
                </p>
              )}
              {saved ? (
                <div className="flex-1 flex items-center justify-between px-1">
                  <p className="text-sm font-semibold text-stone-700">
                    ✓ 저장됐어요
                  </p>
                  <button
                    onClick={() => dispatch({ type: "MARK_UNSAVED" })}
                    className="text-xs text-stone-400 underline"
                  >
                    수정하기
                  </button>
                </div>
              ) : cannotAttend ? (
                <>
                  <button
                    onClick={() =>
                      dispatch({ type: "SET_CANNOT_ATTEND", value: false })
                    }
                    className="flex-1 border border-stone-200 text-stone-500 rounded-2xl py-2.5 text-sm font-medium"
                  >
                    날짜 선택으로
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-[2] bg-stone-900 text-white rounded-2xl py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "참여 불가로 저장"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() =>
                      dispatch({ type: "SET_CANNOT_ATTEND", value: true })
                    }
                    className="flex-1 border border-stone-200 text-stone-500 rounded-2xl py-2.5 text-sm font-medium"
                  >
                    참석 불가
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!canSave || saving}
                    className="flex-[2] bg-stone-900 text-white rounded-2xl py-2.5 text-sm font-bold disabled:opacity-40"
                  >
                    {saving ? "저장 중..." : "저장하기"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* 득표 현황 팝업 */}
      {closePhase === "tally" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
                  {MONTH_KO}
                </p>
                <h2 className="text-lg font-black text-stone-900">득표 현황</h2>
                <p className="text-xs text-stone-400 mt-1">
                  {respondedCount}/{totalMembers}명 응답 완료
                  {cannotAttendCount > 0 && (
                    <span className="ml-2 text-stone-400">
                      (불참 {cannotAttendCount}명)
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setClosePhase(null)}
                className="text-stone-400 hover:text-stone-600 text-xl font-light transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
              <div className="space-y-2">
                {voteTally.length > 0 ? (
                  voteTally.map((item, idx) => {
                    const isTop = item.count === voteTally[0]?.count;
                    return (
                      <div
                        key={`${item.date}-${item.time}`}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          isTop
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-stone-100 bg-white"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 bg-white border border-stone-100">
                          <span className="text-sm font-black text-stone-900">
                            {item.date}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {item.dayName}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-stone-800">
                            {poll.month}월 {item.date}일 ({item.dayName}){" "}
                            {item.time}
                          </p>
                          {isTop && idx === 0 && (
                            <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                              최다 득표
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <p className="text-sm font-black text-stone-900">
                            {item.voters.length}
                            <span className="text-xs font-normal text-stone-400">
                              /{totalMembers}명
                            </span>
                          </p>
                          {/* 스택 아바타 (최대 5개 + +N 오버플로우) */}
                          <div className="flex">
                            {item.voters.slice(0, 5).map((v, i) => (
                              <div
                                key={v.memberId}
                                style={{ marginLeft: i === 0 ? 0 : -8 }}
                              >
                                <div
                                  className={`w-6 h-6 ${memberColorClass(v.memberId)} rounded-full flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white`}
                                  title={v.name}
                                >
                                  {v.name[0]}
                                </div>
                              </div>
                            ))}
                            {item.voters.length > 5 && (
                              <div
                                style={{ marginLeft: -8 }}
                                className="w-6 h-6 bg-stone-200 rounded-full flex items-center justify-center text-stone-500 text-[9px] font-bold ring-2 ring-white"
                              >
                                +{item.voters.length - 5}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
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
                onClick={() => setClosePhase(null)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
              >
                닫기
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

      {/* 날짜 확정 모달 */}
      {closePhase === "date-modal" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
                마감하기
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
                    const isSelected =
                      confirmedDate?.date === item.date &&
                      confirmedDate?.time === item.time;
                    return (
                      <button
                        key={`${item.date}-${item.time}`}
                        onClick={() =>
                          setConfirmedDate({ date: item.date, time: item.time })
                        }
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? "border-stone-900 bg-stone-900 text-white"
                            : isTop
                              ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400"
                              : "border-stone-100 bg-white hover:border-stone-200"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 bg-white/20">
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
                            <span
                              className={`text-xs font-normal ${isSelected ? "text-stone-400" : "text-stone-400"}`}
                            >
                              /{totalMembers}명
                            </span>
                          </p>
                          <div className="flex gap-0.5 justify-end mt-1">
                            {Array.from({ length: totalMembers }, (_, i) => (
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
                  setClosePhase("tally");
                  setConfirmedDate(null);
                }}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
              >
                ← 돌아가기
              </button>
              <button
                disabled={!confirmedDate || confirming}
                onClick={handleConfirm}
                className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirming
                  ? "확정 중..."
                  : confirmedDate
                    ? "이 날짜로 확정"
                    : "날짜를 선택하세요"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editModalOpen && (
        <EditPollModal
          poll={poll}
          hasVotes={responses.length > 0}
          onClose={() => setEditModalOpen(false)}
          onSaveMeta={handleUpdateMeta}
          onSaveSchedule={handleUpdateSchedule}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl">
            <p className="text-sm font-bold text-stone-900 mb-1">
              일정을 삭제할까요?
            </p>
            <p className="text-xs text-stone-400 mb-5">
              투표 응답도 함께 삭제되며 되돌릴 수 없어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeletePoll}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 새 일정 만들기 플로우 ---

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
  onSelect: (type: PollType) => void;
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
  disabled,
}: {
  pollType: PollType;
  onBack: () => void;
  onSubmit: (data: PollFormData) => void;
  disabled?: boolean;
}) {
  const isOnline = pollType === "online";
  const [dateFrom, setDateFrom] = useState(
    isOnline ? "2026-03-01" : "2026-03-07",
  );
  const [dateTo, setDateTo] = useState(isOnline ? "2026-03-10" : "2026-03-15");
  const [weekdayTime, setWeekdayTime] = useState("22:00");
  const [weekendStart, setWeekendStart] = useState("10:00");
  const [weekendEnd, setWeekendEnd] = useState(isOnline ? "22:00" : "18:00");
  const [location, setLocation] = useState("");

  const handleSubmit = () => {
    onSubmit({
      dateFrom,
      dateTo,
      timeWeekday: isOnline ? weekdayTime : null,
      timeStart: weekendStart,
      timeEnd: weekendEnd,
      location: location.trim() || null,
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
                  value={weekdayTime}
                  onChange={(e) => setWeekdayTime(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            )}
            <div className="flex items-center justify-between bg-stone-50 rounded-xl px-4 py-2.5">
              <span className="text-sm text-stone-500">주말</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={weekendStart}
                  onChange={(e) => setWeekendStart(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
                <span className="text-stone-400 text-xs">~</span>
                <input
                  type="time"
                  value={weekendEnd}
                  onChange={(e) => setWeekendEnd(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {!isOnline && (
          <div className="p-5">
            <label className="text-xs font-semibold text-stone-500 block mb-3">
              장소
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 강남역 카페, 잠실 공유 오피스"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-stone-400 placeholder:text-stone-300"
            />
          </div>
        )}

        <div className="p-5">
          <button
            onClick={handleSubmit}
            disabled={disabled}
            className="w-full py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {disabled ? "생성 중..." : "일정 만들기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 수정 모달 ---

function EditPollModal({
  poll,
  hasVotes,
  onClose,
  onSaveMeta,
  onSaveSchedule,
}: {
  poll: VotePoll;
  hasVotes: boolean;
  onClose: () => void;
  onSaveMeta: (data: UpdatePollMetaData) => Promise<void>;
  onSaveSchedule: (data: UpdatePollScheduleData) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 메타 정보
  const [location, setLocation] = useState(poll.location ?? "");
  const [meetingUrl, setMeetingUrl] = useState(poll.meeting_url ?? "");
  const [meetingPassword, setMeetingPassword] = useState(
    poll.meeting_password ?? "",
  );

  // 일정 범위 (투표 없을 때만 수정 가능)
  const [dateFrom, setDateFrom] = useState(poll.date_from);
  const [dateTo, setDateTo] = useState(poll.date_to);
  const [timeWeekday, setTimeWeekday] = useState(poll.time_weekday ?? "22:00");
  const [timeStart, setTimeStart] = useState(poll.time_start);
  const [timeEnd, setTimeEnd] = useState(poll.time_end);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const metaChanged =
      location !== (poll.location ?? "") ||
      meetingUrl !== (poll.meeting_url ?? "") ||
      meetingPassword !== (poll.meeting_password ?? "");

    const scheduleChanged =
      !hasVotes &&
      (dateFrom !== poll.date_from ||
        dateTo !== poll.date_to ||
        timeWeekday !== (poll.time_weekday ?? "22:00") ||
        timeStart !== poll.time_start ||
        timeEnd !== poll.time_end);

    if (metaChanged) {
      await onSaveMeta({
        location: location.trim() || null,
        meeting_url: meetingUrl.trim() || null,
        meeting_password: meetingPassword.trim() || null,
      });
    }
    if (scheduleChanged) {
      await onSaveSchedule({
        date_from: dateFrom,
        date_to: dateTo,
        time_weekday: poll.type === "online" ? timeWeekday : null,
        time_start: timeStart,
        time_end: timeEnd,
      });
    }
    if (!metaChanged && !scheduleChanged) {
      onClose();
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <p className="text-sm font-bold text-stone-900">일정 수정</p>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 날짜 범위 — 투표 없을 때만 */}
          {!hasVotes && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2">
                날짜 범위
              </p>
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
          )}

          {/* 시간 — 투표 없을 때만 */}
          {!hasVotes && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2">
                {poll.type === "online" ? "평일 시간" : "시간 범위"}
              </p>
              {poll.type === "online" ? (
                <input
                  type="time"
                  value={timeWeekday}
                  onChange={(e) => setTimeWeekday(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                  />
                  <span className="text-stone-400">~</span>
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                  />
                </div>
              )}
            </div>
          )}

          {hasVotes && (
            <p className="text-xs text-stone-400 bg-stone-50 rounded-xl px-3 py-2.5">
              이미 투표한 멤버가 있어 날짜·시간은 수정할 수 없어요.
            </p>
          )}

          {/* 메타 정보 */}
          {poll.type === "offline" && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2">장소</p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 강남역 스타벅스"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
              />
            </div>
          )}
          {poll.type === "online" && (
            <>
              <div>
                <p className="text-xs font-semibold text-stone-500 mb-2">
                  회의 링크
                </p>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 mb-2">
                  비밀번호
                </p>
                <input
                  type="text"
                  value={meetingPassword}
                  onChange={(e) => setMeetingPassword(e.target.value)}
                  placeholder="없으면 비워두세요"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              </div>
            </>
          )}

          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        </div>

        <div className="p-5 border-t border-stone-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
