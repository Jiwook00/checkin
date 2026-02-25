import type { Retrospective } from "../types";
import ArticleCard from "./ArticleCard";

interface ArticleListProps {
  articles: Retrospective[];
  onArticleClick: (article: Retrospective) => void;
}

export default function ArticleList({
  articles,
  onArticleClick,
}: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-400">아직 등록된 회고 글이 없습니다</p>
        <p className="mt-2 text-sm text-gray-400">
          상단의 "글 추가" 버튼으로 회고 글을 등록해보세요
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          onClick={() => onArticleClick(article)}
        />
      ))}
    </div>
  );
}
