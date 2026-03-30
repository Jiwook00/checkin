import { PhoneFrame, Switcher } from "./shared";

const MOCK = {
  nickname: "Danny",
  email: "danny@example.com",
  retroCount: 12,
};

function Row({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 bg-white ${
        !last ? "border-b border-stone-100" : ""
      }`}
    >
      <span className="text-sm text-stone-700">{label}</span>
      <span className="text-sm text-stone-400">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium text-stone-400 px-4 pt-5 pb-1.5 uppercase tracking-widest">
      {children}
    </p>
  );
}

export default function Profile3() {
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

      <div className="bg-stone-50 min-h-full pb-28">
        {/* 아바타 + 이름 (상단 헤더 행) */}
        <div className="bg-white px-5 py-6 flex items-center gap-4 border-b border-stone-100">
          <button className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-xl font-semibold">
              {MOCK.nickname.charAt(0)}
            </div>
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-stone-900 flex items-center justify-center text-white text-[10px] ring-2 ring-white">
              ✎
            </span>
          </button>
          <div>
            <p className="font-bold text-stone-900 text-base">
              {MOCK.nickname}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">{MOCK.email}</p>
          </div>
        </div>

        {/* 내 정보 섹션 */}
        <SectionLabel>내 정보</SectionLabel>
        <div className="rounded-xl overflow-hidden mx-4 shadow-sm">
          <Row label="닉네임" value={MOCK.nickname} />
          <Row label="이메일" value={MOCK.email} last />
        </div>

        {/* 활동 섹션 */}
        <SectionLabel>활동</SectionLabel>
        <div className="rounded-xl overflow-hidden mx-4 shadow-sm">
          <Row label="회고 작성" value={`${MOCK.retroCount}건`} last />
        </div>
      </div>

      <Switcher current={3} />
    </PhoneFrame>
  );
}
