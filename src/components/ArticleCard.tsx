import { useState, useEffect, useRef } from "react";
import type { Retrospective } from "../types";

interface ArticleCardProps {
  article: Retrospective;
  onClick: () => void;
  currentMemberId: string;
  onEdit: (article: Retrospective) => void;
  onDelete: (id: string) => Promise<void>;
}

const sourceTypeLabel: Record<string, string> = {
  notion: "Notion",
  tistory: "Tistory",
  other: "Blog",
};

export default function ArticleCard({
  article,
  onClick,
  currentMemberId,
  onEdit,
  onDelete,
}: ArticleCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = article.member_id === currentMemberId;
  const nickname = article.checkin_members?.nickname ?? "알 수 없음";

  const preview = article.content_markdown
    .slice(0, 120)
    .replace(/[#*`>\-\[\]]/g, "")
    .trim();

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
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
      className="group w-full text-left cursor-pointer rounded-2xl border border-stone-100 bg-stone-50 p-5 hover:bg-white hover:shadow-sm hover:border-stone-200 transition-all"
    >
      <div className="mb-2 text-xs font-medium text-stone-400">
        <span className="hidden md:inline">{article.session} &middot; </span>
        {sourceTypeLabel[article.source_type] || article.source_type}
      </div>
      <h3 className="text-sm font-semibold text-stone-900 leading-snug mb-2.5">
        {article.title}
      </h3>
      <p className="text-xs text-stone-400 leading-relaxed mb-3 line-clamp-2">
        {preview}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-400 font-medium">{nickname}</span>
        {isOwner && (
          <>
            {/* Desktop: hover buttons */}
            <div className="hidden md:flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(article);
                }}
                className="text-xs text-stone-400 hover:text-stone-700 px-1"
              >
                수정
              </button>
              {confirmDelete ? (
                <>
                  <button
                    onClick={handleDelete}
                    className="text-xs text-red-500 hover:text-red-700 px-1"
                  >
                    확인
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(false);
                    }}
                    className="text-xs text-stone-400 hover:text-stone-700 px-1"
                  >
                    취소
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDelete}
                  className="text-xs text-stone-400 hover:text-red-500 px-1"
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
                className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 active:bg-stone-100 text-base leading-none"
              >
                ⋮
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-8 z-30 bg-white border border-stone-200 rounded-xl shadow-lg py-1 min-w-[80px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit(article);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-stone-600 hover:bg-stone-50"
                  >
                    수정
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete(article.id);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
