import { useState, useEffect, useRef } from "react";
import type { Retrospective } from "../types";
import MemberAvatar from "./MemberAvatar";

interface ArticleCardProps {
  article: Retrospective;
  onClick: () => void;
  currentMemberId: string;
  onEdit: (article: Retrospective) => void;
  onDelete: (id: string) => Promise<void>;
}

function formatSession(session: string): string {
  const [year, month] = session.split("-");
  return `${year}년 ${parseInt(month)}월`;
}

function extractTextFromTiptapJson(jsonStr: string): string {
  try {
    const doc = JSON.parse(jsonStr) as { content?: unknown[] };
    const parts: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as { text?: string; content?: unknown[] };
      if (n.text) parts.push(n.text);
      if (n.content) n.content.forEach(walk);
    };
    walk(doc);
    return parts.join(" ").slice(0, 120).trim();
  } catch {
    return "";
  }
}

export default function ArticleCard({
  article,
  onClick,
  currentMemberId,
  onEdit,
  onDelete,
}: ArticleCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileConfirmDelete, setMobileConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = article.member_id === currentMemberId;
  const nickname = article.checkin_members?.nickname ?? "알 수 없음";

  const preview =
    article.content_type === "written"
      ? extractTextFromTiptapJson(article.content_markdown)
      : article.content_markdown
          .slice(0, 120)
          .replace(/[#*`>\-\[\]]/g, "")
          .trim();

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setMobileConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(article.id);
  };

  return (
    <div
      onClick={onClick}
      className="group w-full text-left cursor-pointer rounded-[12px] border border-hairline bg-surface-card px-5 py-4 hover:bg-canvas hover:shadow-sm transition-all flex gap-5 items-start"
    >
      {/* Left: avatar + nickname */}
      <div className="flex flex-col items-center gap-1.5 w-12 flex-shrink-0 pt-0.5">
        <MemberAvatar
          memberId={article.member_id}
          name={nickname}
          avatarUrl={article.checkin_members?.avatar_url ?? null}
          size={44}
        />
        <span className="text-[11px] text-muted-soft font-medium text-center leading-tight w-full truncate">
          {nickname}
        </span>
      </div>

      {/* Right: content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs text-muted-soft">
            {formatSession(article.session)}
          </span>
          {isOwner && (
            <>
              {/* Desktop: hover buttons */}
              <div className="hidden md:flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(article);
                  }}
                  className="text-xs text-muted hover:text-ink px-1"
                >
                  수정
                </button>
                {confirmDelete ? (
                  <>
                    <button
                      onClick={handleDelete}
                      className="text-xs text-error hover:text-red-700 px-1"
                    >
                      확인
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(false);
                      }}
                      className="text-xs text-muted hover:text-ink px-1"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleDelete}
                    className="text-xs text-muted hover:text-error px-1"
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* Mobile: ⋮ menu */}
              <div className="md:hidden relative" ref={menuRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((prev) => !prev);
                  }}
                  aria-label="더보기 메뉴"
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-soft active:bg-surface-card text-base leading-none"
                >
                  ⋮
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-8 z-30 bg-canvas border border-hairline rounded-[12px] shadow-lg py-1 min-w-[80px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onEdit(article);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-body hover:bg-surface-card"
                    >
                      수정
                    </button>
                    {mobileConfirmDelete ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            setMobileConfirmDelete(false);
                            onDelete(article.id);
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-error hover:bg-red-50"
                        >
                          확인
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMobileConfirmDelete(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-muted hover:bg-surface-card"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileConfirmDelete(true);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-error hover:bg-red-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <h3 className="text-sm font-semibold text-ink leading-snug mb-1.5">
          {article.title}
        </h3>
        <p className="text-xs text-muted-soft leading-relaxed line-clamp-2">
          {preview}
        </p>
      </div>
    </div>
  );
}
