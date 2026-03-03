// DEV ONLY — 레이아웃 프리뷰 목록
import { Link } from "react-router-dom";

const PREVIEWS: { n: number; title: string; desc: string; tags: string[] }[] =
  [];

export default function DevIndex() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Dev Preview — Issue #22
          </span>
          <h1 className="mt-2 text-3xl font-black text-gray-900">
            일정 조율 개편
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            등록된 프리뷰가 없습니다.
          </p>
        </div>

        <div className="space-y-3">
          {PREVIEWS.map((p) => (
            <Link
              key={p.n}
              to={`/dev/${p.n}`}
              className="flex items-start gap-4 bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-400 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center text-lg font-black flex-shrink-0 group-hover:bg-gray-700 transition-colors">
                {p.n}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-gray-900 block mb-0.5">
                  {p.title}
                </span>
                <p className="text-sm text-gray-500 mb-2">{p.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-gray-300 group-hover:text-gray-600 transition-colors text-lg mt-1">
                →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-300">
          기존 앱은{" "}
          <Link to="/" className="underline hover:text-gray-500">
            /
          </Link>{" "}
          에서 접근 가능 (로그인 필요)
        </p>
      </div>
    </div>
  );
}
