import type { AdminMember } from "../../lib/reminder-drafts";
import type { ReminderDraft } from "../../types";
import { DraftStatusBadge, RuleFailBadge } from "./DraftCard";

export type GenerateProgress =
  | { state: "running" }
  | { state: "done" }
  | { state: "error"; message: string };

interface GenerateStepProps {
  session: string;
  hasQuestion: boolean;
  members: AdminMember[];
  writtenIds: Set<string>;
  draftByMember: Map<string, ReminderDraft>;
  progress: Record<string, GenerateProgress>;
  busy: boolean;
  onGenerate: (memberIds: string[]) => void;
}

// ② 초안 생성: 아직 초안이 없는 대상 멤버를 멤버별로 따로 불러 만든다 (한 명이 실패해도 나머지는 남는다)
export default function GenerateStep({
  session,
  hasQuestion,
  members,
  writtenIds,
  draftByMember,
  progress,
  busy,
  onGenerate,
}: GenerateStepProps) {
  const targets = members.filter((m) => !writtenIds.has(m.id));
  const pending = targets.filter((m) => !draftByMember.has(m.id));
  const done = targets.length - pending.length;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">초안 생성</h2>
          <button
            type="button"
            disabled={!hasQuestion || busy || pending.length === 0}
            onClick={() => onGenerate(pending.map((m) => m.id))}
            className="shrink-0 rounded-[8px] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted-soft"
          >
            {busy
              ? "생성 중…"
              : pending.length === targets.length
                ? "초안 생성"
                : `남은 ${pending.length}명 생성`}
          </button>
        </div>

        {!hasQuestion && (
          <p className="rounded-[8px] bg-warning/10 px-3 py-2 text-sm text-warning">
            {session} 회차에 승인된 공통 질문이 없어요. ① 단계에서 먼저 승인해
            주세요.
          </p>
        )}

        <p className="text-sm text-body">
          대상 {targets.length}명 중 {done}명 생성됨 · 이미 쓴 멤버{" "}
          {members.length - targets.length}명 제외
        </p>
        <div className="flex gap-1">
          {targets.map((m) => (
            <div
              key={m.id}
              className={`h-1.5 flex-1 rounded-full ${
                draftByMember.has(m.id) ? "bg-primary" : "bg-surface-strong"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-soft">
          멤버마다 따로 불러서 한 명이 실패해도 나머지는 그대로 남아요. 다시
          생성하면 새 초안이 쌓이고 화면에는 가장 최근 것이 보여요.
        </p>
      </section>

      <section className="rounded-[12px] border border-hairline bg-canvas p-5">
        <h2 className="mb-3 text-base font-semibold text-ink">멤버별 상태</h2>
        <ul className="divide-y divide-hairline-soft">
          {members.map((m) => {
            const draft = draftByMember.get(m.id);
            const p = progress[m.id];
            return (
              <li key={m.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">
                    {m.nickname}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {writtenIds.has(m.id) ? (
                      <span className="rounded-full bg-surface-card px-2 py-0.5 text-xs font-medium text-muted-soft">
                        이미 씀
                      </span>
                    ) : p?.state === "running" ? (
                      <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-xs font-medium text-brand-accent">
                        생성 중…
                      </span>
                    ) : draft ? (
                      <>
                        <RuleFailBadge draft={draft} />
                        <DraftStatusBadge draft={draft} />
                      </>
                    ) : (
                      <span className="rounded-full border border-hairline px-2 py-0.5 text-xs font-medium text-muted">
                        생성 전
                      </span>
                    )}
                  </span>
                </div>
                {p?.state === "error" && (
                  <p className="mt-1 text-xs text-error">
                    실패: {p.message} (다시 생성하면 이어서 해요)
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
