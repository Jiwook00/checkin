import { useMemo } from "react";
import type { Retrospective } from "../types";
import ArticleCard from "./ArticleCard";

function formatSessionLabel(session: string): string {
  const [year, month] = session.split("-");
  return `${year}년 ${parseInt(month)}월 회고`;
}

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
  const grouped = useMemo(() => {
    const map = new Map<string, Retrospective[]>();
    for (const a of articles) {
      if (!map.has(a.session)) map.set(a.session, []);
      map.get(a.session)!.push(a);
    }
    return Array.from(map.entries());
  }, [articles]);

  if (grouped.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted">아직 등록된 회고 글이 없습니다</p>
        <p className="mt-2 text-xs text-muted-soft">
          글 추가 버튼으로 회고 글을 등록해보세요
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {grouped.map(([session, sessionArticles]) => (
        <div key={session}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-muted whitespace-nowrap">
              {formatSessionLabel(session)}
            </span>
            <div className="flex-1 h-px bg-hairline" />
          </div>
          <div className="flex flex-col gap-2.5">
            {sessionArticles.map((article) => (
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
        </div>
      ))}
    </div>
  );
}
