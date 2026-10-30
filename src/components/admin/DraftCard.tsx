import { useState, type ReactNode } from "react";
import type { ReminderDraft, ReminderDraftStatus } from "../../types";
import type { ReviewInput } from "../../lib/reminder-drafts";

const STATUS_LABEL: Record<ReminderDraftStatus, string> = {
  draft: "검토 전",
  approved: "승인",
  edited: "수정 승인",
  rejected: "반려",
};

const STATUS_STYLE: Record<ReminderDraftStatus, string> = {
  draft: "bg-surface-card text-muted",
  approved: "bg-success/10 text-success",
  edited: "bg-brand-accent/10 text-brand-accent",
  rejected: "bg-error/10 text-error",
};

const RULE_LABEL: Record<string, string> = {
  json: "형식",
  callback_match: "콜백·재료 일치",
  form: "구간 형식",
  voice: "말끝",
  banned: "금지 표현",
};

const SOURCE_LABEL: Record<ReminderDraft["input"]["source"]["state"], string> =
  {
    normal: "직전 회고 정상",
    ambiguous: "직전 회고 모호 (짧거나 일부만 읽힘)",
    failed: "직전 회고 본문 없음",
    none: "직전 회차 글 없음",
  };

function failedRules(draft: ReminderDraft) {
  return Object.entries(draft.rule_scores).filter(([, s]) => s.value < 1);
}

export function DraftStatusBadge({ draft }: { draft: ReminderDraft }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[draft.status]}`}
    >
      {STATUS_LABEL[draft.status]}
    </span>
  );
}

export function RuleFailBadge({ draft }: { draft: ReminderDraft }) {
  const failed = failedRules(draft).length;
  if (failed === 0) return null;
  return (
    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
      규칙 {failed}건 걸림
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium text-muted">{children}</p>;
}

function MailPreview({ draft }: { draft: ReminderDraft }) {
  const [copied, setCopied] = useState(false);
  const text = draft.edited_mail ?? draft.mail ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없으면 텍스트를 직접 선택해서 복사한다
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium text-muted">
          {draft.edited_mail ? "메일 (수정본)" : "메일"}
        </p>
        <button
          type="button"
          onClick={copy}
          disabled={!text}
          className="rounded-[8px] border border-hairline px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-card disabled:text-muted-soft"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      {text ? (
        <pre className="whitespace-pre-wrap rounded-[8px] border border-hairline bg-canvas p-3 font-sans text-sm leading-relaxed text-ink">
          {text}
        </pre>
      ) : (
        <p className="rounded-[8px] bg-surface-card px-3 py-2 text-sm text-error">
          모델 응답을 읽지 못해 메일이 만들어지지 않았어요. 다시 생성해 주세요.
        </p>
      )}
    </div>
  );
}

function Materials({ draft }: { draft: ReminderDraft }) {
  const { materials, dropped, source } = draft.input;
  const picked = draft.output?.result?.callbackItem ?? 0;
  return (
    <div>
      <Label>
        {SOURCE_LABEL[source.state]}
        {dropped > 0 && ` · 근거 검증 탈락 ${dropped}개`}
      </Label>
      {materials.length === 0 ? (
        <p className="rounded-[8px] bg-surface-card px-3 py-2 text-sm text-muted">
          고른 재료 없음 — 콜백 없이 생성
        </p>
      ) : (
        <ul className="space-y-1.5">
          {materials.map((m, i) => (
            <li
              key={m.evidence}
              className={`rounded-[8px] px-3 py-2 text-sm ${
                picked === i + 1
                  ? "border border-ink bg-canvas text-ink"
                  : "bg-surface-card text-muted"
              }`}
            >
              <span className="mr-1.5 text-xs font-semibold uppercase text-muted-soft">
                {m.kind}
                {picked === i + 1 && " · 고름"}
              </span>
              “{m.evidence}”
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Rules({ draft }: { draft: ReminderDraft }) {
  const entries = Object.entries(draft.rule_scores);
  return (
    <div>
      <Label>규칙 채점</Label>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([key, s]) => (
          <span
            key={key}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              s.value >= 1
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            }`}
          >
            {s.value >= 1 ? "✓" : "✕"} {RULE_LABEL[key] ?? key}
          </span>
        ))}
      </div>
      {failedRules(draft).map(([key, s]) => (
        <p key={key} className="mt-1.5 text-xs text-error">
          {RULE_LABEL[key] ?? key}: {s.reason}
        </p>
      ))}
    </div>
  );
}

function Meta({ draft }: { draft: ReminderDraft }) {
  return (
    <p className="text-xs text-muted-soft">
      {draft.model} · 프롬프트 {draft.prompt_sha256.slice(0, 8)} · 토큰{" "}
      {draft.tokens_in.toLocaleString()} / {draft.tokens_out.toLocaleString()} ·{" "}
      {(draft.latency_ms / 1000).toFixed(1)}초
    </p>
  );
}

