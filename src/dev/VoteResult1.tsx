/**
 * 투표 확정 결과 화면 — Option 7: 아바타 그리드 (기본)
 * - 현재 dot 줄 → 원형 아바타 그리드로 교체
 * - 참여 가능: 컬러 원 + 이니셜 / 미참여: 회색 반투명
 * - 카드 레이아웃 최소 변경
 */

import { PhoneFrame } from "./shared";

const AVATAR_COLORS = [
  "bg-sky-400",
  "bg-violet-400",
  "bg-rose-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-pink-400",
  "bg-indigo-400",
  "bg-teal-400",
];

const MOCK_ALL_MEMBERS = [
  { name: "danny", idx: 0 },
  { name: "지욱", idx: 1 },
  { name: "alice", idx: 2 },
  { name: "minjae", idx: 3 },
  { name: "수호", idx: 4 },
  { name: "유나", idx: 5 },
  { name: "준호", idx: 6 },
  { name: "소라", idx: 7 },
];

// 이 날짜에 참여 가능한 멤버 인덱스
const ATTENDING_INDICES = [0, 1, 2, 3, 4];

function ResultSwitcher({ current }: { current: number }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1 bg-stone-900/90 backdrop-blur text-white rounded-full px-3 py-2 shadow-xl">
      <span className="text-xs text-stone-400 mr-2">확정 화면</span>
      {[
        { n: 7, label: "아바타 그리드" },
        { n: 8, label: "이름 포함" },
      ].map((o) => (
        <a
          key={o.n}
          href={`/dev/${o.n}`}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            current === o.n
              ? "bg-white text-stone-900"
              : "text-stone-300 hover:text-white"
          }`}
        >
          {o.label}
        </a>
      ))}
      <span className="mx-2 text-stone-600">|</span>
      <a href="/dev" className="text-xs text-stone-400 hover:text-white">
        목록
      </a>
    </div>
  );
}

export default function VoteResult1() {
  return (
    <>
      <PhoneFrame>
        <div className="flex-1 overflow-y-auto bg-stone-50 px-4 py-6">
          {/* 헤더 바 (배경 컨텍스트용) */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-24 h-5 bg-stone-200 rounded-md" />
            <div className="w-16 h-6 bg-emerald-100 rounded-full" />
          </div>

          {/* 확정 카드 */}
          <div className="bg-white rounded-2xl border border-emerald-200 p-6 text-center shadow-sm">
            <div className="text-4xl mb-4">🎉</div>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-2">
              일정 확정
            </p>
            <p className="text-2xl font-black text-stone-900 mb-1">
              4월 12일 (토)
            </p>
            <p className="text-lg font-bold text-stone-600 mb-4">20:00 시작</p>

            {/* 참여자 수 + 아바타 그리드 */}
            <p className="text-sm text-stone-400 mb-3">
              {ATTENDING_INDICES.length}명이 참여 가능한 날짜예요
            </p>
            <div className="flex justify-center gap-1.5 flex-wrap">
              {MOCK_ALL_MEMBERS.map((m) => {
                const attending = ATTENDING_INDICES.includes(m.idx);
                return (
                  <div
                    key={m.idx}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-1 ${
                      attending
                        ? `${AVATAR_COLORS[m.idx]} text-white ring-transparent`
                        : "bg-stone-100 text-stone-300 ring-stone-200"
                    }`}
                    title={m.name}
                  >
                    {m.name[0]}
                  </div>
                );
              })}
            </div>

            {/* 액션 버튼들 */}
            <div className="flex flex-col gap-2 mt-6">
              <button className="w-full bg-stone-900 text-white rounded-xl py-2.5 text-sm font-semibold">
                + 다음 회차 일정 만들기
              </button>
              <div className="flex gap-2">
                <button className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2 text-xs font-medium">
                  일정 수정
                </button>
                <button className="flex-1 border border-stone-200 text-stone-400 rounded-xl py-2 text-xs font-medium">
                  일정 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      </PhoneFrame>

      <ResultSwitcher current={7} />
    </>
  );
}
