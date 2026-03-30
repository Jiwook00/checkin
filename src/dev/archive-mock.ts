export interface MockMember {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  articleCount: number;
}

export interface MockArticle {
  id: string;
  member_id: string;
  title: string;
  preview_text: string;
  source_url: string;
  source_type: "notion" | "tistory" | "other";
  content_markdown: string;
  content_html: null;
  session: string;
  presentation_order: number | null;
  created_at: string;
  updated_at: string;
  checkin_members: { nickname: string; avatar_url: string | null };
}

export const MOCK_MEMBERS: MockMember[] = [
  { member_id: "m1", nickname: "지우크", avatar_url: null, articleCount: 42 },
  { member_id: "m2", nickname: "danny", avatar_url: null, articleCount: 38 },
  { member_id: "m3", nickname: "서진", avatar_url: null, articleCount: 35 },
  { member_id: "m4", nickname: "민준", avatar_url: null, articleCount: 30 },
  { member_id: "m5", nickname: "하은", avatar_url: null, articleCount: 27 },
  { member_id: "m6", nickname: "채원", avatar_url: null, articleCount: 22 },
];

const TITLES = [
  "2025년 상반기를 돌아보며 — 성장통과 배움",
  "Kotlin 코루틴 완전 정복기",
  "프론트엔드 성능 최적화 삽질 일지",
  "디자인 시스템 도입 후 6개월",
  "이직 준비하면서 배운 것들",
  "사이드 프로젝트가 본업에 미치는 영향",
  "리액트 19로 마이그레이션한 경험",
  "TypeScript strict 모드 켜고 살아남기",
  "팀 커뮤니케이션이 전부였다",
  "알고리즘 스터디 3개월 회고",
  "처음으로 AI 코딩 어시스턴트를 써봤다",
  "번아웃 경험기와 극복 방법",
  "오픈소스 기여 첫 도전기",
  "빠르게 배우는 것의 의미",
  "Supabase로 MVP 만들기",
  "협업 툴을 바꿨더니 생긴 일",
  "2024 회고 — 올해의 키워드",
  "재택근무 3년차가 된 소감",
  "코드 리뷰 문화 정착시키기",
  "Next.js App Router 전환 후기",
  "데이터베이스 설계를 잘못했을 때",
  "개발자 글쓰기 습관 만들기",
  "테스트 코드 없이 살다가 테스트 코드 쓰기",
  "배포 파이프라인 개선기",
  "2026년 1분기 회고",
];

