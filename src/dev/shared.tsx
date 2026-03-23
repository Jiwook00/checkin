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
