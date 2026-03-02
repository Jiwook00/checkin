// DEV ONLY — 레이아웃 프리뷰 #4: 탑 네비 + 필터 패널 (GitHub/Jira 스타일)
import { MOCK_ARTICLES, Switcher } from "./shared";

const TOP_NAV = [
  { label: "메인", active: true },
  { label: "아카이브", active: false },
  { label: "투표", active: false },
  { label: "프로필", active: false },
];

const SESSIONS = ["전체", "2025-02", "2025-01", "2024-12"];
const AUTHORS = ["전체", "김민준", "이서연", "박지호", "최유나", "정현우"];

export default function Layout4() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Top Navigation */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 h-14">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <span className="font-bold text-gray-900 text-base tracking-tight">
              Checkin
            </span>
            <nav className="flex items-center">
              {TOP_NAV.map((item) => (
                <div
                  key={item.label}
                  className={`relative px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                    item.active
                      ? "font-medium text-gray-900"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                  {item.active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 -mb-[1px]" />
                  )}
                </div>
              ))}
            </nav>
          </div>

          {/* Right: Actions + User */}
          <div className="flex items-center gap-3">
            <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
              + 글 추가
            </button>
            <div className="flex items-center gap-2 border-l border-gray-100 pl-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center">
                <span className="text-white text-xs font-bold">김</span>
              </div>
              <span className="text-sm text-gray-600">김민준</span>
              <button className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body: filter sidebar + content */}
      <div className="flex flex-1 overflow-hidden bg-gray-50">
        {/* Filter Sidebar */}
        <aside className="w-48 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            <div className="mb-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                세션
              </div>
              {SESSIONS.map((s, i) => (
                <div
                  key={s}
                  className={`px-2.5 py-1.5 rounded-lg text-sm cursor-pointer mb-0.5 transition-colors ${
                    i === 0
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {s}
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                작성자
              </div>
              {AUTHORS.map((a, i) => (
                <div
                  key={a}
                  className={`px-2.5 py-1.5 rounded-lg text-sm cursor-pointer mb-0.5 transition-colors ${
                    i === 0
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {a}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 pb-20">
          {/* Session banner */}
          <div className="mb-5 flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-4 shadow-sm">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">다음 회고까지</div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-black text-gray-900">D-14</span>
                <span className="text-sm text-gray-400">
                  · 2025년 2월 15일 · 온라인
                </span>
              </div>
            </div>
          </div>

          {/* Articles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {MOCK_ARTICLES.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="mb-1.5 text-xs font-medium text-blue-500">
                  {a.session}
                </div>
                <h3 className="mb-2.5 text-sm font-semibold text-gray-900 leading-snug">
                  {a.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">
                  {a.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{a.author}</span>
                  <span className="text-xs text-gray-400">{a.type}</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <Switcher current={4} />
    </div>
  );
}