const PREVIEWS = [
  "지난 한 달을 돌아보면 예상보다 많은 것을 해냈다는 느낌이 든다. 특히 코드 품질에 신경을 많이 쓸 수 있었고, 팀원과의 소통도 자연스럽게 늘어났다.",
  "코루틴을 제대로 이해하려면 suspend 함수의 동작 원리부터 파고들어야 했다. 처음엔 막막했지만 직접 코드를 짜보면서 감을 잡았다.",
  "번들 사이즈를 40% 줄이는 과정에서 가장 힘들었던 건 레거시 의존성을 제거하는 작업이었다. 예상치 못한 사이드 이펙트가 계속 터졌다.",
  "디자인 시스템을 도입하면서 컴포넌트 재사용률이 크게 높아졌다. 다만 초기 학습 비용이 예상보다 컸고, 팀 내 합의 과정도 쉽지 않았다.",
  "이직 준비를 하면서 가장 많이 느낀 건 평소에 정리를 잘 해두지 않았다는 아쉬움이었다. 내가 뭘 해왔는지 설명하는 게 이렇게 어렵다니.",
  "사이드 프로젝트를 시작한 지 3개월이 지났다. 본업에 지장을 주지 않는 선에서 유지하는 것이 핵심이었고, 덕분에 번아웃 없이 여기까지 왔다.",
  "React 19의 Actions와 useOptimistic을 적용했더니 UX가 눈에 띄게 개선됐다. 특히 낙관적 업데이트에서 체감 속도가 확실히 빨라졌다.",
  "strict 모드를 켜고 나서 처음 며칠은 빨간 줄과의 전쟁이었다. 하지만 결과적으로 런타임 버그가 훨씬 줄어서 후회 없는 결정이었다.",
  "결국 기술보다 사람이 먼저라는 걸 다시 한번 깨달았다. 팀원의 맥락을 이해하는 것이 모든 협업의 시작이고, 그게 속도를 결정한다.",
  "3개월 동안 꾸준히 알고리즘 문제를 풀면서 가장 크게 달라진 건 문제를 바라보는 시각이었다. 막막함보다 호기심이 먼저 생기기 시작했다.",
  "Cursor와 GitHub Copilot을 번갈아 써본 결과, 각각의 강점이 확실히 다르다. AI 어시스턴트를 쓰는 방법 자체를 배워야 한다는 걸 실감했다.",
  "번아웃은 갑자기 오지 않는다. 작은 신호들을 무시하다 보면 어느 순간 아무것도 하기 싫어지는 시점이 온다. 그 신호들을 이제는 읽을 수 있다.",
  "첫 PR이 머지되던 날의 기분은 아직도 생생하다. 오픈소스에 기여한다는 게 이렇게 뿌듯한 일인 줄 몰랐다. 다음 PR은 더 과감하게 도전할 것이다.",
  "빠르게 배우는 것과 깊게 배우는 것 사이의 균형을 찾는 것이 이번 분기의 가장 큰 과제였다. 아직도 답을 찾는 중이다.",
  "Supabase의 Row Level Security를 이해하는 데 생각보다 오래 걸렸다. 하지만 한번 잡히고 나니 백엔드 없이도 안전한 앱을 만드는 자신감이 생겼다.",
  "협업 툴을 Jira에서 Linear로 바꾸고 나서 가장 먼저 느낀 건 속도였다. 인터페이스가 빠르니까 흐름이 끊기지 않아 집중력 유지에도 도움이 됐다.",
  "올해의 키워드를 하나만 꼽으라면 '집중'이다. 여러 가지를 동시에 하려다 아무것도 못하는 패턴을 반복했고, 이제는 하나씩 끝내기로 했다.",
  "재택근무 3년차가 되니 루틴의 중요성을 더욱 실감한다. 특히 출근 시간을 흉내낸 시작 의식이 하루의 집중도를 완전히 바꿔놓았다.",
  "코드 리뷰 문화를 정착시키기 위해 가장 먼저 한 건 리뷰 가이드라인 문서를 작성하는 것이었다. 기준이 명확해지자 리뷰가 오히려 즐거워졌다.",
  "App Router로 전환하면서 서버 컴포넌트의 개념을 다시 한번 정리해야 했다. 처음엔 혼란스러웠지만 데이터 패칭 코드가 확실히 단순해졌다.",
  "스키마 설계 실수는 나중에 엄청난 마이그레이션 비용으로 돌아온다는 걸 이번에 뼈저리게 배웠다. 설계에 쓰는 시간은 절대 낭비가 아니다.",
  "글쓰기를 습관으로 만들기 위해 '완벽한 글 대신 완성된 글'이라는 원칙을 세웠다. 덕분에 꾸준히 쓸 수 있었고, 생각 정리 속도도 빨라졌다.",
  "테스트 코드 없이 개발하다가 처음으로 테스트를 붙이는 과정은 생각보다 험난했다. 하지만 그 이후로 리팩토링이 무섭지 않아졌다.",
  "GitHub Actions와 Vercel을 연동해서 배포 파이프라인을 자동화했다. 이제 PR 머지하면 자동으로 배포되니 릴리즈 스트레스가 사라졌다.",
  "1분기를 돌아보면 계획했던 것의 70% 정도를 달성했다. 미달성 30%는 대부분 우선순위 조정 때문이었고, 잘못된 선택은 아니었다.",
];

const MEMBERS = MOCK_MEMBERS;

function makeArticle(idx: number, session: string): MockArticle {
  const m = MEMBERS[idx % MEMBERS.length];
  return {
    id: `a${idx}-${session}`,
    member_id: m.member_id,
    title: TITLES[idx % TITLES.length],
    preview_text: PREVIEWS[idx % PREVIEWS.length],
    source_url: "https://example.com",
    source_type: idx % 3 === 0 ? "notion" : idx % 3 === 1 ? "tistory" : "other",
    content_markdown:
      "## 들어가며\n\n이번 회고는 지난 한 달을 돌아보는 시간이었습니다.\n\n### 잘한 것\n\n- 매일 꾸준히 코드를 작성했습니다\n- 팀원과의 소통을 늘렸습니다\n\n### 아쉬운 것\n\n- 문서 작성을 미뤘습니다\n\n## 마무리\n\n다음 달에는 더 나은 개발자가 되겠습니다.",
    content_html: null,
    session,
    presentation_order: null,
    created_at: `${session}-${String(10 + (idx % 18)).padStart(2, "0")}T10:00:00Z`,
    updated_at: `${session}-${String(10 + (idx % 18)).padStart(2, "0")}T10:00:00Z`,
    checkin_members: { nickname: m.nickname, avatar_url: null },
  };
}

export const MOCK_ARTICLES: MockArticle[] = [
  // 2026
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2026-03")),
  ...Array.from({ length: 5 }, (_, i) => makeArticle(i + 6, "2026-02")),
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i + 11, "2026-01")),
  // 2025
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2025-12")),
  ...Array.from({ length: 5 }, (_, i) => makeArticle(i + 5, "2025-11")),
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2025-10")),
  ...Array.from({ length: 5 }, (_, i) => makeArticle(i + 5, "2025-09")),
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2025-08")),
  ...Array.from({ length: 5 }, (_, i) => makeArticle(i + 5, "2025-07")),
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2025-06")),
  ...Array.from({ length: 5 }, (_, i) => makeArticle(i + 5, "2025-05")),
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2025-04")),
  // 2024
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2024-12")),
  ...Array.from({ length: 5 }, (_, i) => makeArticle(i + 5, "2024-11")),
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2024-10")),
  ...Array.from({ length: 5 }, (_, i) => makeArticle(i + 5, "2024-09")),
  ...Array.from({ length: 6 }, (_, i) => makeArticle(i, "2024-08")),
];
