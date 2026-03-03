// DEV ONLY — Preview 2: 투표 중 화면 (Split 레이아웃, 가능 모드만)
import { useState } from "react";
import { Switcher } from "./shared";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// March 2026: 1일=일요일
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

// March 2026 달력 rows (1일 = 일요일, di=0)
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

export default function VoteV2VoteA() {
  const [selectedDates, setSelectedDates] = useState(new Set<number>());
  const [weekendHours, setWeekendHours] = useState<Record<number, Set<number>>>(
    {},
  );
  const [activeDate, setActiveDate] = useState<number | null>(3);
  const [saved, setSaved] = useState(false);

  const toggleDate = (day: number) => {
    const next = new Set(selectedDates);
    if (next.has(day)) {
      next.delete(day);
      const nextH = { ...weekendHours };
      delete nextH[day];
      setWeekendHours(nextH);
    } else {
      next.add(day);
    }
    setSelectedDates(next);
    setActiveDate(day);
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

  const activeDateInfo = POLL_DATES.find((d) => d.date === activeDate);

  const canSave = (() => {
    if (selectedDates.size === 0) return false;
    for (const date of selectedDates) {
      const info = POLL_DATES.find((d) => d.date === date);
      if (info?.isWeekend && !(weekendHours[date]?.size > 0)) return false;
    }
    return true;
  })();

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              3월에 하는 2월 회고 · 온라인
            </span>
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-3 py-1.5">
              4/5명 응답
            </span>
            <button className="text-xs text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 hover:border-stone-400 hover:text-stone-700 transition-all">
              일정 마감
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <p className="text-sm text-stone-500 mb-5">
          가능한 날짜와 시간을 선택하세요. 평일은 22:00, 주말은 원하는 시간대를
          고르면 돼요.
        </p>

        <div className="grid grid-cols-[1fr_1.15fr] gap-6 items-start">
          {/* 왼쪽: 달력 */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-stone-800">
                2026년 3월
              </span>
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
                  const isWeekend =
                    dateInfo?.isWeekend ?? (di === 0 || di === 6);
                  const isMarked = selectedDates.has(day);
                  const isActive = activeDate === day;
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
                      onClick={() => toggleDate(day)}
                      className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg transition-all
                        ${isMarked ? "bg-stone-900 text-white" : isActive ? "ring-2 ring-stone-300 text-stone-800 font-semibold" : isTopVote ? "bg-emerald-50 ring-1 ring-emerald-200 text-stone-900" : "hover:bg-stone-50 text-stone-700 font-medium"}
                        ${!isMarked && !isActive && isSun ? "text-red-500" : ""}
                        ${!isMarked && !isActive && isSat ? "text-blue-500" : ""}
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
                        <span className="text-[9px] leading-none opacity-40">
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
                <div className="w-3 h-3 rounded bg-emerald-50 ring-1 ring-emerald-200" />
                <span>최다 득표</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-stone-400">
                <span className="text-[10px] font-bold">N명</span>
                <span>= 다른 멤버 응답 수</span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 날짜 상세 패널 */}
          <div className="space-y-4">
            {activeDateInfo ? (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-400 mb-0.5">선택한 날짜</p>
                    <p className="text-lg font-black text-stone-900">
                      3월 {activeDate}일 ({activeDateInfo.dayName})
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {activeDateInfo.isWeekend ? "주말" : "평일"}
                    </p>
                  </div>
                  {!activeDateInfo.isWeekend &&
                    WEEKDAY_VOTES[activeDate!] !== undefined && (
                      <div className="text-right">
                        <p className="text-xs text-stone-400 mb-1">
                          다른 멤버 응답
                        </p>
                        <p className="text-xl font-black text-stone-900">
                          {WEEKDAY_VOTES[activeDate!]}
                          <span className="text-sm font-normal text-stone-400">
                            /4명
                          </span>
                        </p>
                        <p className="text-xs text-stone-400">22:00 가능</p>
                      </div>
                    )}
                </div>

                <div className="p-5">
                  {activeDateInfo.isWeekend ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-stone-600">
                          가능한 시작 시간
                        </p>
                        <p className="text-xs text-stone-400">복수 선택</p>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {WEEKEND_HOURS.map((hour) => {
                          const mySelected =
                            weekendHours[activeDateInfo.date]?.has(hour) ??
                            false;
                          const othersCount =
                            WEEKEND_HOUR_VOTES[activeDateInfo.date]?.[hour] ??
                            0;
                          return (
                            <button
                              key={hour}
                              onClick={() =>
                                toggleHour(activeDateInfo.date, hour)
                              }
                              className={`py-2 rounded-lg text-xs font-medium transition-all ${mySelected ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200"}`}
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
                          onClick={() => toggleDate(activeDateInfo.date)}
                          className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600 mt-3 block"
                        >
                          이 날짜 선택 해제
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-semibold text-stone-800">
                            22:00 시작
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            평일은 22:00 고정
                          </p>
                        </div>
                        {WEEKDAY_VOTES[activeDateInfo.date] !== undefined && (
                          <span className="text-xs text-stone-500">
                            {WEEKDAY_VOTES[activeDateInfo.date]}명 가능
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleDate(activeDateInfo.date)}
                        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all border-2 ${selectedDates.has(activeDateInfo.date) ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"}`}
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

            {canSave && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                {saved ? (
                  <div className="text-center py-2">
                    <p className="text-sm font-bold text-stone-900 mb-1">
                      ✓ 저장됐어요
                    </p>
                    <button
                      onClick={() => setSaved(false)}
                      className="text-xs text-stone-400 underline mt-2"
                    >
                      수정하기
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-stone-500 mb-3">
                      선택 요약
                    </p>
                    <div className="space-y-1 mb-4">
                      {[...selectedDates]
                        .sort((a, b) => a - b)
                        .map((d) => {
                          const info = POLL_DATES.find((p) => p.date === d);
                          if (!info) return null;
                          if (!info.isWeekend)
                            return (
                              <p key={d} className="text-xs text-stone-600">
                                {d}일 ({info.dayName}) 22:00
                              </p>
                            );
                          const h = weekendHours[d];
                          const hList =
                            h && h.size > 0
                              ? [...h]
                                  .sort((a, b) => a - b)
                                  .map((hr) => `${hr}시`)
                                  .join(" · ")
                              : "시간 미선택";
                          return (
                            <p key={d} className="text-xs text-stone-600">
                              {d}일 ({info.dayName}) {hList}
                            </p>
                          );
                        })}
                    </div>
                    <button
                      onClick={() => setSaved(true)}
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
      </div>

      <Switcher current={2} total={4} />
    </div>
  );
}
