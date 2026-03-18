/**
 * 투표 확정 결과 화면 — Option 8: 아바타 그리드 + 이름 표시
 * - 아바타 아래에 이름 텍스트 추가
 * - 참여/미참여 섹션을 레이블로 구분
 * - 누가 오는지 / 못 오는지 이름으로 명확하게 파악 가능
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

export default function VoteResult2() {
  const attending = MOCK_ALL_MEMBERS.filter((m) =>
    ATTENDING_INDICES.includes(m.idx),
  );
  const absent = MOCK_ALL_MEMBERS.filter(
    (m) => !ATTENDING_INDICES.includes(m.idx),
  );

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
            <p className="text-lg font-bold text-stone-600 mb-5">20:00 시작</p>

            {/* 참여 가능 멤버 */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
                참여 가능 {attending.length}명
              </p>
              <div className="flex justify-center gap-3 flex-wrap">
                {attending.map((m) => (
                  <div key={m.idx} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${AVATAR_COLORS[m.idx]}`}
                    >
                      {m.name[0]}
                    </div>
                    <span className="text-[10px] text-stone-600 font-medium">
                      {m.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 구분선 */}
            <div className="border-t border-stone-100 my-4" />

            {/* 미참여 멤버 */}
            {absent.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-semibold text-stone-300 uppercase tracking-widest mb-3">
                  불참 {absent.length}명
                </p>
                <div className="flex justify-center gap-3 flex-wrap">
                  {absent.map((m) => (
                    <div
                      key={m.idx}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-stone-100 text-stone-300 ring-1 ring-stone-200">
                        {m.name[0]}
                      </div>
                      <span className="text-[10px] text-stone-300 font-medium">
                        {m.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 버튼들 */}
            <div className="flex flex-col gap-2 mt-2">
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

      <ResultSwitcher current={8} />
    </>
  );
}
