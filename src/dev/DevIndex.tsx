const SECTIONS = [
  {
    title: "아카이브 페이지 프리뷰",
    desc: "왼쪽 카드 리스트 스타일 3종. 오른쪽은 공통 대시보드형(멤버 프로필 카드 그리드).",
    options: [
      {
        path: "/dev/archive-1",
        label: "미니멀 카드형",
        desc: "흰 배경 + 테두리 카드. 제목 강조, 본문 미리보기 2줄, 하단 작성자 아바타+닉네임.",
      },
      {
        path: "/dev/archive-2",
        label: "컬러 어센트형",
        desc: "멤버별 색상 왼쪽 테두리 어센트. 제목+미리보기+작성자를 컴팩트하게.",
      },
      {
        path: "/dev/archive-3",
        label: "뉴스피드형",
        desc: "카드 박스 없이 구분선으로 분리. 작성자 헤더 → 큰 제목 → 본문 3줄 미리보기.",
      },
    ],
  },
  {
    title: "프로필 페이지 프리뷰",
    desc: "",
    options: [
      {
        path: "/dev/1",
        label: "미니멀 카드 — 모바일",
        desc: "중앙 정렬 아바타 + 통계 카드. 기존 앱 스타일과 가장 자연스럽게 어울림.",
      },
      {
        path: "/dev/1-web",
        label: "미니멀 카드 — 웹",
        desc: "사이드바 레이아웃 안에서의 미니멀 카드. 좁은 카드가 콘텐츠 영역 안에 위치.",
      },
      {
        path: "/dev/2",
        label: "배너형",
        desc: "어두운 상단 배너에 아바타가 경계를 걸쳐서 등장. 통계는 그리드 카드.",
      },
      {
        path: "/dev/3",
        label: "설정 앱 스타일",
        desc: "iOS 설정 앱처럼 섹션별 목록 UI. 좌측 정렬 아바타 + 정보 행.",
      },
    ],
  },
];

export default function DevIndex() {
  return (
    <div className="min-h-screen bg-stone-100 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-black text-stone-900 mb-1">
          Design Preview
        </h1>
        <p className="text-sm text-stone-500 mb-10">
          마음에 드는 스타일을 골라주세요. 특정 요소만 조합하는 것도 가능합니다.
        </p>

        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-base font-bold text-stone-700 mb-1">
                {section.title}
              </h2>
              {section.desc && (
                <p className="text-xs text-stone-400 mb-3">{section.desc}</p>
              )}
              <div className="space-y-2">
                {section.options.map(({ path, label, desc }) => (
                  <a
                    key={path}
                    href={path}
                    className="block bg-white rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow border border-stone-100"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-stone-900">
                        {label}
                      </span>
                      <span className="text-stone-300 text-sm">→</span>
                    </div>
                    <p className="text-sm text-stone-400">{desc}</p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
