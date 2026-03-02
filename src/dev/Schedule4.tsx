// DEV ONLY — Schedule Layout 4: 달력 중심 (큰 달력 + 오른쪽 현황 패널)
import { useState } from "react";
import { Switcher } from "./shared";

const CANDIDATES = [
  {
    date: 14,
    label: "3월 14일 (토)",
    votes: 4,
    voters: ["김민준", "이서연", "박지호", "최유나"],
  },
  {
    date: 21,
    label: "3월 21일 (토)",
    votes: 5,
    voters: ["김민준", "이서연", "박지호", "최유나", "정현우"],
  },
  {
    date: 28,
    label: "3월 28일 (토)",
    votes: 2,
    voters: ["정현우", "한지원"],
  },
];

const TOTAL = 6;
const CANDIDATE_DATES = new Set([14, 21, 28]);

const CALENDAR_ROWS = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
  [29, 30, 31, null, null, null, null],
];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const voteColor = (votes: number) => {
  if (votes >= 5)
    return { bg: "bg-teal-500", text: "text-white", ring: "ring-teal-400" };
  if (votes >= 3)
    return { bg: "bg-amber-400", text: "text-white", ring: "ring-amber-300" };
  return { bg: "bg-stone-300", text: "text-white", ring: "ring-stone-200" };
};

export default function Schedule4() {
  const [myVotes, setMyVotes] = useState<Set<number>>(new Set([14, 21]));
  const [hovered, setHovered] = useState<number | null>(null);

  const toggleVote = (date: number) => {
    setMyVotes((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <div className="border-b border-stone-100 px-8 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="flex-1">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
              2026년 3월 회고
            </span>
            <h1 className="text-2xl font-black text-stone-900 mt-1">
              일정 조율
            </h1>
          </div>
          <div className="text-xs text-stone-400">
            후보 날짜에 클릭해서 참여 여부를 표시하세요
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="grid grid-cols-[1.6fr_1fr] gap-10 items-start">
          {/* 왼쪽: 큰 달력 */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-stone-800">2026년 3월</h2>
              <div className="flex gap-1">
                <button className="px-2 py-1 text-stone-400 hover:text-stone-600 text-lg">
                  ‹
                </button>
                <button className="px-2 py-1 text-stone-400 hover:text-stone-600 text-lg">
                  ›
                </button>
              </div>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-xs font-semibold py-2 ${
                    i === 0
                      ? "text-red-400"
                      : i === 6
                        ? "text-blue-400"
                        : "text-stone-400"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            {CALENDAR_ROWS.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 gap-1 mb-1">
                {row.map((day, di) => {
                  if (!day) return <div key={di} className="aspect-square" />;
                  const isCandidate = CANDIDATE_DATES.has(day);
                  const candidate = CANDIDATES.find((c) => c.date === day);
                  const isMine = myVotes.has(day);
                  const isHighlighted = hovered === day;
                  const colors = candidate ? voteColor(candidate.votes) : null;
                  const isSun = di === 0;
                  const isSat = di === 6;

                  return (
                    <button
                      key={di}
                      onClick={() => isCandidate && toggleVote(day)}
                      onMouseEnter={() => isCandidate && setHovered(day)}
                      onMouseLeave={() => setHovered(null)}
                      className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all relative
                        ${isCandidate ? `cursor-pointer ${colors?.bg} ${colors?.text} ${isHighlighted ? `ring-2 ${colors?.ring} ring-offset-1 scale-110` : ""}` : "cursor-default"}
                        ${!isCandidate && isSun ? "text-red-300" : ""}
                        ${!isCandidate && isSat ? "text-blue-300" : ""}
                        ${!isCandidate && !isSun && !isSat ? "text-stone-300" : ""}
                      `}
                    >
                      <span>{day}</span>
                      {isCandidate && candidate && (
                        <span className="text-xs opacity-80 mt-0.5">
                          {candidate.votes}명
                        </span>
                      )}
                      {isMine && isCandidate && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white opacity-80" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* 범례 */}
            <div className="mt-5 flex items-center gap-4 text-xs text-stone-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-teal-500" />
                <span>5명+ 참여 가능</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-400" />
                <span>3~4명</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-stone-300" />
                <span>~2명</span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 현황 패널 */}
          <div className="sticky top-8 space-y-4">
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">
              일정 현황
            </h3>

            {CANDIDATES.sort((a, b) => b.votes - a.votes).map((c) => {
              const isMine = myVotes.has(c.date);
              const colors = voteColor(c.votes);
              const pct = Math.round((c.votes / TOTAL) * 100);

              return (
                <button
                  key={c.date}
                  onClick={() => toggleVote(c.date)}
                  onMouseEnter={() => setHovered(c.date)}
                  onMouseLeave={() => setHovered(null)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    hovered === c.date
                      ? "border-stone-300 shadow-sm"
                      : isMine
                        ? "border-stone-900"
                        : "border-stone-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-stone-800">
                      {c.label}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                    >
                      {c.votes}명
                    </span>
                  </div>

                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full ${colors.bg}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-1">
                      {c.voters.slice(0, 4).map((name) => (
                        <div
                          key={name}
                          className="w-5 h-5 rounded-full bg-stone-200 border border-white flex items-center justify-center text-xs font-bold text-stone-600"
                          title={name}
                        >
                          {name[0]}
                        </div>
                      ))}
                      {c.voters.length > 4 && (
                        <div className="w-5 h-5 rounded-full bg-stone-100 border border-white flex items-center justify-center text-xs text-stone-400">
                          +{c.voters.length - 4}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold ${isMine ? "text-stone-900" : "text-stone-300"}`}
                    >
                      {isMine ? "✓ 선택됨" : "선택 안 함"}
                    </span>
                  </div>
                </button>
              );
            })}

            <button className="w-full py-3 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-700 transition-colors mt-2">
              선택 저장 ({myVotes.size}개)
            </button>
          </div>
        </div>
      </div>

      <Switcher current={4} total={5} />
    </div>
  );
}
