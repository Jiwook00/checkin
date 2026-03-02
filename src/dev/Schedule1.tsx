// DEV ONLY — Schedule Layout 1: Split (달력 + 날짜별 상세 패널)
//
// ✅ 확정된 레이아웃 (Issue #11 — 일정 조율 페이지)
// 이 파일을 기반으로 실제 /schedule 페이지를 구현할 예정.
//
// === 비즈니스 규칙 ===
// - 날짜 범위: 매달 1일~10일 고정
// - 평일 (월~금): 22:00 단일 시작 시간만 선택 가능
// - 주말 (토,일): 10시~22시 사이 1시간 단위로 시작 시간 복수 선택 가능
// - 모드 A "가능한 날": 선택한 날짜 = 참여 가능
// - 모드 B "불가능한 날": 선택한 날짜 = 참여 불가, 나머지 전부 가능으로 처리
//   (불가능 모드에서는 날짜 단위만 표시, 시간 단위 선택 없음)
//
// === 레이아웃 구조 ===
// 왼쪽: 3월 달력 전체 (1~10일만 인터랙티브, 11~31일은 greyed out)
// 오른쪽: 클릭한 날짜의 상세 패널 (평일/주말/모드에 따라 내용 분기)
//   + 하단에 선택 요약 + 저장 카드 (선택이 있을 때만 표시)
//
// === DB 스키마 (미구현, 다음 세션에서 작업 예정) ===
// - checkin_vote_polls: 회차별 일정 조율 세션
// - checkin_vote_options: 후보 날짜 (1~10일, 평일/주말 구분 포함)
// - checkin_vote_responses: 멤버별 응답 (날짜 + 선택 시간들)
//
// === 실제 구현 시 대체할 mock 데이터 ===
// WEEKDAY_VOTES, WEEKEND_HOUR_VOTES → DB에서 집계 쿼리로 대체
// DATES 배열 → 해당 월의 1~10일을 동적으로 생성
// TOTAL_MEMBERS → checkin_members 테이블에서 조회

import { useState } from "react";
import { Switcher } from "./shared";

// 총 멤버 수 (응답 현황 표시에 사용)
const TOTAL_MEMBERS = 6;

// 3월 1일~10일 고정 후보 날짜
// isWeekend: 토(토요일) · 일(일요일) → true, 나머지 평일 → false
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

// 2026년 3월은 일요일 시작 (3월 1일 = 일요일)
// 달력 전체를 보여주되, 1~10일만 클릭 가능
const CALENDAR_ROWS = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
  [29, 30, 31, null, null, null, null],
];
const WEEKDAYS_HEADER = ["일", "월", "화", "수", "목", "금", "토"];

// 주말 선택 가능 시간대: 10시~22시 (1시간 단위, 복수 선택)
const WEEKEND_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

// 다른 멤버 5명의 응답 집계 (mock 데이터 — 실제 구현 시 DB 집계로 대체)
// 평일: 날짜 → 22:00 가능으로 응답한 멤버 수
const WEEKDAY_VOTES: Record<number, number> = {
  2: 4,
  3: 5,
  4: 3,
  5: 4,
  6: 5,
  9: 5,
  10: 4,
};
// 주말: 날짜 → { 시간 → 해당 시간 선택한 멤버 수 }
const WEEKEND_HOUR_VOTES: Record<number, Record<number, number>> = {
  1: { 14: 3, 15: 2, 16: 4, 17: 3, 18: 3, 20: 2 },
  7: { 14: 3, 15: 4, 16: 5, 17: 3, 18: 4, 20: 2 },
  8: { 10: 2, 12: 3, 14: 4, 15: 3, 16: 3, 18: 2 },
};

// "가능한 날 선택" vs "불가능한 날 선택" 모드
type Mode = "available" | "unavailable";

