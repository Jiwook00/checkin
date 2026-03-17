import type { ReactNode } from "react";
import type { Retrospective } from "../types";

export const MOCK_ARTICLES: Retrospective[] = [
  {
    id: "1",
    member_id: "me",
    title: "2월 회고: 꾸준함의 힘을 깨달은 한 달",
    source_url: "https://notion.so",
    source_type: "notion",
    content_html: null,
    content_markdown:
      "이번 달은 정말 많은 것을 배웠습니다. 꾸준하게 기록을 남기는 것이 얼마나 중요한지 체감했고, 작은 습관들이 쌓여서 큰 변화를 만들어낸다는 것을 다시 한번 느꼈습니다.",
    session: "2025년 2월 회고",
    created_at: "2025-03-01T10:00:00Z",
    updated_at: "2025-03-01T10:00:00Z",
    checkin_members: { nickname: "danny" },
  },
  {
    id: "2",
    member_id: "user-2",
    title: "사이드 프로젝트 회고 — 실패에서 배운 것들",
    source_url: "https://tistory.com",
    source_type: "tistory",
    content_html: null,
    content_markdown:
      "이번 달 진행했던 사이드 프로젝트가 결국 완성되지 못했습니다. 하지만 그 과정에서 많은 것을 배웠습니다. 특히 범위를 너무 크게 잡았던 것이 문제였습니다.",
    session: "2025년 2월 회고",
    created_at: "2025-03-01T11:00:00Z",
    updated_at: "2025-03-01T11:00:00Z",
    checkin_members: { nickname: "jiwook" },
  },
  {
    id: "3",
    member_id: "user-3",
    title: "책 읽기 목표 달성! 2월의 독서 회고",
    source_url: "https://notion.so",
    source_type: "notion",
    content_html: null,
    content_markdown:
      "2월에는 책 3권 읽기를 목표로 했고, 실제로 4권을 완독했습니다. 그 중에서도 가장 인상깊었던 책은 '원씽'이었습니다.",
    session: "2025년 2월 회고",
    created_at: "2025-03-01T12:00:00Z",
    updated_at: "2025-03-01T12:00:00Z",
    checkin_members: { nickname: "alice" },
  },
  {
    id: "4",
    member_id: "user-4",
    title: "운동 루틴 구축하기: 헬스 3개월 도전기",
    source_url: "https://velog.io",
    source_type: "other",
    content_html: null,
    content_markdown:
      "매일 헬스장에 가는 것이 목표였는데, 실제로는 주 4회 정도 방문했습니다. 처음보다는 많이 늘었지만 아직 목표치에는 미치지 못했습니다.",
    session: "2025년 2월 회고",
    created_at: "2025-03-01T13:00:00Z",
    updated_at: "2025-03-01T13:00:00Z",
    checkin_members: { nickname: "minjae" },
  },
  {
    id: "5",
    member_id: "me",
    title: "1월 회고: 새해 첫 달을 돌아보며",
    source_url: "https://notion.so",
    source_type: "notion",
    content_html: null,
    content_markdown:
      "새해가 시작되면서 많은 계획을 세웠습니다. 그 중 일부는 잘 이행되고 있고, 일부는 아직 시작도 못했습니다. 솔직하게 돌아보는 시간이 필요한 것 같습니다.",
    session: "2025년 1월 회고",
    created_at: "2025-02-01T10:00:00Z",
    updated_at: "2025-02-01T10:00:00Z",
    checkin_members: { nickname: "danny" },
  },
  {
    id: "6",
    member_id: "user-2",
    title: "코딩 공부 계획과 실행 돌아보기",
    source_url: "https://tistory.com",
    source_type: "tistory",
    content_html: null,
    content_markdown:
      "1월에는 알고리즘 공부를 본격적으로 시작했습니다. 매일 1문제씩 풀기로 했고, 실제로 25일 연속으로 해냈습니다. 예상보다 재미있었습니다.",
    session: "2025년 1월 회고",
    created_at: "2025-02-01T11:00:00Z",
    updated_at: "2025-02-01T11:00:00Z",
    checkin_members: { nickname: "jiwook" },
  },
  {
    id: "7",
    member_id: "user-3",
    title: "영어 공부 한 달 후기: 듀오링고 30일 스트릭",
    source_url: "https://notion.so",
    source_type: "notion",
    content_html: null,
    content_markdown:
      "듀오링고 스트릭 30일 달성! 매일 10분씩 영어 공부하는 것이 생각보다 어렵지 않았습니다. 꾸준함이 가장 중요하다는 것을 다시 한번 깨달았습니다.",
    session: "2025년 1월 회고",
    created_at: "2025-02-01T12:00:00Z",
    updated_at: "2025-02-01T12:00:00Z",
    checkin_members: { nickname: "alice" },
  },
  {
    id: "8",
    member_id: "user-4",
    title: "12월 회고: 한 해를 마무리하며",
    source_url: "https://velog.io",
    source_type: "other",
    content_html: null,
    content_markdown:
      "2024년 마지막 달입니다. 올 한 해를 돌아보면 정말 많은 일들이 있었습니다. 기쁜 일도 힘든 일도 있었지만, 모두 소중한 경험이었습니다.",
    session: "2024년 12월 회고",
    created_at: "2025-01-01T10:00:00Z",
    updated_at: "2025-01-01T10:00:00Z",
    checkin_members: { nickname: "minjae" },
  },
];

export const SOURCE_LABEL: Record<string, string> = {
  notion: "Notion",
  tistory: "Tistory",
  other: "Blog",
};

export const CURRENT_MEMBER_ID = "me";

export function Switcher({ current }: { current: number }) {
  const options = [
    { n: 1, label: "드로어" },
    { n: 2, label: "탭바" },
    { n: 3, label: "컴팩트" },
  ];
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1 bg-stone-900/90 backdrop-blur text-white rounded-full px-3 py-2 shadow-xl">
      <span className="text-xs text-stone-400 mr-2">스타일</span>
      {options.map((o) => (
        <a
          key={o.n}
          href={`/dev/${o.n}`}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            current === o.n
              ? "bg-white text-stone-900"
              : "text-stone-300 hover:text-white"
          }`}
        >
          {o.label}
        </a>
      ))}
      <span className="mx-2 text-stone-600">|</span>
      <a href="/dev" className="text-xs text-stone-400 hover:text-white">
        목록
      </a>
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-200 flex items-start justify-center py-10">
      <div
        className="relative bg-white rounded-[44px] overflow-hidden shadow-2xl ring-4 ring-stone-300/60"
        style={{ width: 375, height: 812 }}
      >
        {/* Status bar mock */}
        <div className="absolute top-0 left-0 right-0 h-11 z-50 flex items-center justify-between px-6 pointer-events-none">
          <span className="text-xs font-semibold text-stone-900">9:41</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-stone-900">●●●</span>
          </div>
        </div>
        <div className="h-full pt-11 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
