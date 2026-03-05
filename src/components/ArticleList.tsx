import type { Retrospective } from "../types";
import ArticleCard from "./ArticleCard";

interface ArticleListProps {
  articles: Retrospective[];
  onArticleClick: (article: Retrospective) => void;
  currentMemberId: string;
  onEdit: (article: Retrospective) => void;
  onDelete: (id: string) => Promise<void>;
}

export default function ArticleList({
  articles,
  onArticleClick,
  currentMemberId,
  onEdit,
  onDelete,
}: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-stone-400">아직 등록된 회고 글이 없습니다</p>
        <p className="mt-2 text-xs text-stone-400">
          오른쪽 상단의 "글 추가" 버튼으로 회고 글을 등록해보세요
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          onClick={() => onArticleClick(article)}
          currentMemberId={currentMemberId}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
