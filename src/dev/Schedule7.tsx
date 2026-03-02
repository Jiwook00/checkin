// DEV ONLY — 현황 표시 옵션 B: 상단 현황 배너 (progress bar + 유력 날짜 chips + 미응답 목록)
import { Switcher } from "./shared";

const YEAR = 2026;
const MONTH = 3;
const TOTAL_MEMBERS = 6;
const RESPONDED_COUNT = 4;

const WEEKDAY_VOTES: Record<number, number> = {
  2: 2,
  3: 3,
  4: 1,
  5: 3,
  6: 1,
  9: 2,
  10: 1,
};

const WEEKEND_HOUR_VOTES: Record<number, Record<number, number>> = {
  7: { 14: 2, 16: 1, 18: 2 },
};

const MY_SELECTED = new Set([3, 5, 7, 9]);

const PENDING_MEMBERS = ["홍길동", "이영희"];

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAYS_HEADER = ["일", "월", "화", "수", "목", "금", "토"];

function buildCalendarRows() {
  const firstDow = new Date(YEAR, MONTH - 1, 1).getDay();
  const daysInMonth = new Date(YEAR, MONTH, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function getDow(date: number) {
  return new Date(YEAR, MONTH - 1, date).getDay();
}

function isWeekendDate(date: number) {
  const dow = getDow(date);
  return dow === 0 || dow === 6;
}

const dates = Array.from({ length: 10 }, (_, i) => {
  const d = i + 1;
  const dow = getDow(d);
  return {
    date: d,
    dayName: DAY_NAMES[dow],
    isWeekend: dow === 0 || dow === 6,
  };
});

// 유력 날짜 계산 (평일 기준 상위 3개)
const sortedDates = Object.entries(WEEKDAY_VOTES)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 3)
  .map(([d, count]) => ({
    date: Number(d),
    dayName: dates.find((x) => x.date === Number(d))?.dayName ?? "",
    count,
  }));

const maxVoteCount = Math.max(...Object.values(WEEKDAY_VOTES));
const responseRate = Math.round((RESPONDED_COUNT / TOTAL_MEMBERS) * 100);

export default function Schedule7() {
  const calendarRows = buildCalendarRows();
  const activeDateInfo = dates.find((d) => d.date === 3)!;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              3월에 하는 2월 회고
            </span>
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-3 py-1.5">
            {RESPONDED_COUNT}/{TOTAL_MEMBERS}명 응답 완료
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* 모드 토글 (정적) */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex bg-stone-100 rounded-full p-0.5 gap-0.5">
            <button className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-stone-900 shadow-sm">
              가능한 날 선택
            </button>
            <button className="px-4 py-1.5 rounded-full text-xs font-semibold text-stone-500">
              불가능한 날 선택
            </button>
          </div>
          <span className="text-xs text-stone-400">
            참여 가능한 날짜와 시간을 선택하세요
          </span>
        </div>

        {/* ★ 핵심 추가: 현황 요약 배너 */}
        <div className="mb-6 bg-white rounded-2xl border border-stone-200 p-4">
          <div className="flex items-stretch gap-5">
            {/* 응답 진행률 */}
            <div className="flex-shrink-0 min-w-[100px]">
              <p className="text-[11px] font-semibold text-stone-400 mb-2">
                응답 현황
              </p>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base font-black text-stone-900">
                  {RESPONDED_COUNT}
                </span>
                <span className="text-xs text-stone-400">
                  / {TOTAL_MEMBERS}명
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-stone-800 rounded-full transition-all"
                  style={{ width: `${responseRate}%` }}
                />
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                {responseRate}% 완료
              </p>
            </div>

            <div className="w-px bg-stone-100 self-stretch" />

            {/* 유력 날짜 */}
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-stone-400 mb-2">
                유력 날짜
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {sortedDates.map((d, i) => (
                  <span
                    key={d.date}
                    className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 font-semibold ${
                      d.count === maxVoteCount
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {d.count === maxVoteCount && i === 0 && (
                      <span className="text-[10px]">★</span>
                    )}
                    {d.date}일({d.dayName})
                    <span
                      className={`${d.count === maxVoteCount ? "text-emerald-500" : "text-stone-400"}`}
                    >
                      {d.count}명
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="w-px bg-stone-100 self-stretch" />

            {/* 미응답 멤버 */}
            <div className="flex-shrink-0">
              <p className="text-[11px] font-semibold text-stone-400 mb-2">
                미응답
              </p>
              <div className="flex flex-col gap-1.5">
                {PENDING_MEMBERS.map((name) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-bold text-stone-500 flex-shrink-0">
                      {name[0]}
                    </div>
                    <span className="text-xs text-stone-500">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 메인 2열 그리드 */}
        <div className="grid grid-cols-[1fr_1.15fr] gap-6 items-start">
          {/* 왼쪽: 달력 (기존과 동일) */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-stone-800">
                2026년 3월
              </span>
              <span className="text-xs text-stone-400 bg-stone-50 rounded-full px-2 py-0.5">
                1일 ~ 10일
              </span>
            </div>

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

            {calendarRows.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7">
                {row.map((day, di) => {
                  if (!day) return <div key={di} className="aspect-square" />;
                  const inRange = day <= 10;
                  const isSun = di === 0;
                  const isSat = di === 6;
                  const weekend = isWeekendDate(day);
                  const isMySelected = MY_SELECTED.has(day);

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
                      className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg
                        ${
                          isMySelected
                            ? "bg-stone-900 text-white"
                            : weekend && isSun
                              ? "text-red-500 hover:bg-stone-50"
                              : weekend && isSat
                                ? "text-blue-500 hover:bg-stone-50"
                                : "hover:bg-stone-50 text-stone-700 font-medium"
                        }
                      `}
                    >
                      <span>{day}</span>
                      {weekend && (
                        <span
                          className={`text-[9px] leading-none ${isMySelected ? "opacity-60" : "opacity-40"}`}
                        >
                          주말
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <div className="w-3 h-3 rounded bg-stone-900" />
                <span>가능</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <div className="w-3 h-3 rounded ring-2 ring-stone-300" />
                <span>선택 중</span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 날짜 상세 패널 */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">선택한 날짜</p>
                  <p className="text-lg font-black text-stone-900">
                    3월 {activeDateInfo.date}일 ({activeDateInfo.dayName})
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">평일</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-stone-400 mb-1">다른 멤버 응답</p>
                  <p className="text-xl font-black text-stone-900">
                    3
                    <span className="text-sm font-normal text-stone-400">
                      /{TOTAL_MEMBERS - 1}명
                    </span>
                  </p>
                  <p className="text-xs text-stone-400">22:00 가능</p>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      22:00 시작
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      평일은 밤 10시 시작으로 고정
                    </p>
                  </div>
                  <span className="text-xs text-stone-500">
                    다른 멤버 3명 가능
                  </span>
                </div>
                <button className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-stone-900 bg-stone-900 text-white">
                  ✓ 22:00 가능
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <p className="text-xs font-semibold text-stone-500 mb-3">
                내 가능 일정 요약
              </p>
              <div className="text-center py-2">
                <p className="text-sm font-bold text-stone-900 mb-1">
                  ✓ 저장됐어요
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-stone-500">3일 (화) 22:00</p>
                  <p className="text-xs text-stone-500">5일 (목) 22:00</p>
                  <p className="text-xs text-stone-500">
                    7일 (토) — 14시 · 16시
                  </p>
                  <p className="text-xs text-stone-500">9일 (월) 22:00</p>
                </div>
                <button className="mt-3 text-xs text-stone-400 underline">
                  수정하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Switcher current={7} total={8} />
    </div>
  );
}
