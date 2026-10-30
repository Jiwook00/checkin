import { useState } from "react";
import type { AdminMember, ReviewInput } from "../../lib/reminder-drafts";
import type { ReminderDraft } from "../../types";
import DraftCard from "./DraftCard";
import type { GenerateProgress } from "./GenerateStep";

const FILTERS = ["전체", "검토 전", "승인", "반려"] as const;
type Filter = (typeof FILTERS)[number];

function matches(filter: Filter, draft?: ReminderDraft): boolean {
  if (filter === "전체") return true;
  if (!draft) return false;
  if (filter === "검토 전") return draft.status === "draft";
  if (filter === "승인")
    return draft.status === "approved" || draft.status === "edited";
  return draft.status === "rejected";
}

interface ReviewStepProps {
  members: AdminMember[];
  writtenIds: Set<string>;
  draftByMember: Map<string, ReminderDraft>;
  progress: Record<string, GenerateProgress>;
  onGenerate: (memberIds: string[]) => void;
  onReview: (
    draft: ReminderDraft,
    review: ReviewInput,
  ) => Promise<string | null>;
}

// ③ 검토: 멤버별 카드에서 메일 · 고른 재료 · 규칙 채점을 보고 승인 / 수정 / 반려 후 복사한다
export default function ReviewStep({
  members,
  writtenIds,
  draftByMember,
  progress,
  onGenerate,
  onReview,
}: ReviewStepProps) {
  const [filter, setFilter] = useState<Filter>("전체");

  // 이미 쓴 멤버는 '전체'에서만 보인다 (검토할 초안이 없다)
  const shown = members.filter((m) =>
    filter === "전체"
      ? true
      : !writtenIds.has(m.id) && matches(filter, draftByMember.get(m.id)),
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f
                ? "bg-primary text-on-primary"
                : "border border-hairline bg-canvas text-muted hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="py-10 text-center text-sm text-muted">
          이 조건에 맞는 멤버가 없어요.
        </p>
      )}
      {shown.map((m) => (
        <DraftCard
          key={m.id}
          nickname={m.nickname}
          draft={draftByMember.get(m.id)}
          written={writtenIds.has(m.id)}
          generating={progress[m.id]?.state === "running"}
          onGenerate={() => onGenerate([m.id])}
          onReview={onReview}
        />
      ))}
    </div>
  );
}
