import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { VotePoll, VoteResponse, DateInfo, TallyItem } from "../types";
import { DAY_NAMES } from "../types";
import {
  getVoteResponses,
  getTotalMemberCount,
  getMemberInfo,
  upsertVoteResponse,
  createPoll,
  confirmPoll,
  updatePollMeta,
  updatePollSchedule,
  deletePoll,
  type MemberInfo,
  type UpdatePollMetaData,
  type UpdatePollScheduleData,
} from "../lib/vote";
import VoteCalendar from "./vote/VoteCalendar";
import TallyPopup, { type ClosePhase } from "./vote/TallyPopup";
import VoteResult from "./vote/VoteResult";
import {
  EmptyState,
  PresetSelect,
  PollForm,
  EditPollModal,
  type PollType,
} from "./vote/PollAdmin";

// --- Utility functions ---

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

function computeVoteTally(
  allResponses: VoteResponse[],
  dates: DateInfo[],
  poll: VotePoll,
  memberNicknames: Record<string, MemberInfo>,
): TallyItem[] {
  const items: TallyItem[] = [];

  for (const dateInfo of dates) {
    if (dateInfo.isWeekend) {
      // 주말: (날짜 × 시간) 단위로 각각 집계
      const hourCounts: Record<number, number> = {};
      const hourVoters: Record<
        number,
        { memberId: string; name: string; avatarUrl: string | null }[]
      > = {};
      for (const r of allResponses) {
        const sel = r.selected_dates.find((s) => s.date === dateInfo.date);
        for (const h of sel?.hours ?? []) {
          hourCounts[h] = (hourCounts[h] ?? 0) + 1;
          if (!hourVoters[h]) hourVoters[h] = [];
          hourVoters[h].push({
            memberId: r.member_id,
            name: memberNicknames[r.member_id]?.nickname ?? r.member_id,
            avatarUrl: memberNicknames[r.member_id]?.avatarUrl ?? null,
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
          name: memberNicknames[r.member_id]?.nickname ?? r.member_id,
          avatarUrl: memberNicknames[r.member_id]?.avatarUrl ?? null,
        })),
      });
    }
  }

  return items.sort((a, b) => b.count - a.count);
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

interface Props {
  memberId: string;
  poll: VotePoll | null;
  onPollChange: (poll: VotePoll | null) => void;
}

export default function VotePage({ memberId, poll, onPollChange }: Props) {
  const [responses, setResponses] = useState<VoteResponse[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [memberNicknames, setMemberNicknames] = useState<
    Record<string, MemberInfo>
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

  // useMemo는 early return 전에 반드시 호출되어야 함 (hooks 순서 고정)
  const dates = useMemo(
    () => (poll ? buildDates(poll.date_from, poll.date_to) : []),
    [poll?.date_from, poll?.date_to],
  );
  const voteTally = useMemo(
    () =>
      poll ? computeVoteTally(responses, dates, poll, memberNicknames) : [],
    [responses, dates, poll, memberNicknames],
  );

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
          getMemberInfo(),
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

  const handleCreatePoll = async (data: {
    dateFrom: string;
    dateTo: string;
    timeWeekday: string | null;
    timeStart: string;
    timeEnd: string;
    location: string | null;
  }) => {
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

  // --- 새 일정 만들기 플로우 ---
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
          <VoteResult
            poll={poll}
            confirmedDay={confirmedDay}
            confirmedDateInfo={confirmedDateInfo ?? undefined}
            confirmedTallyItem={confirmedTallyItem ?? undefined}
            memberNicknames={memberNicknames}
            onCreateNext={() => setCreateStep("preset")}
            onEdit={() => setEditModalOpen(true)}
            onDelete={() => setDeleteConfirmOpen(true)}
          />
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
              <VoteCalendar
                poll={poll}
                dates={dates}
                calendarRows={calendarRows}
                selectedDates={selectedDates}
                activeDate={activeDate}
                allWeekdayVotes={allWeekdayVotes}
                allWeekendHourVotes={allWeekendHourVotes}
                maxVoteCount={maxVoteCount}
                dateFromDay={dateFromDay}
                dateToDay={dateToDay}
                monthKO={MONTH_KO}
                onToggleDate={(date) => dispatch({ type: "TOGGLE_DATE", date })}
              />

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

      {/* 득표 현황 팝업 + 날짜 확정 모달 */}
      {closePhase && (
        <TallyPopup
          closePhase={closePhase}
          onSetClosePhase={setClosePhase}
          voteTally={voteTally}
          totalMembers={totalMembers}
          respondedCount={respondedCount}
          cannotAttendCount={cannotAttendCount}
          monthKO={MONTH_KO}
          poll={poll}
          confirmedDate={confirmedDate}
          onSelectConfirmedDate={setConfirmedDate}
          confirming={confirming}
          onConfirm={handleConfirm}
        />
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
