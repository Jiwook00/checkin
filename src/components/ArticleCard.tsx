import type { Retrospective } from "../types";

interface ArticleCardProps {
  article: Retrospective;
  onClick: () => void;
}

const sourceTypeLabel: Record<string, string> = {
  notion: "Notion",
  tistory: "Tistory",
  other: "Blog",
};

export default function ArticleCard({ article, onClick }: ArticleCardProps) {
  const preview = article.content_markdown
    .slice(0, 120)
    .replace(/[#*`>\-\[\]]/g, "")
    .trim();

  return (
    <button onClick={onClick} className="group w-full text-left">
      <div className="rounded-2xl border border-stone-100 bg-stone-50 p-5 hover:bg-white hover:shadow-sm hover:border-stone-200 transition-all">
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
        <div className="text-xs text-stone-400 font-medium">
          {article.author}
        </div>
      </div>
    </button>
  );
}
