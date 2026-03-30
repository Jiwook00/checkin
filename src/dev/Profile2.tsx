import { PhoneFrame, Switcher } from "./shared";

const MOCK = {
  nickname: "Danny",
  email: "danny@example.com",
  retroCount: 12,
};

export default function Profile2() {
  return (
    <PhoneFrame>
      {/* 모바일 헤더 */}
      <header className="h-14 bg-white border-b border-stone-100 flex items-center justify-between px-5 relative z-10">
        <span className="text-base font-black text-stone-900 tracking-tight">
          Checkin
        </span>
        <button className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-700">
          ☰
        </button>
      </header>

      {/* 상단 배너 */}
      <div className="h-28 bg-stone-900 relative">
        {/* 아바타 — 배너 하단에 걸쳐서 표시 */}
        <div className="absolute -bottom-10 left-6">
          <div className="w-20 h-20 rounded-full bg-stone-300 flex items-center justify-center text-stone-600 text-2xl font-semibold ring-4 ring-white">
            {MOCK.nickname.charAt(0)}
          </div>
          {/* 편집 버튼 */}
          <button className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-white text-xs ring-2 ring-white">
            ✎
          </button>
        </div>
      </div>

      {/* 컨텐츠 (아바타 공간 확보) */}
      <div className="px-6 pt-14 pb-28">
        {/* 닉네임 + 이메일 */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-stone-900 mb-0.5">
            {MOCK.nickname}
          </h1>
          <p className="text-sm text-stone-400">{MOCK.email}</p>
        </div>

        {/* 통계 — 수평 카드 2칸 레이아웃 */}
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
          활동
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-stone-50 rounded-2xl p-4">
            <p className="text-2xl font-black text-stone-900 mb-1">
              {MOCK.retroCount}
            </p>
            <p className="text-xs text-stone-400">회고 작성</p>
          </div>
          {/* 향후 확장 자리 */}
          <div className="bg-stone-50 rounded-2xl p-4 opacity-30">
            <p className="text-2xl font-black text-stone-900 mb-1">—</p>
            <p className="text-xs text-stone-400">준비 중</p>
          </div>
        </div>
      </div>

      <Switcher current={2} />
    </PhoneFrame>
  );
}
