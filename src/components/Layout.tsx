import { type ReactNode, useRef, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { label: "메인", to: "/" },
  { label: "아카이브", to: "/archive" },
  { label: "일정", to: "/vote" },
  { label: "업데이트", to: "/updates" },
  { label: "프로필", to: "/profile" },
];

interface LayoutProps {
  children: ReactNode;
  nickname: string;
  onLogout: () => void;
  onAddClick: () => void;
}

export default function Layout({
  children,
  nickname,
  onLogout,
  onAddClick,
}: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
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
      } else if (st < lastScrollTop.current - 4) {
        setHeaderVisible(true);
      }
      lastScrollTop.current = st;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-44 flex-shrink-0 flex-col px-4 pt-7 pb-5">
        {/* Logo */}
        <div className="mb-8">
          <span className="text-base font-black text-stone-900 tracking-tight">
            Checkin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-stone-900 bg-stone-200/60"
                    : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="pt-4 border-t border-stone-200">
          <div className="text-xs font-medium text-stone-500 mb-1">
            {nickname}
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            로그아웃
          </button>
          <p className="text-xs text-stone-300 mt-2">v{__APP_VERSION__}</p>
        </div>
      </aside>

      {/* Mobile header */}
      <header
        className={`md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-stone-100 flex items-center justify-between px-5 transition-transform duration-200 ${
          headerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <span className="text-base font-black text-stone-900 tracking-tight">
          Checkin
        </span>
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-stone-100 text-stone-700 text-lg"
        >
          ☰
        </button>
      </header>

      {/* Content panel */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-white md:border-l border-stone-200"
      >
        <div className="max-w-4xl mx-auto px-4 pt-[4.5rem] pb-20 md:px-10 md:pt-10">
          {children}
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
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
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  onAddClick();
                }}
                className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white"
              >
                + 글 추가
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 pt-3 space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-xl text-sm transition-colors ${
                      isActive
                        ? "font-semibold text-stone-900 bg-stone-100"
                        : "text-stone-600 hover:bg-stone-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* User */}
            <div className="px-5 py-4 border-t border-stone-100">
              <p className="text-sm font-medium text-stone-600 mb-1">
                {nickname}
              </p>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  onLogout();
                }}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
