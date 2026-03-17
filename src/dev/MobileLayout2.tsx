/**
 * Option 2: 탭바
 * - 하단 고정 탭 네비게이션 (Instagram/Twitter 스타일)
 * - 헤더는 항상 표시 (섹션 제목)
 * - FAB(+) 버튼으로 글 추가
 * - 세션 파티션 헤더
 */
import { useState, useMemo } from "react";
import {
  MOCK_ARTICLES,
  SOURCE_LABEL,
  CURRENT_MEMBER_ID,
  PhoneFrame,
  Switcher,
} from "./shared";

const TABS = [
  { label: "메인", icon: "◈" },
  { label: "아카이브", icon: "◫" },
  { label: "일정", icon: "◷" },
  { label: "업데이트", icon: "◉" },
  { label: "프로필", icon: "◎" },
];

export default function MobileLayout2() {
  const [activeTab, setActiveTab] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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
        <div className="flex-1 overflow-hidden flex flex-col bg-stone-50">
          {/* Top header - always visible */}
          <header className="shrink-0 h-14 bg-white border-b border-stone-100 flex items-center px-5">
            <span className="text-base font-black text-stone-900 tracking-tight">
              Checkin
            </span>
          </header>

          {/* Scrollable content */}
          <div
            className="flex-1 overflow-y-auto"
            onClick={() => setMenuOpenId(null)}
          >
            <div className="px-4 pt-4 pb-4">
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
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-stone-400 whitespace-nowrap">
                      {session}
                    </span>
                    <div className="flex-1 h-px bg-stone-200" />
                  </div>
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
                          className="relative w-full rounded-2xl border border-stone-100 bg-white p-4"
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
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 text-base"
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

          {/* FAB - 글 추가 */}
          <button className="absolute bottom-20 right-4 z-20 w-12 h-12 rounded-full bg-stone-900 text-white shadow-lg flex items-center justify-center text-2xl font-light hover:bg-stone-700 transition-colors">
            +
          </button>

          {/* Bottom tab bar */}
          <nav className="shrink-0 h-16 bg-white border-t border-stone-100 flex items-center justify-around px-2">
            {TABS.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  activeTab === i ? "text-stone-900" : "text-stone-400"
                }`}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </PhoneFrame>
      <Switcher current={2} />
    </>
  );
}
