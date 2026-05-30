import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Retrospective } from "../types";

interface ArticleReaderProps {
  articles: Retrospective[];
}

export default function ArticleReader({ articles }: ArticleReaderProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const article = articles.find((a) => a.id === id);

  if (!article) {
    return (
      <div className="py-20 text-center text-stone-400">
        글을 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate(-1)}
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
        {(() => {
          const FALLBACK_MARKER = "<!-- jina-fallback -->";
          const isJinaFallback =
            article.content_markdown?.startsWith(FALLBACK_MARKER) ?? false;
          const displayMarkdown = isJinaFallback
            ? article
                .content_markdown!.slice(FALLBACK_MARKER.length)
                .trimStart()
            : article.content_markdown;

          if (!displayMarkdown) {
            return (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-2xl">
                  🔗
                </div>
                <p className="mb-1 text-sm font-medium text-stone-700">
                  글 내용을 가져올 수 없어요
                </p>
                <p className="mb-6 text-sm text-stone-400">
                  원본 링크에서 직접 확인해주세요.
                </p>
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                  원본 링크 열기 ↗
                </a>
              </div>
            );
          }

          return (
            <>
              {isJinaFallback && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <span className="mt-0.5 text-amber-500">⚠</span>
                  <div className="flex-1 text-sm text-amber-700">
                    <span>
                      노션 페이지의 서식이 일부 손실되었을 수 있어요.{" "}
                    </span>
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline underline-offset-2 hover:text-amber-900"
                    >
                      원본에서 보기 ↗
                    </a>
                  </div>
                </div>
              )}
              <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-pre:bg-gray-50">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: ({ src, alt }) => (
                      <img
                        src={src}
                        alt={alt ?? ""}
                        loading="lazy"
                        className="rounded-lg min-h-[120px] bg-stone-100"
                      />
                    ),
                  }}
                >
                  {displayMarkdown}
                </ReactMarkdown>
              </div>
            </>
          );
        })()}
      </article>
    </div>
  );
}