function ReviewActions({
  draft,
  onReview,
}: {
  draft: ReminderDraft;
  onReview: (review: ReviewInput) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "reject">("idle");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = draft.edited_mail ?? draft.mail ?? "";

  const submit = async (review: ReviewInput) => {
    setBusy(true);
    setError(null);
    const message = await onReview(review);
    setBusy(false);
    if (message) setError(message);
    else setMode("idle");
  };

  const open = (next: "edit" | "reject") => {
    setText(current);
    setNote("");
    setError(null);
    setMode(next);
  };

  if (draft.status !== "draft") {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {draft.review_note ? `사유: ${draft.review_note}` : "검토 완료"}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit({ status: "draft" })}
          className="shrink-0 rounded-[8px] border border-hairline px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-card disabled:text-muted-soft"
        >
          다시 검토
        </button>
      </div>
    );
  }

  if (mode !== "idle") {
    const isEdit = mode === "edit";
    const canSubmit = isEdit
      ? text.trim().length > 0 && text !== current
      : note.trim().length > 0;
    return (
      <div className="space-y-2">
        {isEdit ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="w-full rounded-[8px] border border-hairline bg-canvas p-3 text-sm text-ink focus:border-ink focus:outline-none"
          />
        ) : null}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isEdit
              ? "무엇을 왜 고쳤는지 (선택, 나중에 평가 데이터가 돼요)"
              : "반려 사유 (필수, 나중에 평가 데이터가 돼요)"
          }
          className="w-full rounded-[8px] border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted-soft focus:border-ink focus:outline-none"
        />
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="rounded-[8px] px-3 py-2 text-sm font-semibold text-muted hover:text-ink"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={() =>
              submit(
                isEdit
                  ? { status: "edited", editedMail: text, note }
                  : { status: "rejected", note },
              )
            }
            className="rounded-[8px] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted-soft"
          >
            {isEdit ? "수정 승인" : "반려"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-right text-xs text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => open("reject")}
          className="rounded-[8px] border border-hairline px-3 py-2 text-sm font-semibold text-error hover:bg-surface-card"
        >
          반려
        </button>
        <button
          type="button"
          onClick={() => open("edit")}
          disabled={!current}
          className="rounded-[8px] border border-hairline px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-card disabled:text-muted-soft"
        >
          수정
        </button>
        <button
          type="button"
          disabled={busy || !draft.mail}
          onClick={() => submit({ status: "approved" })}
          className="rounded-[8px] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted-soft"
        >
          승인
        </button>
      </div>
    </div>
  );
}

interface DraftCardProps {
  nickname: string;
  draft?: ReminderDraft;
  // 이번 회차에 이미 쓴 멤버. 리마인더를 만들지 않는다
  written: boolean;
  generating: boolean;
  onGenerate: () => void;
  // 실패하면 사유 문자열을 돌려준다
  onReview: (
    draft: ReminderDraft,
    review: ReviewInput,
  ) => Promise<string | null>;
}

export default function DraftCard({
  nickname,
  draft,
  written,
  generating,
  onGenerate,
  onReview,
}: DraftCardProps) {
  return (
    <section className="rounded-[12px] border border-hairline bg-canvas p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{nickname}</h3>
          {written ? (
            <span className="rounded-full bg-surface-card px-2 py-0.5 text-xs font-medium text-muted-soft">
              이미 씀
            </span>
          ) : draft ? (
            <>
              <DraftStatusBadge draft={draft} />
              <RuleFailBadge draft={draft} />
            </>
          ) : (
            <span className="rounded-full border border-hairline px-2 py-0.5 text-xs font-medium text-muted">
              생성 전
            </span>
          )}
        </div>
        {!written && (
          <button
            type="button"
            disabled={generating}
            onClick={onGenerate}
            className="shrink-0 rounded-[8px] border border-hairline px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-card disabled:text-muted-soft"
          >
            {generating ? "생성 중…" : draft ? "다시 생성" : "생성"}
          </button>
        )}
      </div>

      {written ? (
        <p className="rounded-[8px] bg-surface-card px-3 py-2.5 text-sm text-muted">
          이번 회차 회고를 이미 써서 리마인더를 만들지 않아요.
        </p>
      ) : !draft ? (
        <p className="rounded-[8px] bg-surface-card px-3 py-2.5 text-sm text-muted">
          아직 초안이 없어요.
        </p>
      ) : (
        <div className="space-y-4">
          <MailPreview draft={draft} />
          <Materials draft={draft} />
          <Rules draft={draft} />
          <Meta draft={draft} />
          <div className="border-t border-hairline-soft pt-3">
            <ReviewActions
              key={draft.id + draft.status}
              draft={draft}
              onReview={(review) => onReview(draft, review)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
