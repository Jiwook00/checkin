import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Retrospective } from "../types";

interface ArticleReaderProps {
  article: Retrospective;
  onClose: () => void;
}

export default function ArticleReader({
  article,
  onClose,
}: ArticleReaderProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            <span>&larr;</span> 목록으로
          </button>
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            원본 링크
          </a>
        </div>
      </div>

      {/* 글 내용 */}
      <article className="mx-auto max-w-3xl px-6 py-10">
        {/* 메타 정보 */}
        <header className="mb-10">
          <h1 className="mb-4 text-3xl font-bold leading-tight text-gray-900">
            {article.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium text-gray-700">
              {article.checkin_members?.nickname ?? "알 수 없음"}
            </span>
            <span>&middot;</span>
            <span>{article.session}</span>
            <span>&middot;</span>
            <span>
              {new Date(article.created_at).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </header>

        {/* 마크다운 렌더링 */}
        <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-pre:bg-gray-50">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content_markdown}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
