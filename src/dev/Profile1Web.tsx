const MOCK = {
  nickname: "Danny",
  email: "danny@example.com",
  retroCount: 12,
};

const NAV_ITEMS = [
  { label: "메인", to: "/" },
  { label: "아카이브", to: "/archive" },
  { label: "일정", to: "/vote" },
  { label: "업데이트", to: "/updates" },
  { label: "프로필", to: "/profile" },
];

function Avatar() {
  return (
    <div className="w-24 h-24 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-3xl font-semibold">
      {MOCK.nickname.charAt(0)}
    </div>
  );
}

export default function Profile1Web() {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* 사이드바 */}
      <aside className="w-44 flex-shrink-0 flex flex-col px-4 pt-7 pb-5">
        <div className="mb-8">
          <span className="text-base font-black text-stone-900 tracking-tight">
            Checkin
          </span>
        </div>

        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.to}
              className={`block px-2 py-1.5 rounded-lg text-sm ${
                item.label === "프로필"
                  ? "font-semibold text-stone-900 bg-stone-200/60"
                  : "text-stone-400"
              }`}
            >
              {item.label}
            </div>
          ))}
        </nav>

        <div className="pt-4 border-t border-stone-200">
          <div className="text-xs font-medium text-stone-500 mb-1">
            {MOCK.nickname}
          </div>
          <button className="text-xs text-stone-400">로그아웃</button>
        </div>
      </aside>

      {/* 컨텐츠 패널 */}
      <div className="flex-1 overflow-y-auto bg-white border-l border-stone-200">
        <div className="max-w-4xl mx-auto px-10 pt-10 pb-20">
          {/* 프로필 컨텐츠 — 웹에서는 좁은 카드로 중앙 정렬 */}
          <div className="max-w-sm">
            {/* 아바타 + 정보 */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-4">
                <Avatar />
                <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-stone-900 flex items-center justify-center text-white text-xs shadow-md">
                  ✎
                </button>
              </div>
              <h1 className="text-xl font-bold text-stone-900 mb-1">
                {MOCK.nickname}
              </h1>
              <p className="text-sm text-stone-400">{MOCK.email}</p>
            </div>

            {/* 구분선 */}
            <div className="border-t border-stone-100 mb-8" />

            {/* 활동 통계 */}
            <div className="bg-stone-50 rounded-2xl p-5">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">
                활동
              </h2>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">회고 작성</span>
                <span className="text-sm font-bold text-stone-900">
                  {MOCK.retroCount}건
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 전환 바 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-1 bg-white/90 backdrop-blur-sm rounded-full shadow-lg px-2 py-1.5 border border-stone-200 z-50">
        <a
          href="/dev/1"
          className="px-3 py-1 rounded-full text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          모바일
        </a>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-900 text-white">
          웹
        </span>
      </div>
    </div>
  );
}
