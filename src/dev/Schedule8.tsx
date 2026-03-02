// DEV ONLY — 현황 표시 옵션 C: 하단 멤버 응답 그리드 (누가 어느 날 가능한지 한눈에)
import { Switcher } from "./shared";

const YEAR = 2026;
const MONTH = 3;
const TOTAL_MEMBERS = 6;

const MY_SELECTED = new Set([3, 5, 7, 9]);

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAYS_HEADER = ["일", "월", "화", "수", "목", "금", "토"];

function getDow(date: number) {
  return new Date(YEAR, MONTH - 1, date).getDay();
}

function isWeekendDate(date: number) {
  const dow = getDow(date);
  return dow === 0 || dow === 6;
}

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

const dates = Array.from({ length: 10 }, (_, i) => {
  const d = i + 1;
  const dow = getDow(d);
  return {
    date: d,
    dayName: DAY_NAMES[dow],
    isWeekend: dow === 0 || dow === 6,
  };
});

// 멤버별 응답 데이터
// mode: "available" → available_dates에 있는 날이 가능
// mode: null → 미응답
const MEMBERS: {
  id: string;
  name: string;
  responded: boolean;
  availableDates: number[]; // 가능한 날 (주말은 별도 표기)
  weekendAvail: Record<number, number[]>; // 날짜 → 시작 가능 시간
}[] = [
  {
    id: "me",
    name: "나 (김민준)",
    responded: true,
    availableDates: [3, 5, 9],
    weekendAvail: { 7: [14, 16] },
  },
  {
    id: "2",
    name: "이서연",
    responded: true,
    availableDates: [2, 3, 6, 10],
    weekendAvail: { 7: [14, 18] },
  },
  {
    id: "3",
    name: "박지호",
    responded: true,
    availableDates: [3, 4, 5],
    weekendAvail: {},
  },
  {
    id: "4",
    name: "최유나",
    responded: true,
    availableDates: [2, 5, 9],
    weekendAvail: {},
  },
  {
    id: "5",
    name: "홍길동",
    responded: false,
    availableDates: [],
    weekendAvail: {},
  },
  {
    id: "6",
    name: "이영희",
    responded: false,
    availableDates: [],
    weekendAvail: {},
  },
];

// 날짜별 가능 인원 합계
const dateTotals: Record<number, number> = {};
for (let d = 1; d <= 10; d++) {
  if (!isWeekendDate(d)) {
    dateTotals[d] = MEMBERS.filter(
      (m) => m.responded && m.availableDates.includes(d),
    ).length;
  } else {
    // 주말: 1명 이상 응답한 경우
    dateTotals[d] = MEMBERS.filter(
      (m) =>
        m.responded &&
        (m.availableDates.includes(d) || m.weekendAvail[d]?.length > 0),
    ).length;
  }
}

const maxTotal = Math.max(...Object.values(dateTotals));
const respondedCount = MEMBERS.filter((m) => m.responded).length;

export default function Schedule8() {
  const calendarRows = buildCalendarRows();
  const activeDateInfo = dates.find((d) => d.date === 3)!;

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
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
            {respondedCount}/{TOTAL_MEMBERS}명 응답 완료
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* 모드 토글 (정적) */}
        <div className="flex items-center gap-2 mb-6">
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

        {/* 메인 2열 그리드 */}
        <div className="grid grid-cols-[1fr_1.15fr] gap-6 items-start mb-6">
          {/* 왼쪽: 달력 */}
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

          {/* 오른쪽: 날짜 상세 */}
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

        {/* ★ 핵심 추가: 멤버 응답 현황 그리드 */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-stone-800">멤버 응답 현황</h3>
            <span className="text-xs text-stone-400">
              {respondedCount}/{TOTAL_MEMBERS}명 응답
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left pb-3 pr-4 min-w-[72px]">
                    <span className="text-xs font-medium text-stone-400">
                      멤버
                    </span>
                  </th>
                  {dates.map((d) => (
                    <th
                      key={d.date}
                      className={`text-center pb-3 px-1 min-w-[28px] ${d.isWeekend ? "text-blue-400" : "text-stone-400"}`}
                    >
                      <div className="text-[10px] font-medium leading-none">
                        {d.date}
                      </div>
                      <div className="text-[9px] text-stone-300 leading-none mt-0.5">
                        {d.dayName}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEMBERS.map((member, mi) => (
                  <tr
                    key={member.id}
                    className={
                      mi < MEMBERS.length - 1 ? "border-b border-stone-50" : ""
                    }
                  >
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            member.id === "me"
                              ? "bg-stone-900 text-white"
                              : member.responded
                                ? "bg-stone-200 text-stone-600"
                                : "bg-stone-100 text-stone-300"
                          }`}
                        >
                          {member.name[0]}
                        </div>
                        <span
                          className={`text-xs font-medium whitespace-nowrap ${
                            member.id === "me"
                              ? "text-stone-900"
                              : member.responded
                                ? "text-stone-700"
                                : "text-stone-300"
                          }`}
                        >
                          {member.id === "me" ? "나" : member.name}
                        </span>
                      </div>
                    </td>
                    {dates.map((d) => {
                      const isWeekend = d.isWeekend;
                      const isAvail = !isWeekend
                        ? member.availableDates.includes(d.date)
                        : member.weekendAvail[d.date]?.length > 0 ||
                          member.availableDates.includes(d.date);

                      return (
                        <td key={d.date} className="text-center py-2 px-1">
                          {!member.responded ? (
                            <span className="text-stone-200 text-xs">—</span>
                          ) : isAvail ? (
                            <span
                              className={`text-xs font-bold ${member.id === "me" ? "text-stone-900" : "text-emerald-500"}`}
                            >
                              ✓
                            </span>
                          ) : (
                            <span className="text-stone-200 text-xs">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* 합계 행 */}
                <tr className="border-t-2 border-stone-100">
                  <td className="pt-3 pr-4">
                    <span className="text-xs font-bold text-stone-500">
                      합계
                    </span>
                  </td>
                  {dates.map((d) => {
                    const count = dateTotals[d.date] ?? 0;
                    const isMax = count === maxTotal && count > 0;
                    return (
                      <td key={d.date} className="text-center pt-3 px-1">
                        {count > 0 ? (
                          <span
                            className={`text-xs font-black ${isMax ? "text-emerald-600" : "text-stone-400"}`}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-200">0</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 범례 */}
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <span className="text-emerald-500 font-bold text-sm">✓</span>
              <span>가능</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <span className="text-stone-200 text-sm">·</span>
              <span>불가능 / 미선택</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <span className="text-stone-200 font-bold">—</span>
              <span>아직 미응답</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <span className="text-emerald-600 font-black text-xs">N</span>
              <span>= 최다 득표 날짜</span>
            </div>
          </div>
        </div>
      </div>

      <Switcher current={8} total={8} />
    </div>
  );
}
