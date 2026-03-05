import { useState } from "react";
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
  const isOwner = article.member_id === currentMemberId;
  const nickname = article.checkin_members?.nickname ?? "알 수 없음";

  const preview = article.content_markdown
    .slice(0, 120)
    .replace(/[#*`>\-\[\]]/g, "")
    .trim();

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
        {article.session} &middot;{" "}
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
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
        )}
      </div>
    </div>
  );
}
