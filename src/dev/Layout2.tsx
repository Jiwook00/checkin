// DEV ONLY — 레이아웃 프리뷰 #2: 다크 모던 (Vercel/Raycast 스타일)
import { MOCK_ARTICLES, Switcher } from "./shared";

const NAV = [
  { label: "메인", active: true },
  { label: "아카이브", active: false },
  { label: "투표", active: false },
  { label: "프로필", active: false },
];

export default function Layout2() {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-zinc-800">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-black">C</span>
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight">
            Checkin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none transition-colors ${
                item.active
                  ? "bg-zinc-700/60 text-white font-medium"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  item.active ? "bg-violet-400" : "bg-zinc-700"
                }`}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-zinc-800 cursor-pointer transition-colors">
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">김</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-300 truncate">
                김민준
              </div>
            </div>
            <button className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
              나가기
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8 pb-20">
          {/* Session banner */}
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-widest">
                Next Session
              </div>
              <div className="text-4xl font-black text-white tracking-tight">
                D-14
              </div>
              <div className="text-sm text-zinc-500 mt-1.5">
                2025년 2월 15일 · 온라인
              </div>
            </div>
            <button className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors">
              + 글 추가
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-5">
            <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600">
              <option>전체 세션</option>
              <option>2025-02</option>
              <option>2025-01</option>
              <option>2024-12</option>
            </select>
            <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600">
              <option>전체 작성자</option>
              <option>김민준</option>
              <option>이서연</option>
            </select>
          </div>

          {/* Articles */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {MOCK_ARTICLES.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition-colors cursor-pointer group"
              >
                <div className="mb-1.5 text-xs font-medium text-violet-400">
                  {a.session}
                </div>
                <h3 className="mb-2.5 text-sm font-semibold text-zinc-100 leading-snug group-hover:text-white transition-colors">
                  {a.title}
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed mb-3 line-clamp-2">
                  {a.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{a.author}</span>
                  <span className="text-xs border border-zinc-700 text-zinc-500 px-2 py-0.5 rounded-full">
                    {a.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Switcher current={2} />
    </div>
  );
}
