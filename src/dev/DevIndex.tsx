// DEV ONLY — 레이아웃 프리뷰 목록
import { Link } from "react-router-dom";

const OPTIONS = [
  {
    num: 1,
    name: "클래식 라이트 사이드바",
    tags: ["라이트", "사이드바 240px", "Notion풍"],
    desc: "좌측 고정 사이드바, 라이트 테마. 가장 친숙하고 범용적인 레이아웃.",
    preview: "bg-gray-100",
    dot: "bg-gray-900",
  },
  {
    num: 2,
    name: "다크 모던",
    tags: ["다크", "사이드바 224px", "Vercel풍"],
    desc: "전체 다크 테마. 보라색 강조. 세련되고 개발자 친화적인 느낌.",
    preview: "bg-zinc-900",
    dot: "bg-violet-500",
  },
  {
    num: 3,
    name: "아이콘 레일",
    tags: ["라이트", "레일 64px", "VSCode풍"],
    desc: "아이콘 전용 좁은 레일. 콘텐츠 영역이 가장 넓어짐. 호버 시 툴팁 표시.",
    preview: "bg-slate-50",
    dot: "bg-indigo-500",
  },
  {
    num: 4,
    name: "탑 네비 + 필터 패널",
    tags: ["라이트", "탑 네비", "GitHub풍"],
    desc: "상단 가로 네비게이션 유지. 왼쪽 필터 패널로 세션·작성자 빠른 탐색.",
    preview: "bg-white",
    dot: "bg-blue-500",
  },
  {
    num: 5,
    name: "미니멀 와이드",
    tags: ["라이트", "사이드바 176px", "Bear풍"],
    desc: "아주 좁은 사이드바, 넓은 콘텐츠 영역. 여백 중심, 타이포그래피 포커스.",
    preview: "bg-stone-100",
    dot: "bg-stone-700",
  },
];

export default function DevIndex() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Dev Preview
          </span>
          <h1 className="mt-2 text-3xl font-black text-gray-900">
            레이아웃 5가지 옵션
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            각 번호를 클릭해 실물 레이아웃을 확인하세요. 하단 스위처로 빠르게
            전환할 수 있습니다.
          </p>
        </div>

        <div className="space-y-3">
          {OPTIONS.map((opt) => (
            <Link
              key={opt.num}
              to={`/dev/${opt.num}`}
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div
                className={`w-14 h-14 rounded-xl ${opt.preview} border border-gray-200 flex items-center justify-center flex-shrink-0`}
              >
                <div className={`w-3 h-3 rounded-full ${opt.dot}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900 text-sm">
                    {opt.num}. {opt.name}
                  </span>
                  {opt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {opt.desc}
                </p>
              </div>
              <span className="text-gray-300 text-lg flex-shrink-0">→</span>
            </Link>
          ))}
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
