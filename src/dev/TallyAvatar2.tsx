/**
 * 득표 현황 아바타 — Option 2: 전체 멤버 그리드 (Full Member Grid)
 * - 각 행 하단에 전체 멤버 아바타 줄 추가
 * - 투표: 컬러 원 + 이니셜 / 미투표: 회색 반투명
 * - "누가 안 했는지"까지 한눈에 파악
 */

import { PhoneFrame } from "./shared";

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

interface TallyItem {
  date: number;
  dayName: string;
  time: string;
  voterIndices: number[];
}

const MOCK_TALLY: TallyItem[] = [
  { date: 5, dayName: "토", time: "20:00", voterIndices: [0, 1, 2, 3] },
  { date: 5, dayName: "토", time: "21:00", voterIndices: [0, 2, 3] },
  { date: 12, dayName: "토", time: "19:00", voterIndices: [0, 1, 2, 3, 4] },
  { date: 12, dayName: "토", time: "20:00", voterIndices: [1, 2] },
];

const TOTAL_MEMBERS = 8;
const TOP_COUNT = Math.max(...MOCK_TALLY.map((t) => t.voterIndices.length));

function TallySwitcher({ current }: { current: number }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1 bg-stone-900/90 backdrop-blur text-white rounded-full px-3 py-2 shadow-xl">
      <span className="text-xs text-stone-400 mr-2">아바타 스타일</span>
      {[
        { n: 4, label: "스택" },
        { n: 5, label: "그리드" },
        { n: 6, label: "칩" },
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

export default function TallyAvatar2() {
  return (
    <>
      <PhoneFrame>
        <div className="relative flex-1 overflow-hidden">
          {/* 배경 흐림 */}
          <div className="absolute inset-0 bg-stone-50 flex flex-col items-center justify-center gap-2 opacity-40">
            <div className="w-48 h-6 bg-stone-300 rounded-lg" />
            <div className="w-64 h-40 bg-stone-200 rounded-2xl mt-4" />
            <div className="w-64 h-8 bg-stone-300 rounded-xl mt-2" />
          </div>

          {/* 팝업 오버레이 */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 px-4">
            <div className="bg-white rounded-2xl w-full shadow-2xl overflow-hidden">
              {/* 헤더 */}
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-0.5">
                    4월
                  </p>
                  <h2 className="text-base font-black text-stone-900">
                    득표 현황
                  </h2>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    6/8명 응답 완료
                    <span className="ml-1.5 text-stone-400">(불참 1명)</span>
                  </p>
                </div>
                <button className="text-stone-400 text-lg font-light">✕</button>
              </div>

              {/* 리스트 */}
              <div className="p-3 max-h-72 overflow-y-auto">
                <div className="space-y-2">
                  {MOCK_TALLY.map((item) => {
                    const isTop = item.voterIndices.length === TOP_COUNT;
                    return (
                      <div
                        key={`${item.date}-${item.time}`}
                        className={`p-3 rounded-xl border ${
                          isTop
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-stone-100 bg-white"
                        }`}
                      >
                        {/* 상단 행: 날짜박스 + 텍스트 + 카운트 */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0 bg-white border border-stone-100">
                            <span className="text-sm font-black text-stone-900">
                              {item.date}
                            </span>
                            <span className="text-[9px] text-stone-400">
                              {item.dayName}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-stone-800">
                              4월 {item.date}일 ({item.dayName}) {item.time}
                            </p>
                            {isTop && (
                              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                                최다 득표
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            <p className="text-sm font-black text-stone-900 text-right">
                              {item.voterIndices.length}
                              <span className="text-[10px] font-normal text-stone-400">
                                /{TOTAL_MEMBERS}명
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* 하단 행: 전체 멤버 아바타 그리드 */}
                        <div className="flex gap-1.5 mt-2.5 pl-12">
                          {MOCK_ALL_MEMBERS.map((m) => {
                            const voted = item.voterIndices.includes(m.idx);
                            return (
                              <div
                                key={m.idx}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 transition-all ${
                                  voted
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
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 하단 버튼 */}
              <div className="p-3 border-t border-stone-100 flex gap-2">
                <button className="flex-1 py-2 border border-stone-200 rounded-xl text-xs text-stone-600">
                  닫기
                </button>
                <button className="flex-1 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold">
                  마감하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </PhoneFrame>

      <TallySwitcher current={5} />
    </>
  );
}
