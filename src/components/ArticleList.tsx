import { useMemo } from "react";
import type { Retrospective } from "../types";
import ArticleCard from "./ArticleCard";

function formatSessionLabel(session: string): string {
  const [year, month] = session.split("-");
  return `${year}년 ${parseInt(month)}월 회고`;
}

interface ArticleListProps {
  articles: Retrospective[];
  mobileArticles?: Retrospective[];
  onArticleClick: (article: Retrospective) => void;
  currentMemberId: string;
  onEdit: (article: Retrospective) => void;
  onDelete: (id: string) => Promise<void>;
}

export default function ArticleList({
  articles,
  mobileArticles,
  onArticleClick,
  currentMemberId,
  onEdit,
  onDelete,
}: ArticleListProps) {
  const mobileSource = mobileArticles ?? articles;

  const grouped = useMemo(() => {
    const map = new Map<string, Retrospective[]>();
    for (const a of mobileSource) {
      if (!map.has(a.session)) map.set(a.session, []);
      map.get(a.session)!.push(a);
    }
    return Array.from(map.entries());
  }, [mobileSource]);

  if (articles.length === 0 && mobileSource.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-stone-400">아직 등록된 회고 글이 없습니다</p>
        <p className="mt-2 text-xs text-stone-400">
          글 추가 버튼으로 회고 글을 등록해보세요
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile layout — grouped by session, 1-column */}
      <div className="md:hidden flex flex-col gap-6">
        {grouped.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-stone-400">
              아직 등록된 회고 글이 없습니다
            </p>
          </div>
        ) : (
          grouped.map(([session, sessionArticles]) => (
            <div key={session}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-stone-400 whitespace-nowrap">
                  {formatSessionLabel(session)}
                </span>
                <div className="flex-1 h-px bg-stone-200" />
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
          ))
        )}
      </div>

      {/* Desktop layout — current grid */}
      <div className="hidden md:grid gap-5 grid-cols-2 lg:grid-cols-3">
        {articles.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <p className="text-sm text-stone-400">
              아직 등록된 회고 글이 없습니다
            </p>
            <p className="mt-2 text-xs text-stone-400">
              오른쪽 상단의 "글 추가" 버튼으로 회고 글을 등록해보세요
            </p>
          </div>
        ) : (
          articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onClick={() => onArticleClick(article)}
              currentMemberId={currentMemberId}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </>
  );
}
