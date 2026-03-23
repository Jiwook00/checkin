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

        <h2 className="text-lg font-black text-stone-900 mt-12 mb-1">
          확정 결과 화면 — 참여자 표시 스타일
        </h2>
        <p className="text-sm text-stone-500 mb-6">
          투표 마감 후 확정 카드에서 참여 가능 멤버를 아바타로 표시하는 2가지
          방향
        </p>
        <div className="grid gap-4">
          {[
            {
              n: 7,
              title: "아바타 그리드",
              desc: "현재 dot 줄 → 원형 아바타로 교체",
              details: [
                "참여: 컬러 원 + 이니셜 / 불참: 회색 반투명",
                "카드 레이아웃 최소 변경",
                "8명을 한 줄에 나란히 표시",
                "/dev/5 그리드 스타일 적용",
              ],
            },
            {
              n: 8,
              title: "아바타 + 이름",
              desc: "참여/불참 섹션 구분 + 이름 표시",
              details: [
                "참여 가능 / 불참 섹션을 레이블로 분리",
                "아바타 아래 이름 텍스트 표시",
                "누가 오는지/못 오는지 이름으로 명확하게 파악",
                "카드 높이가 약간 커짐",
              ],
            },
          ].map((opt) => (
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
                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-stone-700">
                    {opt.title}
                  </h3>
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

        <h2 className="text-lg font-black text-stone-900 mt-12 mb-1">
          득표 현황 — 아바타 스타일
        </h2>
        <p className="text-sm text-stone-500 mb-6">
          현황 팝업의 도트를 멤버 아바타로 교체하는 3가지 방향
        </p>
        <div className="grid gap-4">
          {[
            {
              n: 4,
              title: "스택 아바타",
              desc: "겹쳐진 원형 아바타 (우측 배치)",
              details: [
                "현재 row 레이아웃 유지 — 도트만 교체",
                "투표자 아바타가 우측에서 겹쳐서 쌓임",
                "5명 초과 시 +N 표시",
                "레이아웃 변경 최소화",
              ],
            },
            {
              n: 5,
              title: "전체 멤버 그리드",
              desc: "전체 8명을 항상 표시",
              details: [
                "행 하단에 멤버 전체 아바타 줄 추가",
                "투표: 컬러 / 미투표: 회색 반투명",
                "누가 안 했는지도 한눈에 파악",
                "행 높이가 약간 커짐",
              ],
            },
            {
              n: 6,
              title: "이름 칩",
              desc: "텍스트 닉네임 pill 형태",
              details: [
                "아바타 원형 없이 이름 텍스트로 표시",
                "닉네임이 가장 명확하게 읽힘",
                "우측에는 카운트 숫자만",
                "글자 수에 따라 행 높이 유동적",
              ],
            },
          ].map((opt) => (
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
                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-stone-700">
                    {opt.title}
                  </h3>
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

        <h2 className="text-lg font-black text-stone-900 mt-12 mb-1">
          주사위 스타일 — lottie-react
        </h2>
        <p className="text-sm text-stone-500 mb-6">
          굴리는 동안 Lottie 애니메이션이 재생되고, 결과는 점으로 표시
        </p>
        <a
          href="/dev/9"
          className="block bg-white rounded-2xl border border-stone-200 p-5 hover:border-stone-400 hover:shadow-sm transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-xs font-semibold text-stone-400 mb-1 block">
                Option 9
              </span>
              <h3 className="text-lg font-bold text-stone-900 group-hover:text-stone-700">
                Lottie 흔들기 애니메이션
              </h3>
              <p className="text-sm text-stone-500">
                클릭 → Lottie 재생 → 결과 dot 표시
              </p>
            </div>
            <span className="text-stone-300 group-hover:text-stone-600 text-xl transition-colors">
              →
            </span>
          </div>
          <ul className="space-y-1">
            {[
              "굴리는 동안 Lottie JSON 애니메이션 (흔들기 + 스쿼시)",
              "결과 확정 시 실제 점(dot) 주사위 면으로 전환",
              "로컬 번들 JSON — 네트워크 의존 없음",
              "LottieFiles에서 더 좋은 애니메이션으로 교체 가능",
            ].map((d) => (
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
      </div>
    </div>
  );
}
