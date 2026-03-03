// DEV ONLY — 레이아웃 프리뷰 목록
import { Link } from "react-router-dom";

const PREVIEWS = [
  {
    n: 1,
    title: "새 일정 만들기",
    desc: "빈 상태 → 온라인/오프라인 프리셋 선택 → 날짜·시간·장소 설정 폼. 3단계 플로우.",
    tags: ["Create flow", "Preset", "Step-by-step"],
  },
  {
    n: 2,
    title: "투표 중 — Split 레이아웃",
    desc: "기존 달력+패널 구조 유지. 모드 토글 제거, 가능 날만 선택. 상단 마감 버튼.",
    tags: ["Split", "Calendar", "Detail panel"],
  },
  {
    n: 3,
    title: "투표 중 — 단일 컬럼",
    desc: "달력 전체 너비. 주말 선택 시 인라인 시간 피커 확장. 하단 고정 저장 바. 모바일 친화.",
    tags: ["Single column", "Inline picker", "Mobile-first"],
  },
  {
    n: 4,
    title: "마감 → 확정 플로우",
    desc: "마감 확인 다이얼로그 → 득표 현황 + 날짜 선택 모달 → 확정 완료 화면.",
    tags: ["Close dialog", "Confirm modal", "Tally"],
  },
  {
    n: 5,
    title: "전체 플로우 모킹 테스트",
    desc: "새 데이터 구조(type/location/date_from~to/time 필드, mode 제거) 기준. 생성→투표→마감→확정 전체 플로우를 인메모리로 테스트. ⚙ Dev 패널에서 다른 멤버 투표 추가 가능.",
    tags: ["Full flow", "Mock data", "New API shape", "Interactive"],
  },
];

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
            4가지 화면을 비교하고 마음에 드는 스타일을 선택하세요.
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
