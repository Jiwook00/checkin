import type { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-200 flex items-start justify-center py-10">
      <div className="w-[390px] min-h-[844px] bg-white rounded-[40px] shadow-2xl overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}

const SWITCHER_OPTIONS = [
  { n: 1, label: "미니멀" },
  { n: 2, label: "배너형" },
  { n: 3, label: "설정형" },
];

export function Switcher({
  current,
  webPath,
}: {
  current: number;
  webPath?: string;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-1 bg-white/90 backdrop-blur-sm rounded-full shadow-lg px-2 py-1.5 border border-stone-200 z-50">
      {SWITCHER_OPTIONS.map(({ n, label }) => (
        <a
          key={n}
          href={`/dev/${n}`}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            current === n
              ? "bg-stone-900 text-white"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          {label}
        </a>
      ))}
      {webPath && (
        <a
          href={webPath}
          className="px-3 py-1 rounded-full text-xs font-medium text-stone-400 hover:text-stone-900 transition-colors border-l border-stone-200 ml-1 pl-3"
        >
          웹 보기
        </a>
      )}
    </div>
  );
}
