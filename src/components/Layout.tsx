import { type ReactNode, useRef, useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";

const NAV_ITEMS = [
  { label: "메인", to: "/" },
  { label: "아카이브", to: "/archive" },
  { label: "일정", to: "/vote" },
  { label: "업데이트", to: "/updates" },
  { label: "사진첩", to: "/photos" },
  { label: "프로필", to: "/profile" },
];

interface LayoutProps {
  children: ReactNode;
  nickname: string;
  onLogout: () => void;
  onAddClick: () => void;
  fullBleed?: boolean;
  noPadding?: boolean;
}

export default function Layout({
  children,
  nickname,
  onLogout,
  onAddClick,
  fullBleed = false,
  noPadding = false,
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
    <div className="flex h-screen overflow-hidden bg-surface-card">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-44 flex-shrink-0 flex-col bg-canvas px-4 pt-7 pb-5 border-r border-hairline-soft">
        {/* Logo */}
        <div className="mb-8">
          <Link
            to="/"
            className="text-[15px] font-bold text-ink tracking-tight"
          >
            Checkin
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block px-2.5 py-1.5 rounded-[8px] text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-ink bg-surface-card"
                    : "text-muted hover:text-ink hover:bg-surface-card"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="pt-4 border-t border-hairline-soft">
          <div className="text-xs font-medium text-muted mb-1">{nickname}</div>
          <button
            onClick={onLogout}
            className="text-xs text-muted-soft hover:text-muted transition-colors"
          >
            로그아웃
          </button>
          <p className="text-xs text-hairline mt-2">v{__APP_VERSION__}</p>
        </div>
      </aside>

      {/* Mobile header */}
      <header
        className={`md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-canvas border-b border-hairline-soft flex items-center justify-between px-5 transition-transform duration-200 ${
          headerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <Link to="/" className="text-[15px] font-bold text-ink tracking-tight">
          Checkin
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-surface-card text-muted text-lg"
        >
          ☰
        </button>
      </header>

      {/* Content panel */}
      <div
        ref={fullBleed ? undefined : scrollRef}
        className={`flex-1 bg-surface-card border-l border-hairline-soft ${fullBleed ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        {fullBleed ? (
          children
        ) : noPadding ? (
          <div className="pt-[4.5rem] pb-20 md:pt-0">{children}</div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 pt-[4.5rem] pb-20 md:px-10 md:pt-10">
            {children}
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-64 bg-canvas shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="h-14 flex items-center justify-between px-5 border-b border-hairline-soft">
              <Link
                to="/"
                className="text-[15px] font-bold text-ink tracking-tight"
                onClick={() => setDrawerOpen(false)}
              >
                Checkin
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-surface-card text-muted"
              >
                ✕
              </button>
            </div>

            {/* Add article button */}
            <div className="px-4 pt-4 pb-3 border-b border-hairline-soft">
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  onAddClick();
                }}
                className="w-full rounded-[8px] bg-primary h-10 text-sm font-semibold text-on-primary"
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
                    `block px-3 py-2 rounded-[8px] text-sm transition-colors ${
                      isActive
                        ? "font-semibold text-ink bg-surface-card"
                        : "text-muted hover:bg-surface-card"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* User */}
            <div className="px-5 py-4 border-t border-hairline-soft">
              <p className="text-sm font-medium text-muted mb-1">{nickname}</p>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  onLogout();
                }}
                className="text-xs text-muted-soft hover:text-muted"
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
