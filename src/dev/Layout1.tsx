// DEV ONLY — 레이아웃 프리뷰 #1: 클래식 라이트 사이드바 (Notion/Linear 스타일)
import { MOCK_ARTICLES, Switcher } from "./shared";

const NAV = [
  { icon: "🏠", label: "메인", active: true },
  { icon: "📚", label: "아카이브", active: false },
  { icon: "🗳️", label: "투표", active: false },
  { icon: "👤", label: "프로필", active: false },
];

export default function Layout1() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-black">C</span>
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">
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
                  ? "bg-gray-100 font-medium text-gray-900"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-gray-50 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">김</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                김민준
              </div>
            </div>
            <button className="text-xs text-gray-400 hover:text-red-400 transition-colors flex-shrink-0">
              나가기
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8 pb-20">
          {/* Session banner */}
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm p-6 flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-widest">
                다음 회고까지
              </div>
              <div className="text-4xl font-black text-gray-900 tracking-tight">
                D-14
              </div>
              <div className="text-sm text-gray-400 mt-1.5">
                2025년 2월 15일 · 온라인
              </div>
            </div>
            <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
              + 글 추가
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-5">
            <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200">
              <option>전체 세션</option>
              <option>2025-02</option>
              <option>2025-01</option>
              <option>2024-12</option>
            </select>
            <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200">
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
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="mb-1.5 text-xs font-medium text-indigo-500">
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
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                    {a.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Switcher current={1} />
    </div>
  );
}
