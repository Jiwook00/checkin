// DEV ONLY — Preview 4: 마감 → 확정 모달 플로우
import { useState } from "react";
import { Switcher } from "./shared";

type Phase = "voting" | "close-dialog" | "date-modal" | "confirmed";

// Mock vote tally — 날짜별 응답 수 (5명 기준)
const VOTE_TALLY = [
  { date: 3, dayName: "화", isWeekend: false, count: 4, time: "22:00" },
  { date: 9, dayName: "월", isWeekend: false, count: 4, time: "22:00" },
  { date: 4, dayName: "수", isWeekend: false, count: 3, time: "22:00" },
  { date: 2, dayName: "월", isWeekend: false, count: 3, time: "22:00" },
  { date: 8, dayName: "일", isWeekend: true, count: 3, time: "14:00" },
  { date: 6, dayName: "금", isWeekend: false, count: 2, time: "22:00" },
  { date: 10, dayName: "화", isWeekend: false, count: 2, time: "22:00" },
];

const MAX_COUNT = 4;

export default function VoteV2Close() {
  const [phase, setPhase] = useState<Phase>("voting");
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

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
              5/5명 응답 완료
            </span>
            {phase === "voting" && (
              <button
                onClick={() => setPhase("close-dialog")}
                className="text-xs text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 hover:border-stone-400 hover:text-stone-700 transition-all"
              >
                일정 마감
              </button>
            )}
            {phase === "confirmed" && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-3 py-1.5">
                확정됨
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {phase === "confirmed" ? (
          <ConfirmedView
            date={selectedDate}
            onReset={() => {
              setPhase("voting");
              setSelectedDate(null);
            }}
          />
        ) : (
          <VotingView onClose={() => setPhase("close-dialog")} />
        )}
      </div>

      {/* 마감 확인 다이얼로그 */}
      {phase === "close-dialog" && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-base font-black text-stone-900 mb-1">
              일정을 마감할까요?
            </p>
            <p className="text-sm text-stone-400 mb-5 leading-relaxed">
              마감 후에는 투표 변경이 불가해요.
              <br />
              가장 많이 선택된 날짜로 확정 날짜를 고를 수 있어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPhase("voting")}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => setPhase("date-modal")}
                className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors"
              >
                마감하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 날짜 확정 모달 */}
      {phase === "date-modal" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
                마감 완료
              </p>
              <h2 className="text-lg font-black text-stone-900">
                확정 날짜를 선택하세요
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                득표 수를 참고해 최종 날짜를 골라주세요
              </p>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
              <div className="space-y-2">
                {VOTE_TALLY.map((item) => {
                  const isTop = item.count === MAX_COUNT;
                  const isSelected = selectedDate === item.date;
                  return (
                    <button
                      key={item.date}
                      onClick={() => setSelectedDate(item.date)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-stone-900 bg-stone-900 text-white"
                          : isTop
                            ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400"
                            : "border-stone-100 bg-white hover:border-stone-200"
                      }`}
                    >
                      {/* 날짜 */}
                      <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 bg-white/20">
                        <span
                          className={`text-sm font-black ${isSelected ? "text-white" : "text-stone-900"}`}
                        >
                          {item.date}
                        </span>
                        <span
                          className={`text-[10px] ${isSelected ? "text-stone-300" : "text-stone-400"}`}
                        >
                          {item.dayName}
                        </span>
                      </div>

                      {/* 시간 */}
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${isSelected ? "text-white" : "text-stone-800"}`}
                        >
                          3월 {item.date}일 ({item.dayName}) {item.time}
                        </p>
                        {isTop && !isSelected && (
                          <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                            최다 득표
                          </p>
                        )}
                      </div>

                      {/* 득표 바 */}
                      <div className="flex-shrink-0 text-right">
                        <p
                          className={`text-sm font-black ${isSelected ? "text-white" : "text-stone-900"}`}
                        >
                          {item.count}
                          <span
                            className={`text-xs font-normal ${isSelected ? "text-stone-400" : "text-stone-400"}`}
                          >
                            /5명
                          </span>
                        </p>
                        <div className="flex gap-0.5 justify-end mt-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-sm ${i < item.count ? (isSelected ? "bg-white" : isTop ? "bg-emerald-500" : "bg-stone-500") : isSelected ? "bg-white/20" : "bg-stone-200"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-stone-100 flex gap-2">
              <button
                onClick={() => setPhase("voting")}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
              >
                취소
              </button>
              <button
                disabled={!selectedDate}
                onClick={() => {
                  if (selectedDate) setPhase("confirmed");
                }}
                className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {selectedDate ? "이 날짜로 확정" : "날짜를 선택하세요"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Switcher current={4} total={4} />
    </div>
  );
}

function VotingView({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <p className="text-sm text-stone-500 mb-5">
        모든 멤버가 응답을 완료했어요. 일정을 마감하고 확정 날짜를 선택할 수
        있어요.
      </p>
      {/* 간단한 투표 현황 요약 */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="text-xs font-semibold text-stone-500 mb-4">
          현재 투표 현황
        </p>
        <div className="space-y-2.5">
          {VOTE_TALLY.map((item) => {
            const isTop = item.count === MAX_COUNT;
            return (
              <div key={item.date} className="flex items-center gap-3">
                <div
                  className={`w-16 text-xs font-semibold flex-shrink-0 ${isTop ? "text-emerald-600" : "text-stone-500"}`}
                >
                  {item.date}일({item.dayName})
                </div>
                <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isTop ? "bg-emerald-500" : "bg-stone-400"}`}
                    style={{ width: `${(item.count / 5) * 100}%` }}
                  />
                </div>
                <div className="w-8 text-xs text-right text-stone-500 flex-shrink-0">
                  {item.count}명
                </div>
                {isTop && (
                  <span className="text-xs font-bold text-emerald-600 flex-shrink-0">
                    ★
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-5 text-center">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-700 border border-stone-300 rounded-xl px-5 py-2.5 hover:border-stone-500 hover:bg-stone-50 transition-all"
          >
            일정 마감하기 →
          </button>
          <p className="text-xs text-stone-400 mt-2">
            마감 후 확정 날짜를 선택할 수 있어요
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfirmedView({
  date,
  onReset,
}: {
  date: number | null;
  onReset: () => void;
}) {
  const item = VOTE_TALLY.find((t) => t.date === date);
  if (!item) return null;

  return (
    <div className="text-center">
      <div className="bg-white rounded-2xl border border-emerald-200 p-8 max-w-sm mx-auto">
        <div className="text-4xl mb-4">🎉</div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">
          일정 확정
        </p>
        <p className="text-2xl font-black text-stone-900 mb-1">
          3월 {item.date}일 ({item.dayName})
        </p>
        <p className="text-lg font-bold text-stone-600 mb-4">
          {item.time} 시작
        </p>
        <p className="text-sm text-stone-400 mb-2">
          {item.count}명이 참여 가능한 날짜예요
        </p>
        <div className="flex justify-center gap-1 mb-6">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-sm ${i < item.count ? "bg-emerald-500" : "bg-stone-200"}`}
            />
          ))}
        </div>
        <p className="text-xs text-stone-400">
          메인 화면에서 확정된 날짜를 확인할 수 있어요
        </p>
      </div>
      {/* 프리뷰용 리셋 버튼 */}
      <button
        onClick={onReset}
        className="mt-4 text-xs text-stone-400 underline hover:text-stone-600"
      >
        (프리뷰) 처음으로 돌아가기
      </button>
    </div>
  );
}
