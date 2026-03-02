// DEV ONLY — 레이아웃 프리뷰 #3: 아이콘 레일 (VSCode/Figma 스타일)
import { MOCK_ARTICLES, Switcher } from "./shared";

const RAIL = [
  { icon: "🏠", label: "메인", active: true },
  { icon: "📚", label: "아카이브", active: false },
  { icon: "🗳️", label: "투표", active: false },
  { icon: "👤", label: "프로필", active: false },
];

export default function Layout3() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Icon Rail */}
      <aside className="w-16 flex-shrink-0 flex flex-col items-center border-r border-gray-200 bg-white py-4">
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center mb-5 flex-shrink-0">
          <span className="text-white text-sm font-black">C</span>
        </div>

        {/* Nav icons */}
        <div className="flex-1 flex flex-col items-center gap-1 w-full px-2">
          {RAIL.map((item) => (
            <div
              key={item.label}
              title={item.label}
              className={`relative group w-full flex items-center justify-center rounded-xl h-10 cursor-pointer transition-colors ${
                item.active
                  ? "bg-gray-900"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <span
                className={`text-lg leading-none ${item.active ? "grayscale-0" : ""}`}
              >
                {item.icon}
              </span>
              {/* Tooltip */}
              <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
              </div>
            </div>
          ))}
        </div>

        {/* User */}
        <div
          title="김민준"
          className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center cursor-pointer flex-shrink-0 hover:ring-2 hover:ring-violet-300 transition-all"
        >
          <span className="text-white text-xs font-bold">김</span>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (page title + actions) */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-3">
          <h2 className="font-semibold text-gray-900">메인</h2>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none">
              <option>전체 세션</option>
              <option>2025-02</option>
              <option>2025-01</option>
            </select>
            <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none">
              <option>전체 작성자</option>
              <option>김민준</option>
            </select>
            <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
              + 글 추가
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 overflow-y-auto px-8 py-6 pb-20">
          {/* Session banner */}
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 p-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-indigo-400 font-medium mb-0.5 uppercase tracking-widest">
                다음 회고까지
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-gray-900">D-14</span>
                <span className="text-sm text-gray-400">
                  2025년 2월 15일 · 온라인
                </span>
              </div>
            </div>
          </div>

          {/* Articles — 4col because the rail is narrow */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {MOCK_ARTICLES.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="mb-1.5 text-xs font-medium text-indigo-400">
                  {a.session}
                </div>
                <h3 className="mb-2.5 text-sm font-semibold text-gray-900 leading-snug">
                  {a.title}
                </h3>
                <span className="text-xs text-gray-400">{a.author}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Switcher current={3} />
    </div>
  );
}
