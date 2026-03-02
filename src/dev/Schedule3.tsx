// DEV ONLY — Schedule Layout 3: 날짜 칩 그리드 + 하단 시간 패널
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

const TOTAL_MEMBERS = 6;

type Mode = "available" | "unavailable";

export default function Schedule3() {
  const [mode, setMode] = useState<Mode>("available");
  const [selectedDates, setSelectedDates] = useState<Set<number>>(new Set());
  const [weekendHours, setWeekendHours] = useState<Record<number, Set<number>>>(
    {},
  );
  const [focusDate, setFocusDate] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const focusInfo = DATES.find((d) => d.date === focusDate);

  const handleDateClick = (date: number, isWeekend: boolean) => {
    setSaved(false);
    if (mode === "unavailable") {
      // 날짜 단위 토글
      setSelectedDates((prev) => {
        const next = new Set(prev);
        if (next.has(date)) next.delete(date);
        else next.add(date);
        return next;
      });
      setFocusDate(null);
    } else {
      // 가능 모드: 날짜 선택 + 주말이면 패널 열기
      if (isWeekend) {
        if (focusDate === date) {
          setFocusDate(null);
        } else {
          setFocusDate(date);
          setSelectedDates((prev) => new Set([...prev, date]));
        }
      } else {
        setSelectedDates((prev) => {
          const next = new Set(prev);
          if (next.has(date)) next.delete(date);
          else next.add(date);
          return next;
        });
        setFocusDate(null);
      }
    }
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

  const getDateState = (date: number) => {
    const isSelected = selectedDates.has(date);
    if (mode === "unavailable") return isSelected ? "unavailable" : "neutral";
    if (isSelected) return "available";
    return "neutral";
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
    <div className="min-h-screen bg-stone-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-stone-100 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400 font-medium">3월 회고</span>
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-400">5/6명 응답 완료</p>
            <div className="flex gap-0.5 justify-end mt-1">
              {Array.from({ length: TOTAL_MEMBERS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-1.5 rounded-full ${i < 5 ? "bg-stone-900" : "bg-stone-200"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-5">
        {/* 모드 토글 */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-stone-700">
            {mode === "available"
              ? "가능한 날짜를 선택하세요"
              : "불가능한 날짜를 선택하세요"}
          </p>
          <div className="flex bg-stone-100 rounded-full p-0.5">
            <button
              onClick={() => {
                setMode("available");
                setSelectedDates(new Set());
                setWeekendHours({});
                setFocusDate(null);
                setSaved(false);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${mode === "available" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
            >
              가능
            </button>
            <button
              onClick={() => {
                setMode("unavailable");
                setSelectedDates(new Set());
                setWeekendHours({});
                setFocusDate(null);
                setSaved(false);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${mode === "unavailable" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
            >
              불가능
            </button>
          </div>
        </div>

        {/* 날짜 칩 그리드 */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {DATES.map((d) => {
            const state = getDateState(d.date);
            const isFocus = focusDate === d.date;
            const hours = weekendHours[d.date];
            const hasHours = hours && hours.size > 0;

            let chipStyle = "";
            if (state === "available")
              chipStyle = "bg-stone-900 text-white border-stone-900";
            else if (state === "unavailable")
              chipStyle = "bg-stone-100 text-stone-400 border-stone-200";
            else
              chipStyle = `bg-white text-stone-700 border-stone-200 hover:border-stone-400 ${d.dayName === "일" ? "!text-red-500" : d.dayName === "토" ? "!text-blue-500" : ""}`;

            if (isFocus)
              chipStyle =
                "bg-stone-900 text-white border-stone-900 ring-2 ring-offset-1 ring-stone-400";

            return (
              <button
                key={d.date}
                onClick={() => handleDateClick(d.date, d.isWeekend)}
                className={`border-2 rounded-2xl py-3 flex flex-col items-center justify-center gap-0.5 transition-all ${chipStyle}`}
              >
                <span className={`text-[10px] font-medium opacity-60`}>
                  {d.dayName}
                </span>
                <span className="text-base font-black leading-none">
                  {d.date}
                </span>
                {/* 상태 인디케이터 */}
                {state === "available" && d.isWeekend && hasHours && (
                  <span className="text-[9px] text-stone-300 mt-0.5">
                    {hours!.size}개
                  </span>
                )}
                {state === "available" && !d.isWeekend && (
                  <span className="text-[9px] text-stone-400 mt-0.5">22시</span>
                )}
                {state === "unavailable" && (
                  <span className="text-[9px] text-stone-400 mt-0.5">✕</span>
                )}
                {state === "neutral" && d.isWeekend && (
                  <span className="text-[9px] opacity-40 mt-0.5">주말</span>
                )}
                {/* 다른 멤버 응답 도트 */}
                {state === "neutral" &&
                  !d.isWeekend &&
                  WEEKDAY_VOTES[d.date] && (
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: WEEKDAY_VOTES[d.date] }).map(
                        (_, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full bg-stone-300"
                          />
                        ),
                      )}
                    </div>
                  )}
              </button>
            );
          })}
        </div>

        {mode === "unavailable" && (
          <p className="text-xs text-stone-400 text-center mb-4">
            선택한 날짜를 제외한 나머지 날짜는 모두 가능으로 처리돼요
          </p>
        )}

        {/* 주말 시간 선택 패널 */}
        {focusInfo && focusInfo.isWeekend && mode === "available" && (
          <div className="bg-white rounded-2xl border border-stone-900 p-4 mb-4 animate-in">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-stone-900">
                  3월 {focusDate}일 ({focusInfo.dayName}) 시간 선택
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  참여 가능한 시작 시간을 모두 선택하세요
                </p>
              </div>
              <button
                onClick={() => setFocusDate(null)}
                className="text-stone-400 hover:text-stone-700 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {WEEKEND_HOURS.map((hour) => {
                const mySelected = weekendHours[focusDate!]?.has(hour) ?? false;
                const othersCount = WEEKEND_HOUR_VOTES[focusDate!]?.[hour] ?? 0;
                return (
                  <button
                    key={hour}
                    onClick={() => toggleHour(focusDate!, hour)}
                    className={`py-2.5 rounded-xl text-xs font-medium transition-all ${
                      mySelected
                        ? "bg-stone-900 text-white"
                        : "bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200"
                    }`}
                  >
                    <div className="font-semibold">{hour}시</div>
                    {othersCount > 0 && (
                      <div
                        className={`text-[9px] mt-0.5 ${mySelected ? "text-stone-400" : "text-stone-400"}`}
                      >
                        {othersCount}명
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {weekendHours[focusDate!]?.size > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                <p className="text-xs text-stone-500">
                  {[...weekendHours[focusDate!]]
                    .sort((a, b) => a - b)
                    .map((h) => `${h}시`)
                    .join(" · ")}{" "}
                  선택됨
                </p>
                <button
                  onClick={() => setFocusDate(null)}
                  className="text-xs font-semibold text-stone-900 underline"
                >
                  확인
                </button>
              </div>
            )}
          </div>
        )}

        {/* 평일 클릭 시 안내 */}
        {focusDate && focusInfo && !focusInfo.isWeekend && (
          <div className="bg-stone-50 rounded-xl border border-stone-200 px-4 py-3 mb-4 flex items-center justify-between">
            <p className="text-xs text-stone-600">
              <span className="font-semibold">
                3월 {focusDate}일 ({focusInfo.dayName})
              </span>{" "}
              — 평일은 22:00 시작으로 고정
            </p>
            {WEEKDAY_VOTES[focusDate] && (
              <span className="text-xs text-stone-500">
                다른 멤버 {WEEKDAY_VOTES[focusDate]}명 가능
              </span>
            )}
          </div>
        )}

        {/* 저장 및 확인 영역 */}
        {canSave && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            {saved ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-stone-900 flex items-center justify-center text-white text-xs">
                    ✓
                  </span>
                  <p className="text-sm font-bold text-stone-900">
                    응답이 저장됐어요
                  </p>
                </div>
                <div className="space-y-1.5 mb-4">
                  {getSummaryLines().map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-stone-300 text-xs mt-0.5">·</span>
                      <p className="text-xs text-stone-600">{line}</p>
                    </div>
                  ))}
                </div>
                {mode === "unavailable" && (
                  <p className="text-xs text-stone-400 mb-3">
                    선택한 불가능 날짜를 제외하고 나머지는 모두 가능으로
                    처리됩니다.
                  </p>
                )}
                <button
                  onClick={() => setSaved(false)}
                  className="text-xs text-stone-400 underline"
                >
                  수정하기
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-stone-500 mb-2">
                  {mode === "available"
                    ? "가능한 날짜 요약"
                    : "불가능 기준 가능 날짜"}
                </p>
                <div className="space-y-1 mb-4">
                  {getSummaryLines().map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-stone-300 text-xs mt-0.5">·</span>
                      <p className="text-xs text-stone-600">{line}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSaved(true)}
                  className="w-full py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors"
                >
                  저장하기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Switcher current={3} total={5} />
    </div>
  );
}
