// DEV ONLY — 레이아웃 프리뷰 목록
import { Link } from "react-router-dom";

const PREVIEWS = [
  {
    n: 1,
    title: "되는시간 스타일",
    desc: "왼쪽 달력 + 오른쪽 날짜 상세 패널. 날짜 클릭 시 참여자 목록 표시.",
    tags: ["Split", "Calendar", "Detail panel"],
  },
  {
    n: 2,
    title: "Doodle 그리드",
    desc: "멤버 × 날짜 표. 전체 응답 현황을 한눈에 파악 가능. 최다 득표 날짜 강조.",
    tags: ["Grid", "Table", "All members"],
  },
  {
    n: 3,
    title: "날짜 카드 리스트",
    desc: "날짜별 카드 + 진행률 바. 가장 직관적. 모바일 친화적.",
    tags: ["Cards", "Progress bar", "Simple"],
  },
  {
    n: 4,
    title: "큰 달력 + 현황 사이드",
    desc: "달력이 메인. 후보 날짜에 득표 수 표시. 오른쪽에 현황 패널.",
    tags: ["Large calendar", "Hover preview", "Side panel"],
  },
  {
    n: 5,
    title: "단계별 선택 플로우",
    desc: "선택 → 확인 → 완료 스텝. 달력 + 버튼 리스트 조합. 모바일 퍼스트.",
    tags: ["Step flow", "Mobile first", "CTA focused"],
  },
  {
    n: 6,
    title: "현황 A: 달력 히트맵",
    desc: "달력 셀 안에 가능 인원 수 표시. 최다 득표 날짜 emerald로 강조.",
    tags: ["Heatmap", "Cell badge", "Minimal"],
    badge: "현황",
  },
  {
    n: 7,
    title: "현황 B: 상단 현황 배너",
    desc: "달력 위에 요약 카드 추가. 응답 진행률 바 + 유력 날짜 칩 + 미응답 멤버.",
    tags: ["Banner", "Progress bar", "Summary card"],
    badge: "현황",
  },
  {
    n: 8,
    title: "현황 C: 멤버 응답 그리드",
    desc: "달력 아래에 멤버 × 날짜 응답 표. 누가 어느 날 가능한지 한눈에.",
    tags: ["Grid", "Member list", "Table"],
    badge: "현황",
  },
];

export default function DevIndex() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Dev Preview — Issue #11
          </span>
          <h1 className="mt-2 text-3xl font-black text-gray-900">
            일정 조율 페이지
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            8가지 옵션을 비교하고 마음에 드는 스타일을 선택하세요. (6~8번: 현황
            표시 방식)
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
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-gray-900">{p.title}</span>
                  {"badge" in p && p.badge && (
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                      {p.badge}
                    </span>
                  )}
                </div>
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
