// DEV ONLY — Schedule Layout 2: 날짜 목록 (아코디언 리스트)
import { useState } from "react";
import { Switcher } from "./shared";

const DATES = [
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

const WEEKEND_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const WEEKDAY_VOTES: Record<number, number> = {
  2: 4,
  3: 5,
  4: 3,
  5: 4,
  6: 5,
  9: 5,
  10: 4,
};
const WEEKEND_HOUR_VOTES: Record<number, Record<number, number>> = {
  1: { 14: 3, 15: 2, 16: 4, 17: 3, 18: 3, 20: 2 },
  7: { 14: 3, 15: 4, 16: 5, 17: 3, 18: 4, 20: 2 },
  8: { 10: 2, 12: 3, 14: 4, 15: 3, 16: 3, 18: 2 },
};

type Mode = "available" | "unavailable";

export default function Schedule2() {
  const [mode, setMode] = useState<Mode>("available");
  const [selectedDates, setSelectedDates] = useState<Set<number>>(new Set());
  const [weekendHours, setWeekendHours] = useState<Record<number, Set<number>>>(
    {},
  );
  const [expandedDate, setExpandedDate] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleDate = (date: number, isWeekend: boolean) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
        if (isWeekend)
          setWeekendHours((h) => {
            const n = { ...h };
            delete n[date];
            return n;
          });
      } else {
        next.add(date);
        if (isWeekend && mode === "available") setExpandedDate(date);
      }
      return next;
    });
    setSaved(false);
  };

  const toggleHour = (date: number, hour: number) => {
    setWeekendHours((prev) => {
      const cur = prev[date] ? new Set(prev[date]) : new Set<number>();
      if (cur.has(hour)) cur.delete(hour);
      else cur.add(hour);
      return { ...prev, [date]: new Set(cur) };
    });
    setSaved(false);
  };

  const getSummaryLines = () => {
    if (mode === "available") {
      return DATES.filter((d) => selectedDates.has(d.date)).map((d) => {
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
      return DATES.filter((d) => !selectedDates.has(d.date)).map((d) => {
        if (!d.isWeekend) return `${d.date}일 (${d.dayName}) 22:00`;
        return `${d.date}일 (${d.dayName}) 전체`;
      });
    }
  };

  const canSave =
    mode === "available"
      ? selectedDates.size > 0
      : selectedDates.size < DATES.length;

  return (
    <div className="min-h-screen bg-stone-50 pb-32">
      {/* 헤더 */}
      <div className="bg-white border-b border-stone-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-400 font-medium">
                3월 회고
              </span>
              <h1 className="text-lg font-black text-stone-900 mt-0.5">
                일정 조율
              </h1>
            </div>
            <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-3 py-1.5">
              5/6명 응답
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-5">
        {/* 모드 토글 */}
        <div className="flex bg-stone-100 rounded-full p-0.5 mb-4">
          <button
            onClick={() => {
              setMode("available");
              setSelectedDates(new Set());
              setWeekendHours({});
              setSaved(false);
            }}
            className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all ${mode === "available" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
          >
            가능한 날 선택
          </button>
          <button
            onClick={() => {
              setMode("unavailable");
              setSelectedDates(new Set());
              setWeekendHours({});
              setSaved(false);
            }}
            className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all ${mode === "unavailable" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
          >
            불가능한 날 선택
          </button>
        </div>

        <p className="text-xs text-stone-400 mb-4 text-center">
          {mode === "available"
            ? "참여 가능한 날짜를 모두 선택하세요"
            : "참여할 수 없는 날짜를 선택하세요 — 나머지는 모두 가능으로 처리돼요"}
        </p>

        {/* 날짜 목록 */}
        <div className="space-y-2">
          {DATES.map((d) => {
            const isMarked = selectedDates.has(d.date);
            const isExpanded =
              expandedDate === d.date && mode === "available" && d.isWeekend;
            const selectedHours = weekendHours[d.date];
            const isUnavailMode = mode === "unavailable";

            return (
              <div
                key={d.date}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isMarked
                    ? isUnavailMode
                      ? "border-stone-200 opacity-60"
                      : "border-stone-900"
                    : "border-stone-200"
                }`}
              >
                {/* 날짜 행 */}
                <button
                  className="w-full flex items-center px-4 py-3.5 gap-3"
                  onClick={() => {
                    if (d.isWeekend && mode === "available") {
                      if (isExpanded) {
                        setExpandedDate(null);
                      } else {
                        setExpandedDate(d.date);
                        if (!isMarked) toggleDate(d.date, true);
                      }
                    } else {
                      toggleDate(d.date, d.isWeekend);
                    }
                  }}
                >
                  {/* 날짜 뱃지 */}
                  <div
                    className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 transition-colors ${
                      isMarked
                        ? isUnavailMode
                          ? "bg-stone-100"
                          : "bg-stone-900"
                        : "bg-stone-50"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-medium ${isMarked && !isUnavailMode ? "text-stone-400" : "text-stone-400"}`}
                    >
                      {d.dayName}
                    </span>
                    <span
                      className={`text-base font-black leading-none ${
                        isMarked && !isUnavailMode
                          ? "text-white"
                          : isMarked
                            ? "text-stone-400 line-through"
                            : d.dayName === "일"
                              ? "text-red-500"
                              : d.dayName === "토"
                                ? "text-blue-500"
                                : "text-stone-800"
                      }`}
                    >
                      {d.date}
                    </span>
                  </div>

                  {/* 날짜 정보 */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${isMarked && isUnavailMode ? "text-stone-400 line-through" : "text-stone-800"}`}
                      >
                        3월 {d.date}일
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${d.isWeekend ? "bg-blue-50 text-blue-500" : "bg-stone-100 text-stone-400"}`}
                      >
                        {d.isWeekend ? "주말" : "평일 22:00"}
                      </span>
                    </div>
                    {/* 다른 멤버 응답 */}
                    {!d.isWeekend && WEEKDAY_VOTES[d.date] && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        다른 멤버 {WEEKDAY_VOTES[d.date]}명 가능
                      </p>
                    )}
                    {d.isWeekend &&
                      isMarked &&
                      mode === "available" &&
                      selectedHours?.size > 0 && (
                        <p className="text-xs text-stone-500 mt-0.5">
                          {[...selectedHours]
                            .sort((a, b) => a - b)
                            .map((h) => `${h}시`)
                            .join(" · ")}
                        </p>
                      )}
                    {d.isWeekend && !isMarked && mode === "available" && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        {Object.keys(WEEKEND_HOUR_VOTES[d.date] ?? {}).length >
                        0
                          ? `인기 시간: ${Object.entries(
                              WEEKEND_HOUR_VOTES[d.date] ?? {},
                            )
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 2)
                              .map(([h]) => `${h}시`)
                              .join(", ")}`
                          : "시간대 선택 가능"}
                      </p>
                    )}
                  </div>

                  {/* 오른쪽 컨트롤 */}
                  <div className="flex-shrink-0">
                    {isMarked ? (
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isUnavailMode ? "bg-stone-200 text-stone-500" : "bg-stone-900 text-white"}`}
                      >
                        {isUnavailMode ? "✕" : "✓"}
                      </span>
                    ) : d.isWeekend && mode === "available" ? (
                      <span className="text-stone-400 text-sm">
                        {isExpanded ? "↑" : "↓"}
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full border-2 border-stone-200 block" />
                    )}
                  </div>
                </button>

                {/* 주말 시간 선택 (확장) */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-stone-100 pt-3">
                    <p className="text-xs font-semibold text-stone-500 mb-2.5">
                      가능한 시작 시간 (복수 선택)
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {WEEKEND_HOURS.map((hour) => {
                        const mySelected =
                          weekendHours[d.date]?.has(hour) ?? false;
                        const othersCount =
                          WEEKEND_HOUR_VOTES[d.date]?.[hour] ?? 0;
                        return (
                          <button
                            key={hour}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHour(d.date, hour);
                            }}
                            className={`py-2 rounded-lg text-xs font-medium transition-all ${
                              mySelected
                                ? "bg-stone-900 text-white"
                                : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200"
                            }`}
                          >
                            <div>{hour}시</div>
                            {othersCount > 0 && (
                              <div
                                className={`text-[9px] ${mySelected ? "text-stone-400" : "text-stone-400"}`}
                              >
                                {othersCount}명
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 고정 저장 영역 */}
      {canSave && (
        <div className="fixed bottom-14 left-0 right-0 z-20">
          <div className="max-w-lg mx-auto px-5">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-4">
              {saved ? (
                <div className="text-center">
                  <p className="text-sm font-bold text-stone-900 mb-2">
                    ✓ 응답이 저장됐어요
                  </p>
                  <div className="space-y-0.5 mb-3">
                    {getSummaryLines().map((line, i) => (
                      <p key={i} className="text-xs text-stone-500">
                        {line}
                      </p>
                    ))}
                  </div>
                  <button
                    onClick={() => setSaved(false)}
                    className="text-xs text-stone-400 underline"
                  >
                    수정하기
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-stone-500">
                      {selectedDates.size}개 날짜{" "}
                      {mode === "available" ? "가능" : "불가능"}으로 표시됨
                    </p>
                  </div>
                  <button
                    onClick={() => setSaved(true)}
                    className="bg-stone-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-stone-700 transition-colors whitespace-nowrap"
                  >
                    저장하기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Switcher current={2} total={5} />
    </div>
  );
}
