import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { label: "메인", to: "/" },
  { label: "아카이브", to: "/archive" },
  { label: "투표", to: "/vote" },
  { label: "프로필", to: "/profile" },
];

interface LayoutProps {
  children: ReactNode;
  nickname: string;
  onLogout: () => void;
}

export default function Layout({ children, nickname, onLogout }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* Sidebar */}
      <aside className="w-44 flex-shrink-0 flex flex-col px-4 pt-7 pb-5">
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
        </div>
      </aside>

      {/* Content panel */}
      <div className="flex-1 overflow-y-auto bg-white border-l border-stone-200">
        <div className="max-w-4xl mx-auto px-10 py-10 pb-20">{children}</div>
      </div>
    </div>
  );
}
