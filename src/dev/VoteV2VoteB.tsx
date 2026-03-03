// DEV ONLY — Preview 3: 투표 중 화면 (단일 컬럼, 모바일 친화)
// 달력 전체 너비 + 선택 주말 날짜 인라인 시간 선택 + 하단 고정 저장 바
import { useState } from "react";
import { Switcher } from "./shared";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

const POLL_DATES = [
  { date: 1, dayName: "일", isWeekend: true },
  { date: 2, dayName: "월", isWeekend: false },
  { date: 3, dayName: "화", isWeekend: false },
  { date: 4, dayName: "수", isWeekend: false },
  { date: 5, dayName: "목", isWeekend: false },
  { date: 6, dayName: "금", isWeekend: false },
  { date: 7, dayName: "토", isWeekend: true },
  { date: 8, dayName: "일", isWeekend: true },
  { date: 9, dayName: "월", isWeekend: false },
  { date: 10, dayName: "화", isWeekend: false },
];

const WEEKDAY_VOTES: Record<number, number> = {
  2: 2,
  3: 3,
  4: 2,
  5: 1,
  6: 2,
  9: 3,
  10: 1,
};
const WEEKEND_HOUR_VOTES: Record<number, Record<number, number>> = {
  1: { 10: 1, 14: 2 },
  7: { 14: 2, 15: 1, 20: 1 },
  8: { 14: 3, 20: 2 },
};
const WEEKEND_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function buildRows(): (number | null)[][] {
  const cells: (number | null)[] = [];
  for (let d = 1; d <= 31; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
const CALENDAR_ROWS = buildRows();
const maxWeekdayVote = Math.max(...Object.values(WEEKDAY_VOTES));

export default function VoteV2VoteB() {
  const [selectedDates, setSelectedDates] = useState(new Set<number>());
  const [weekendHours, setWeekendHours] = useState<Record<number, Set<number>>>(
    {},
  );
  const [expandedWeekend, setExpandedWeekend] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleDate = (day: number, isWeekend: boolean) => {
    const next = new Set(selectedDates);
    if (next.has(day)) {
      next.delete(day);
      const nextH = { ...weekendHours };
      delete nextH[day];
      setWeekendHours(nextH);
      if (expandedWeekend === day) setExpandedWeekend(null);
    } else {
      next.add(day);
      if (isWeekend) setExpandedWeekend(day);
    }
    setSelectedDates(next);
    setSaved(false);
  };

  const toggleHour = (date: number, hour: number) => {
    const cur = weekendHours[date]
      ? new Set(weekendHours[date])
      : new Set<number>();
    if (cur.has(hour)) cur.delete(hour);
    else cur.add(hour);
    const nextDates = new Set(selectedDates);
    nextDates.add(date);
    setSelectedDates(nextDates);
    setWeekendHours({ ...weekendHours, [date]: cur });
    setSaved(false);
  };

  const canSave = (() => {
    if (selectedDates.size === 0) return false;
    for (const date of selectedDates) {
      const info = POLL_DATES.find((d) => d.date === date);
      if (info?.isWeekend && !(weekendHours[date]?.size > 0)) return false;
    }
    return true;
  })();

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              3월에 하는 2월 회고 · 온라인
            </span>
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-3 py-1.5">
              4/5명 응답
            </span>
            <button className="text-xs text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 hover:border-stone-400 hover:text-stone-700 transition-all">
              마감
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5">
        <p className="text-xs text-stone-400 mb-4">
          가능한 날짜를 클릭하세요. 주말은 시간도 선택할 수 있어요.
        </p>

        {/* 달력 (전체 너비) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-stone-800">2026년 3월</span>
            <span className="text-xs text-stone-400 bg-stone-50 rounded-full px-2 py-0.5">
              1~10일
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

          {CALENDAR_ROWS.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7">
              {row.map((day, di) => {
                if (!day) return <div key={di} className="aspect-square" />;
                const inRange = day <= 10;
                const dateInfo = POLL_DATES.find((d) => d.date === day);
                const isWeekend = dateInfo?.isWeekend ?? (di === 0 || di === 6);
                const isMarked = selectedDates.has(day);
                const isSun = di === 0;
                const isSat = di === 6;
                const weekdayCount =
                  inRange && !isWeekend ? (WEEKDAY_VOTES[day] ?? 0) : 0;
                const weekendMaxCount =
                  inRange && isWeekend && WEEKEND_HOUR_VOTES[day]
                    ? Math.max(...Object.values(WEEKEND_HOUR_VOTES[day]))
                    : 0;
                const isTopVote =
                  weekdayCount === maxWeekdayVote && weekdayCount > 0;
                const isExpanded = expandedWeekend === day;

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

                return (
                  <button
                    key={di}
                    onClick={() => {
                      if (isWeekend && !isMarked)
                        setExpandedWeekend(
                          expandedWeekend === day ? null : day,
                        );
                      toggleDate(day, isWeekend);
                    }}
                    className={`aspect-square flex flex-col items-center justify-center text-xs rounded-xl transition-all
                      ${isMarked ? (isExpanded ? "bg-stone-900 text-white ring-2 ring-stone-400" : "bg-stone-900 text-white") : isTopVote ? "bg-emerald-50 ring-1 ring-emerald-200 text-stone-900" : "hover:bg-stone-50 text-stone-700 font-medium"}
                      ${!isMarked && isSun ? "text-red-500" : ""}
                      ${!isMarked && isSat ? "text-blue-500" : ""}
                    `}
                  >
                    <span className="font-semibold">{day}</span>
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
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* 선택된 주말 인라인 시간 선택 */}
        {expandedWeekend &&
          selectedDates.has(expandedWeekend) &&
          (() => {
            const info = POLL_DATES.find((d) => d.date === expandedWeekend);
            if (!info) return null;
            return (
              <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-stone-800">
                    3월 {expandedWeekend}일 ({info.dayName}) 가능 시간
                  </p>
                  <p className="text-xs text-stone-400">복수 선택</p>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {WEEKEND_HOURS.map((hour) => {
                    const mySelected =
                      weekendHours[expandedWeekend]?.has(hour) ?? false;
                    const othersCount =
                      WEEKEND_HOUR_VOTES[expandedWeekend]?.[hour] ?? 0;
                    return (
                      <button
                        key={hour}
                        onClick={() => toggleHour(expandedWeekend, hour)}
                        className={`py-2.5 rounded-xl text-xs font-medium transition-all ${mySelected ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200"}`}
                      >
                        <span>{hour}시</span>
                        {othersCount > 0 && (
                          <span
                            className={`block text-[9px] mt-0.5 ${mySelected ? "text-stone-400" : "text-stone-400"}`}
                          >
                            {othersCount}명
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => toggleDate(expandedWeekend, true)}
                  className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600 mt-3 block"
                >
                  이 날짜 선택 해제
                </button>
              </div>
            );
          })()}

        {/* 선택 현황 */}
        {selectedDates.size > 0 && (
          <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
            <p className="text-xs font-semibold text-stone-500 mb-2">
              선택한 날짜
            </p>
            <div className="flex flex-wrap gap-2">
              {[...selectedDates]
                .sort((a, b) => a - b)
                .map((d) => {
                  const info = POLL_DATES.find((p) => p.date === d);
                  if (!info) return null;
                  const needsHours =
                    info.isWeekend && !(weekendHours[d]?.size > 0);
                  return (
                    <span
                      key={d}
                      className={`text-xs rounded-full px-2.5 py-1 font-medium ${needsHours ? "bg-amber-100 text-amber-700" : "bg-stone-200 text-stone-700"}`}
                    >
                      {d}일{needsHours ? " (시간 선택 필요)" : ""}
                    </span>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* 하단 고정 저장 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 px-4 py-3 z-40">
        <div className="max-w-lg mx-auto">
          {saved ? (
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-stone-900">✓ 저장됐어요</p>
              <button
                onClick={() => setSaved(false)}
                className="text-xs text-stone-400 underline"
              >
                수정하기
              </button>
            </div>
          ) : (
            <button
              disabled={!canSave}
              onClick={() => setSaved(true)}
              className="w-full py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {canSave ? "저장하기" : "가능한 날짜를 선택하세요"}
            </button>
          )}
        </div>
      </div>

      <Switcher current={3} total={4} />
    </div>
  );
}
