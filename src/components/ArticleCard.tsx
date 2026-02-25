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
  const date = new Date(article.created_at).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {sourceTypeLabel[article.source_type] || article.source_type}
        </span>
        <span className="text-xs text-gray-400">{article.session}</span>
      </div>

      <h3 className="mb-2 text-base font-semibold text-gray-900 group-hover:text-gray-700">
        {article.title}
      </h3>

      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-gray-500">
        {preview}...
      </p>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {article.author}
        </span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>
    </button>
  );
}
