import { PhoneFrame, Switcher } from "./shared";

const MOCK = {
  nickname: "Danny",
  email: "danny@example.com",
  retroCount: 12,
};

function Avatar() {
  return (
    <div className="w-24 h-24 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-3xl font-semibold">
      {MOCK.nickname.charAt(0)}
    </div>
  );
}

export default function Profile1() {
  return (
    <PhoneFrame>
      {/* 모바일 헤더 */}
      <header className="h-14 bg-white border-b border-stone-100 flex items-center justify-between px-5">
        <span className="text-base font-black text-stone-900 tracking-tight">
          Checkin
        </span>
        <button className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-700">
          ☰
        </button>
      </header>

      <div className="px-6 pt-10 pb-28">
        {/* 아바타 + 정보 */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <Avatar />
            <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-stone-900 flex items-center justify-center text-white text-xs shadow-md">
              ✎
            </button>
          </div>
          <h1 className="text-xl font-bold text-stone-900 mb-1">
            {MOCK.nickname}
          </h1>
          <p className="text-sm text-stone-400">{MOCK.email}</p>
        </div>

        {/* 구분선 */}
        <div className="border-t border-stone-100 mb-8" />

        {/* 활동 통계 */}
        <div className="bg-stone-50 rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">
            활동
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">회고 작성</span>
            <span className="text-sm font-bold text-stone-900">
              {MOCK.retroCount}건
            </span>
          </div>
        </div>
      </div>

      <Switcher current={1} webPath="/dev/1-web" />
    </PhoneFrame>
  );
}
