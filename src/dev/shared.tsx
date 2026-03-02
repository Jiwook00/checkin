// DEV ONLY — 레이아웃 프리뷰 공통 모듈
import { Link } from "react-router-dom";

export const MOCK_ARTICLES = [
  {
    id: 1,
    title: "2월 회고: 커뮤니케이션 개선 후기",
    author: "김민준",
    session: "2025-02",
    type: "notion",
    excerpt:
      "회고를 하면서 팀의 커뮤니케이션 방식에 대해 깊이 생각해보는 시간이 됐습니다.",
  },
  {
    id: 2,
    title: "팀 워크플로우를 바꾼 3가지 실험",
    author: "이서연",
    session: "2025-02",
    type: "tistory",
    excerpt:
      "작은 실험 3가지를 통해 팀 전체의 작업 흐름이 어떻게 바뀌었는지 기록합니다.",
  },
  {
    id: 3,
    title: "1월 돌아보기: 목표 설정의 어려움",
    author: "박지호",
    session: "2025-01",
    type: "notion",
    excerpt: "올해 목표를 세우면서 느낀 것들. 구체성과 모호함 사이에서의 균형.",
  },
  {
    id: 4,
    title: "스프린트 회고: 속도보다 방향",
    author: "최유나",
    session: "2025-01",
    type: "other",
    excerpt:
      "빠르게 달리는 것보다 올바른 방향으로 가는 것이 중요하다는 걸 다시 깨달았습니다.",
  },
  {
    id: 5,
    title: "리모트 환경에서의 협업 회고",
    author: "정현우",
    session: "2024-12",
    type: "notion",
    excerpt:
      "풀리모트 3개월 차. 비동기 협업의 장점과 어려움을 솔직하게 정리했습니다.",
  },
  {
    id: 6,
    title: "번아웃 전조 증상과 회복",
    author: "한지원",
    session: "2024-12",
    type: "tistory",
    excerpt:
      "번아웃이 오기 전에 알아챌 수 있는 신호들과 제가 회복한 방법을 공유합니다.",
  },
];

export function Switcher({ current }: { current: number }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-gray-900/90 backdrop-blur-sm px-4 py-2 shadow-xl z-50">
      <Link
        to="/dev"
        className="text-xs text-gray-400 hover:text-white transition-colors px-1 mr-1"
      >
        목록
      </Link>
      <span className="text-gray-700 text-xs">·</span>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <Link
          key={n}
          to={`/dev/${n}`}
          className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
            n === current
              ? "bg-white text-gray-900"
              : "text-gray-500 hover:text-white"
          }`}
        >
          {n}
        </Link>
      ))}
    </div>
  );
}