export default function Schedule1() {
  const [mode, setMode] = useState<Mode>("available");

  // 선택된 날짜들 (available 모드: 가능한 날, unavailable 모드: 불가능한 날)
  const [selectedDates, setSelectedDates] = useState<Set<number>>(new Set());

  // 주말 시간 선택: { 날짜 → 선택된 시작 시간들 }
  // available 모드 전용 (unavailable 모드에서는 시간 선택 없음)
  const [weekendHours, setWeekendHours] = useState<Record<number, Set<number>>>(
    {},
  );

  // 오른쪽 패널에 표시할 날짜 (달력 클릭 시 업데이트, 초기값 2일)
  const [activeDate, setActiveDate] = useState<number | null>(2);

  // 저장 완료 상태 (저장 버튼 클릭 후 확인 화면으로 전환)
  const [saved, setSaved] = useState(false);

  const activeDateInfo = DATES.find((d) => d.date === activeDate);

  // 날짜 토글: 이미 선택된 날짜 클릭 → 해제 (주말 시간도 함께 초기화)
  const toggleDate = (date: number) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
        setWeekendHours((h) => {
          const n = { ...h };
          delete n[date];
          return n;
        });
      } else {
        next.add(date);
      }
      return next;
    });
    setActiveDate(date);
    setSaved(false);
  };

  // 주말 시간 토글: 해당 날짜의 시간 Set에 추가/제거
  const toggleHour = (date: number, hour: number) => {
    setWeekendHours((prev) => {
      const cur = prev[date] ? new Set(prev[date]) : new Set<number>();
      if (cur.has(hour)) cur.delete(hour);
      else cur.add(hour);
      return { ...prev, [date]: new Set(cur) };
    });
    setSaved(false);
  };

  // 저장 전 요약 텍스트 생성
  // - available 모드: 선택한 날짜 목록 (평일=22:00, 주말=선택된 시간들)
  // - unavailable 모드: 선택 안 한 날짜(= 가능한 날) 목록으로 변환해서 표시
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
      // 불가능 모드: selectedDates = 불가능한 날 → 가능한 날만 필터링해서 표시
      const unavailSet = selectedDates;
      const availDates = DATES.filter((d) => !unavailSet.has(d.date));
      return availDates.map((d) => {
        if (!d.isWeekend) return `${d.date}일 (${d.dayName}) 22:00`;
        return `${d.date}일 (${d.dayName}) 전체`; // 주말은 시간 미선택 = 전체 가능으로 처리
      });
    }
  };

  // 저장 버튼 활성화 조건
  // - available: 하나 이상 선택
  // - unavailable: 전체를 불가능으로 표시하는 건 막음 (하나 이상 가능일 있어야)
  const canSave =
    mode === "available"
      ? selectedDates.size > 0
      : selectedDates.size < DATES.length;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더: 세션명(3월 회고) + 응답 현황 */}
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              3월 회고
            </span>
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-3 py-1.5">
            5/6명 응답 완료
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* 모드 토글: 가능한 날 / 불가능한 날 선택 전환 */}
        {/* 전환 시 선택 상태 초기화 */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex bg-stone-100 rounded-full p-0.5 gap-0.5">
            <button
              onClick={() => {
                setMode("available");
                setSelectedDates(new Set());
                setWeekendHours({});
                setSaved(false);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === "available" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
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
          {/* 왼쪽: 3월 달력 */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-stone-800">
                2026년 3월
              </span>
              <span className="text-xs text-stone-400 bg-stone-50 rounded-full px-2 py-0.5">
                1일 ~ 10일
              </span>
            </div>

            {/* 요일 헤더: 일(빨강) ~ 토(파랑) */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS_HEADER.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-stone-400"}`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 그리드
                - 1~10일: 클릭 가능 (인터랙티브)
                - 11~31일: greyed out (비선택 가능, 범위 표시용)
                - 선택 상태: available=stone-900, unavailable=stone-200+취소선
                - activeDate: ring-2로 현재 포커스 표시 */}
            {CALENDAR_ROWS.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7">
                {row.map((day, di) => {
                  if (!day) return <div key={di} className="aspect-square" />;
                  const inRange = day <= 10;
                  const isMarked = selectedDates.has(day);
                  const isActive = activeDate === day;
                  const isSun = di === 0;
                  const isSat = di === 6;
                  const dateInfo = DATES.find((d) => d.date === day);
                  const isWeekend = dateInfo?.isWeekend ?? false;

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
                      onClick={() => toggleDate(day)}
                      className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg transition-all relative
                        ${isMarked ? markedStyle : isActive ? "ring-2 ring-stone-300 text-stone-800 font-semibold" : "hover:bg-stone-50 text-stone-700 font-medium"}
                        ${isWeekend && !isMarked && !isActive && isSun ? "text-red-500" : ""}
                        ${isWeekend && !isMarked && !isActive && isSat ? "text-blue-500" : ""}
                      `}
                    >
                      <span>{day}</span>
                      {isWeekend && (
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
            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <div
                  className={`w-3 h-3 rounded ${mode === "unavailable" ? "bg-stone-200" : "bg-stone-900"}`}
                />
                <span>{mode === "available" ? "가능" : "불가능"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <div className="w-3 h-3 rounded ring-2 ring-stone-300" />
                <span>선택 중</span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 선택 날짜 상세 패널 + 저장 카드 */}
          <div className="space-y-4">
            {activeDateInfo ? (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                {/* 날짜 헤더: 날짜명 + 평일/주말 구분 + 다른 멤버 응답 수 */}
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
                  {/* 평일만 다른 멤버 22:00 응답 수 표시 (주말은 시간별로 표시하므로 생략) */}
                  {!activeDateInfo.isWeekend && WEEKDAY_VOTES[activeDate!] && (
                    <div className="text-right">
                      <p className="text-xs text-stone-400 mb-1">
                        다른 멤버 응답
                      </p>
                      <p className="text-xl font-black text-stone-900">
                        {WEEKDAY_VOTES[activeDate!]}
                        <span className="text-sm font-normal text-stone-400">
                          /{TOTAL_MEMBERS - 1}명
                        </span>
                      </p>
                      <p className="text-xs text-stone-400">22:00 가능</p>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  {mode === "unavailable" ? (
                    /* 불가능 모드: 날짜 단위 토글만 (시간 선택 없음) */
                    <div>
                      <button
                        onClick={() => toggleDate(activeDateInfo.date)}
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
                    /* 가능 모드 + 주말: 시간 복수 선택
                       시간 버튼 클릭 시 해당 날짜가 아직 선택 안 됐으면 자동으로 선택 추가 */
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
                          // 다른 멤버 중 해당 시간 선택한 수 (버튼 아래 소자로 표시)
                          const othersCount =
                            WEEKEND_HOUR_VOTES[activeDateInfo.date]?.[hour] ??
                            0;
                          return (
                            <button
                              key={hour}
                              onClick={() => {
                                // 시간 선택하면 해당 날짜도 자동 선택 처리
                                if (!selectedDates.has(activeDateInfo.date)) {
                                  setSelectedDates(
                                    (p) => new Set([...p, activeDateInfo.date]),
                                  );
                                }
                                toggleHour(activeDateInfo.date, hour);
                                setSaved(false);
                              }}
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
                      <button
                        onClick={() => {
                          if (selectedDates.has(activeDateInfo.date)) {
                            toggleDate(activeDateInfo.date);
                          }
                        }}
                        className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600"
                      >
                        이 날짜 선택 해제
                      </button>
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
                        {WEEKDAY_VOTES[activeDateInfo.date] && (
                          <span className="text-xs text-stone-500">
                            다른 멤버 {WEEKDAY_VOTES[activeDateInfo.date]}명
                            가능
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleDate(activeDateInfo.date)}
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
              /* 날짜 미선택 상태 안내 */
              <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-8 text-center">
                <p className="text-sm text-stone-400">
                  달력에서 날짜를 선택하세요
                </p>
              </div>
            )}

            {/* 선택 요약 + 저장 카드 (하나 이상 선택 시 표시)
                저장 후: 확인 상태로 전환, "수정하기" 클릭 시 다시 편집 가능 */}
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
                      onClick={() => setSaved(false)}
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

      <Switcher current={1} total={5} />
    </div>
  );
}
