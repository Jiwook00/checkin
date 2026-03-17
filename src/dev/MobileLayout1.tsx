/**
 * Option 1: 드로어 (이슈 #39 와이어프레임)
 * - 우측에서 슬라이드인 드로어
 * - 스크롤 방향에 따라 헤더 hide/show
 * - 세션별 파티션 헤더
 * - 카드 내 ⋮ 메뉴 (소유자만)
 */
import { useState, useRef, useEffect, useMemo } from "react";
import {
  MOCK_ARTICLES,
  SOURCE_LABEL,
  CURRENT_MEMBER_ID,
  PhoneFrame,
  Switcher,
} from "./shared";

const NAV_ITEMS = [
  { label: "메인", to: "/" },
  { label: "아카이브", to: "/archive" },
  { label: "일정", to: "/vote" },
  { label: "업데이트", to: "/updates" },
  { label: "프로필", to: "/profile" },
];

export default function MobileLayout1() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const st = el.scrollTop;
      if (st <= 0) {
        setHeaderVisible(true);
      } else if (st > lastScrollTop.current + 4) {
        setHeaderVisible(false);
        setMenuOpenId(null);
      } else if (st < lastScrollTop.current - 4) {
        setHeaderVisible(true);
      }
      lastScrollTop.current = st;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof MOCK_ARTICLES>();
    for (const a of MOCK_ARTICLES) {
      if (!map.has(a.session)) map.set(a.session, []);
      map.get(a.session)!.push(a);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <>
      <PhoneFrame>
        <div className="relative flex-1 overflow-hidden bg-stone-50">
          {/* Header */}
          <header
            className={`absolute top-0 left-0 right-0 z-20 h-14 bg-white border-b border-stone-100 flex items-center justify-between px-5 transition-transform duration-200 ${
              headerVisible ? "translate-y-0" : "-translate-y-full"
            }`}
          >
            <span className="text-base font-black text-stone-900 tracking-tight">
              Checkin
            </span>
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-stone-100 transition-colors text-stone-700 text-lg"
            >
              ☰
            </button>
          </header>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            className="absolute inset-0 overflow-y-auto"
            style={{ paddingTop: 56 }}
            onClick={() => setMenuOpenId(null)}
          >
            <div className="px-4 pt-4 pb-24">
              {/* Announcement Banner */}
              <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                <span className="text-sm mt-0.5">📣</span>
                <p className="text-xs text-amber-900 leading-snug flex-1">
                  3월 22일 오후 3시 오프라인 모임이 확정되었습니다. 강남역 근처
                  카페에서 만나요!
                </p>
              </div>

              {/* Session Banner */}
              <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4">
                <h1 className="text-base font-black text-stone-900 leading-tight">
                  3월에 하는 2월 회고
                </h1>
                <p className="text-xs text-stone-500 mt-1">
                  3월 22일 (토) 오후 3시 · 오프라인
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  📍 강남역 2번 출구
                </p>
              </div>

              {/* Session groups */}
              {grouped.map(([session, articles]) => (
                <div key={session} className="mb-6">
                  {/* Session partition header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-stone-400 whitespace-nowrap">
                      {session}
                    </span>
                    <div className="flex-1 h-px bg-stone-200" />
                  </div>

                  {/* Article cards */}
                  <div className="flex flex-col gap-2.5">
                    {articles.map((article) => {
                      const isOwner = article.member_id === CURRENT_MEMBER_ID;
                      const preview = article.content_markdown
                        .slice(0, 100)
                        .replace(/[#*`>\-\[\]]/g, "")
                        .trim();
                      return (
                        <div
                          key={article.id}
                          className="relative w-full rounded-2xl border border-stone-100 bg-white p-4 active:bg-stone-50 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs font-medium text-stone-400">
                              {SOURCE_LABEL[article.source_type] ??
                                article.source_type}
                            </span>
                            {isOwner && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(
                                      menuOpenId === article.id
                                        ? null
                                        : article.id,
                                    );
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 text-base leading-none"
                                >
                                  ⋮
                                </button>
                                {menuOpenId === article.id && (
                                  <div className="absolute right-0 top-8 z-30 bg-white border border-stone-200 rounded-xl shadow-lg py-1 min-w-[80px]">
                                    <button className="w-full text-left px-4 py-2 text-xs text-stone-600 hover:bg-stone-50">
                                      수정
                                    </button>
                                    <button className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50">
                                      삭제
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <h3 className="text-sm font-semibold text-stone-900 leading-snug mb-2">
                            {article.title}
                          </h3>
                          <p className="text-xs text-stone-400 leading-relaxed mb-3 line-clamp-2">
                            {preview}
                          </p>
                          <span className="text-xs text-stone-400 font-medium">
                            {article.checkin_members?.nickname}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drawer overlay */}
          {drawerOpen && (
            <div className="absolute inset-0 z-40">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="absolute top-0 right-0 bottom-0 w-64 bg-white shadow-2xl flex flex-col">
                {/* Drawer header */}
                <div className="h-14 flex items-center justify-between px-5 border-b border-stone-100">
                  <span className="text-base font-black text-stone-900 tracking-tight">
                    Checkin
                  </span>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-stone-100 text-stone-500"
                  >
                    ✕
                  </button>
                </div>

                {/* Add article button */}
                <div className="px-4 pt-4 pb-3 border-b border-stone-100">
                  <button className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white">
                    + 글 추가
                  </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 px-3 pt-3 space-y-0.5">
                  {NAV_ITEMS.map((item) => (
                    <a
                      key={item.to}
                      href={item.to}
                      className="block px-3 py-2 rounded-xl text-sm text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                {/* User */}
                <div className="px-5 py-4 border-t border-stone-100">
                  <p className="text-sm font-medium text-stone-600 mb-1">
                    danny
                  </p>
                  <button className="text-xs text-stone-400 hover:text-stone-600">
                    로그아웃
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PhoneFrame>
      <Switcher current={1} />
    </>
  );
}
