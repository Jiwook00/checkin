import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ReactionGroup } from "../types";
import { DEFAULT_REACTION_EMOJIS } from "../types";

const EmojiPickerPopover = lazy(() => import("./EmojiPickerPopover"));

interface ReactionBarProps {
  groups: ReactionGroup[];
  onToggle: (emoji: string) => void;
  size?: "md" | "sm";
}

export default function ReactionBar({
  groups,
  onToggle,
  size = "md",
}: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);

  const chipH =
    size === "sm" ? "h-[26px] px-2 text-[13px]" : "h-[30px] px-2.5 text-sm";

  const pick = (emoji: string) => {
    onToggle(emoji);
    setPickerOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1.5">
      {groups.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => onToggle(g.emoji)}
          title={g.memberNames.join(", ")}
          className={`inline-flex items-center gap-1.5 rounded-full border leading-none transition-colors ${chipH} ${
            g.mine
              ? "border-ink bg-surface-card font-semibold text-ink"
              : "border-hairline bg-surface-soft text-body hover:bg-surface-card"
          }`}
        >
          <span>{g.emoji}</span>
          <span className="tabular-nums">{g.count}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="반응 추가"
        className={`inline-flex items-center justify-center rounded-full border border-hairline bg-canvas leading-none text-muted transition-colors hover:border-muted hover:text-ink ${chipH}`}
      >
        ＋
      </button>

      {pickerOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 flex w-[300px] flex-col gap-2">
          {/* 자주 쓰는 (원탭) */}
          <div className="rounded-[12px] border border-hairline bg-canvas p-2 shadow-lg">
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
              자주 쓰는
            </p>
            <div className="flex gap-1">
              {DEFAULT_REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => pick(e)}
                  className="h-9 flex-1 rounded-[8px] bg-surface-soft text-xl transition-colors hover:bg-surface-card"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* 전체 이모지 (검색) */}
          <Suspense
            fallback={
              <div className="rounded-[12px] border border-hairline bg-canvas p-4 text-xs text-muted-soft shadow-lg">
                불러오는 중…
              </div>
            }
          >
            <EmojiPickerPopover onSelect={pick} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
