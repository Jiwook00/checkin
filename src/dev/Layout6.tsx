// DEV ONLY — 레이아웃 프리뷰 #6: 세션 헤더 + 컴팩트 날짜 투표 밴드
import { MOCK_ARTICLES, Switcher } from "./shared";

// 오늘 날짜 기준으로 "N월에 하는 N-1월 회고" 계산
const NOW = new Date(2026, 2, 2); // 2026-03-02
const SESSION_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth() + 1; // 3
const RETRO_MONTH = CURRENT_MONTH - 1; // 2

const SESSION_LABEL = `${SESSION_YEAR}년 ${CURRENT_MONTH}월`;
const RETRO_TITLE = `${CURRENT_MONTH}월에 하는 ${RETRO_MONTH}월 회고`;

const VOTE_OPTIONS = [
  { date: "3월 14일 (토)", count: 3 },
  { date: "3월 21일 (토)", count: 2 },
  { date: "3월 22일 (일)", count: 1 },
];

const NAV = [
  { label: "메인", active: true },
  { label: "아카이브", active: false },
  { label: "투표", active: false },
  { label: "프로필", active: false },
];

const SESSION_TABS = ["전체", "2025-02", "2025-01", "2024-12"];

export default function Layout6() {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#faf9f7" }}
    >
      {/* Narrow Sidebar */}
      <aside className="w-44 flex-shrink-0 flex flex-col px-4 pt-7 pb-5">
        <div className="mb-8">
          <span className="text-base font-black text-stone-900 tracking-tight">
            Checkin
          </span>
        </div>
        <nav className="flex-1 space-y-0.5">
          {NAV.map((item) => (
            <div
              key={item.label}
              className={`px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                item.active
                  ? "font-semibold text-stone-900 bg-stone-200/60"
                  : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              }`}
            >
              {item.label}
            </div>
          ))}
        </nav>
        <div className="pt-4 border-t border-stone-200">
          <div className="text-xs font-medium text-stone-500 mb-1">김민준</div>
          <button className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            로그아웃
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white border-l border-stone-200">
        <div className="max-w-4xl mx-auto px-10 py-10 pb-20">
          {/* Session Header */}
          <div className="mb-5 flex items-start justify-between">
            <div>
              <div className="text-xs text-stone-400 mb-1 font-medium uppercase tracking-widest">
                {SESSION_LABEL}
              </div>
              <h1 className="text-2xl font-black text-stone-900 leading-tight">
                {RETRO_TITLE}
              </h1>
            </div>
            <button className="mt-1 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors">
              + 글 추가
            </button>
          </div>

          {/* Date Vote — Compact Inline Band */}
          <div className="mb-8 flex items-center gap-2 flex-wrap rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3">
            <span className="text-xs font-semibold text-stone-400">
              날짜 투표 중
            </span>
            <div className="w-px h-3 bg-stone-200 mx-0.5" />
            {VOTE_OPTIONS.map((opt) => (
              <button
                key={opt.date}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 hover:border-stone-400 hover:shadow-sm transition-all"
              >
                {opt.date}
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-stone-900 text-white text-[10px] font-bold">
                  {opt.count}
                </span>
              </button>
            ))}
            <button className="ml-auto text-xs text-stone-400 hover:text-stone-600 underline transition-colors">
              날짜 선택하기
            </button>
          </div>

          {/* Session tab filter */}
          <div className="flex items-center gap-1.5 mb-7 border-b border-stone-100 pb-5">
            {SESSION_TABS.map((s, i) => (
              <button
                key={s}
                className={`text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
                  i === 0
                    ? "bg-stone-900 text-white"
                    : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                }`}
              >
                {s}
              </button>
            ))}
            <span className="ml-auto">
              <select className="text-xs text-stone-400 bg-transparent focus:outline-none cursor-pointer hover:text-stone-700">
                <option>작성자: 전체</option>
                <option>김민준</option>
                <option>이서연</option>
              </select>
            </span>
          </div>

          {/* Articles */}
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
            {MOCK_ARTICLES.map((a) => (
              <div key={a.id} className="group cursor-pointer">
                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-5 hover:bg-white hover:shadow-sm hover:border-stone-200 transition-all">
                  <div className="mb-2 text-xs font-medium text-stone-400">
                    {a.session} &middot; {a.type}
                  </div>
                  <h3 className="text-sm font-semibold text-stone-900 leading-snug mb-2.5">
                    {a.title}
                  </h3>
                  <p className="text-xs text-stone-400 leading-relaxed mb-3 line-clamp-2">
                    {a.excerpt}
                  </p>
                  <div className="text-xs text-stone-400 font-medium">
                    {a.author}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Switcher current={6} />
    </div>
  );
}
