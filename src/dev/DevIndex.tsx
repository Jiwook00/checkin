// DEV ONLY — 레이아웃 프리뷰 목록
import { Link } from "react-router-dom";

export default function DevIndex() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Dev Preview
          </span>
          <h1 className="mt-2 text-3xl font-black text-gray-900">
            레이아웃 프리뷰
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            현재 등록된 프리뷰가 없습니다.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-gray-300">
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
