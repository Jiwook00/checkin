// DEV ONLY — Schedule Layout 5: 세로 선택 플로우 (모바일 퍼스트, 단계별 UX)
import { useState } from "react";
import { Switcher } from "./shared";

const TOTAL = 6;
const RESPONDED = 5;

const CANDIDATES = [
  {
    id: 1,
    label: "3월 14일",
    day: "토",
    fullDay: "토요일",
    votes: 4,
    voters: ["김민준", "이서연", "박지호", "최유나"],
  },
  {
    id: 2,
    label: "3월 21일",
    day: "토",
    fullDay: "토요일",
    votes: 5,
    voters: ["김민준", "이서연", "박지호", "최유나", "정현우"],
  },
  {
    id: 3,
    label: "3월 28일",
    day: "토",
    fullDay: "토요일",
    votes: 2,
    voters: ["정현우", "한지원"],
  },
];

// March 2026 calendar
const CALENDAR_ROWS = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
  [29, 30, 31, null, null, null, null],
];
const CANDIDATE_DATES = new Set([14, 21, 28]);
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function Schedule5() {
  const [myVotes, setMyVotes] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"select" | "confirm" | "done">("select");

  const toggleVote = (id: number) => {
    if (step !== "select") return;
    setMyVotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* 상단 프로그레스 바 */}
      <div className="h-1 bg-stone-100">
        <div
          className="h-full bg-stone-900 transition-all duration-500"
          style={{
            width:
              step === "select" ? "33%" : step === "confirm" ? "66%" : "100%",
          }}
        />
      </div>

      {/* 헤더 */}
      <div className="bg-white border-b border-stone-100 px-5 py-4">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          {step !== "select" && (
            <button
              onClick={() => setStep(step === "confirm" ? "select" : "confirm")}
              className="text-sm text-stone-500 hover:text-stone-800"
            >
              ← 뒤로
            </button>
          )}
          <div className={step === "select" ? "w-full" : ""}>
            <p className="text-xs text-stone-400 font-medium">
              3월 회고 · 일정 조율
            </p>
          </div>
          <div className="text-xs text-stone-400 whitespace-nowrap">
            {RESPONDED}/{TOTAL}명 응답
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-sm mx-auto w-full px-5 py-8">
        {step === "select" && (
          <>
            {/* 달력 */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-stone-800">
                  2026년 3월
                </span>
                <div className="flex gap-1">
                  <button className="p-1 text-stone-300 text-lg">‹</button>
                  <button className="p-1 text-stone-300 text-lg">›</button>
                </div>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center text-xs font-medium py-1 ${
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

              {CALENDAR_ROWS.map((row, ri) => (
                <div key={ri} className="grid grid-cols-7">
                  {row.map((day, di) => {
                    if (!day) return <div key={di} className="aspect-square" />;
                    const isCandidate = CANDIDATE_DATES.has(day);
                    const realCandidate = CANDIDATES.find((c) =>
                      c.label.includes(`${day}일`),
                    );
                    const isMine = realCandidate
                      ? myVotes.has(realCandidate.id)
                      : false;
                    const isSun = di === 0;
                    const isSat = di === 6;

                    return (
                      <button
                        key={di}
                        onClick={() =>
                          isCandidate &&
                          realCandidate &&
                          toggleVote(realCandidate.id)
                        }
                        className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-all relative
                          ${isCandidate && isMine ? "bg-stone-900 text-white font-bold" : ""}
                          ${isCandidate && !isMine ? "bg-teal-50 text-teal-600 font-semibold ring-1 ring-teal-200 hover:bg-teal-100" : ""}
                          ${!isCandidate && isSun ? "text-red-300" : ""}
                          ${!isCandidate && isSat ? "text-blue-300" : ""}
                          ${!isCandidate && !isSun && !isSat ? "text-stone-300" : ""}
                          ${isCandidate ? "cursor-pointer" : "cursor-default"}
                        `}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 날짜 선택 버튼 리스트 */}
            <h2 className="text-sm font-bold text-stone-700 mb-3">후보 날짜</h2>
            <div className="space-y-2 mb-8">
              {CANDIDATES.map((c) => {
                const isMine = myVotes.has(c.id);
                const pct = Math.round((c.votes / TOTAL) * 100);

                return (
                  <button
                    key={c.id}
                    onClick={() => toggleVote(c.id)}
                    className={`w-full text-left rounded-xl border-2 px-4 py-3 flex items-center gap-4 transition-all ${
                      isMine
                        ? "border-stone-900 bg-white"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    {/* 날짜 뱃지 */}
                    <div
                      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 transition-colors ${
                        isMine
                          ? "bg-stone-900 text-white"
                          : "bg-stone-50 text-stone-600"
                      }`}
                    >
                      <span className="text-xs font-medium opacity-70">
                        {c.day}
                      </span>
                      <span className="text-lg font-black leading-none">
                        {c.label.replace("3월 ", "").replace("일", "")}
                      </span>
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-stone-800">
                          {c.label} ({c.fullDay})
                        </span>
                        <span className="text-xs text-stone-500">
                          {c.votes}/{TOTAL}명
                        </span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isMine ? "bg-stone-800" : "bg-teal-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* 체크 */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isMine
                          ? "border-stone-900 bg-stone-900"
                          : "border-stone-300"
                      }`}
                    >
                      {isMine && (
                        <span className="text-white text-xs font-bold">✓</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => myVotes.size > 0 && setStep("confirm")}
              className={`w-full py-4 rounded-2xl text-sm font-bold transition-all ${
                myVotes.size > 0
                  ? "bg-stone-900 text-white hover:bg-stone-700"
                  : "bg-stone-100 text-stone-300 cursor-not-allowed"
              }`}
            >
              {myVotes.size > 0
                ? `다음 (${myVotes.size}개 선택됨)`
                : "날짜를 선택해주세요"}
            </button>
          </>
        )}

        {step === "confirm" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-stone-900 mb-1">
                선택을 확인해주세요
              </h2>
              <p className="text-sm text-stone-400">
                아래 날짜에 참여 가능하다고 응답할게요.
              </p>
            </div>

            <div className="space-y-2">
              {CANDIDATES.filter((c) => myVotes.has(c.id)).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-3"
                >
                  <span className="text-teal-500 font-bold text-lg">✓</span>
                  <div>
                    <div className="font-semibold text-stone-900">
                      {c.label} ({c.fullDay})
                    </div>
                    <div className="text-xs text-stone-400">
                      현재 {c.votes}명 참여 예정
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep("done")}
              className="w-full py-4 rounded-2xl bg-stone-900 text-white text-sm font-bold hover:bg-stone-700 transition-colors"
            >
              응답 제출하기
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-3xl mb-5">
              ✓
            </div>
            <h2 className="text-xl font-black text-stone-900 mb-2">
              응답 완료!
            </h2>
            <p className="text-sm text-stone-500 mb-8">
              {myVotes.size}개 날짜에 참여 가능으로 응답했어요.
              <br />
              일정이 확정되면 알려드릴게요.
            </p>
            <button
              onClick={() => setStep("select")}
              className="text-sm font-semibold text-stone-500 underline underline-offset-2 hover:text-stone-800"
            >
              응답 수정하기
            </button>
          </div>
        )}
      </div>

      <Switcher current={5} total={5} />
    </div>
  );
}
