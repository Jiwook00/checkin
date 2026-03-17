export default function DevIndex() {
  const options = [
    {
      n: 1,
      title: "드로어",
      desc: "이슈 와이어프레임 충실 구현",
      details: [
        "우측 슬라이드인 드로어 메뉴",
        "스크롤 내릴 때 헤더 숨김 / 올릴 때 표시",
        "세션 파티션 헤더 (──────)",
        "카드 내 ⋮ 메뉴 (소유자만)",
      ],
    },
    {
      n: 2,
      title: "탭바",
      desc: "하단 탭 네비게이션",
      details: [
        "하단 고정 탭바 (메인·아카이브·일정·업데이트·프로필)",
        "헤더 항상 표시 (hide/show 없음)",
        "우하단 FAB(+) 로 글 추가",
        "한 손 조작에 유리한 레이아웃",
      ],
    },
    {
      n: 3,
      title: "컴팩트",
      desc: "정보 밀도 높은 리스트형",
      details: [
        "드로어 네비게이션 (Option 1과 동일)",
        "카드 미리보기 텍스트 없음 — 제목+메타만",
        "구분선 스타일 리스트 (border-box 없음)",
        "세션 헤더 배경색으로 구분",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-stone-100 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-black text-stone-900 mb-1">
          모바일 UI 프리뷰
        </h1>
        <p className="text-sm text-stone-500 mb-8">
          이슈 #39 — 아래 옵션을 클릭해 실물 프리뷰 확인 후 마음에 드는 스타일을
          알려주세요.
        </p>

        <div className="grid gap-4">
          {options.map((opt) => (
            <a
              key={opt.n}
              href={`/dev/${opt.n}`}
              className="block bg-white rounded-2xl border border-stone-200 p-5 hover:border-stone-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs font-semibold text-stone-400 mb-1 block">
                    Option {opt.n}
                  </span>
                  <h2 className="text-lg font-bold text-stone-900 group-hover:text-stone-700">
                    {opt.title}
                  </h2>
                  <p className="text-sm text-stone-500">{opt.desc}</p>
                </div>
                <span className="text-stone-300 group-hover:text-stone-600 text-xl transition-colors">
                  →
                </span>
              </div>
              <ul className="space-y-1">
                {opt.details.map((d) => (
                  <li
                    key={d}
                    className="flex items-start gap-2 text-xs text-stone-500"
                  >
                    <span className="text-stone-300 mt-0.5">•</span>
                    {d}
                  </li>
                ))}
              </ul>
            </a>
          ))}
        </div>

        <p className="mt-8 text-xs text-stone-400 text-center">
          각 프리뷰에서 하단 스위처로 빠르게 비교 가능
        </p>
      </div>
    </div>
  );
}
