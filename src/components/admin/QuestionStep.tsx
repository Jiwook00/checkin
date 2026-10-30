import { useState, type ReactNode } from "react";
import {
  approveSessionQuestion,
  suggestQuestions,
  type QuestionSuggestion,
} from "../../lib/reminder-drafts";
import { QUESTION_BANK } from "../../lib/question-bank";
import type { SessionQuestions } from "../../types";

interface QuestionStepProps {
  session: string;
  memberId: string;
  sessionQuestions: SessionQuestions;
  onApproved: (session: string, question: string) => void;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium text-muted">{children}</p>;
}

// ① 공통 질문: 이미 쓴 질문 보기, 뱅크에서 고르기, 직접 입력, 선택적 LLM 제안, 승인
export default function QuestionStep({
  session,
  memberId,
  sessionQuestions,
  onApproved,
}: QuestionStepProps) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<QuestionSuggestion[] | null>(
    null,
  );
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = sessionQuestions[session];
  // 이미 쓴 질문(다른 회차)을 최근 순으로
  const used = Object.entries(sessionQuestions)
    .filter(([s]) => s !== session)
    .sort(([a], [b]) => b.localeCompare(a));

  const suggest = async () => {
    setSuggesting(true);
    setError(null);
    const res = await suggestQuestions(session);
    setSuggesting(false);
    if (res.ok) setSuggestions(res.data);
    else setError(res.message);
  };

  const approve = async () => {
    setSaving(true);
    setError(null);
    const res = await approveSessionQuestion(session, text, memberId);
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    onApproved(session, text.trim());
    setText("");
  };

  return (
    <section className="space-y-5 rounded-[12px] border border-hairline bg-canvas p-5">
      <h2 className="text-base font-semibold text-ink">이번 달 공통 질문</h2>

      {current && (
        <div className="rounded-[8px] border border-hairline bg-surface-soft px-3 py-2.5">
          <p className="text-xs font-medium text-muted">
            {session} 회차 · 승인됨
          </p>
          <p className="mt-0.5 text-sm font-medium text-ink">{current}</p>
          <p className="mt-1 text-xs text-muted-soft">
            다른 질문을 승인하면 바뀌어요. 멤버가 이미 본 질문일 수 있어요.
          </p>
        </div>
      )}

      {used.length > 0 && (
        <div>
          <Label>이미 쓴 질문</Label>
          <ul className="divide-y divide-hairline-soft rounded-[8px] border border-hairline">
            {used.map(([s, q]) => (
              <li key={s} className="flex gap-3 px-3 py-2 text-sm text-body">
                <span className="w-14 shrink-0 text-muted-soft">{s}</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Label>
          {current ? "다른 질문으로 바꾸기" : `${session} 회차 질문`}
        </Label>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="뱅크에서 고르거나 직접 입력해요"
            className="min-w-0 flex-1 rounded-[8px] border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted-soft focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={suggest}
            disabled={suggesting}
            className="shrink-0 rounded-[8px] border border-hairline px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-card disabled:text-muted-soft"
          >
            {suggesting ? "제안 중…" : "LLM 제안"}
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={!text.trim() || saving}
            className="shrink-0 rounded-[8px] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted-soft"
          >
            {saving ? "저장 중…" : "승인"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted-soft">
          승인하는 순간 글 등록 화면과 홈 배너에 보여요.
        </p>
        {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
      </div>

      <div>
        <Label>후보 뱅크</Label>
        <div className="flex flex-wrap gap-1.5">
          {QUESTION_BANK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setText(q)}
              className="rounded-full border border-hairline bg-canvas px-3 py-1 text-xs font-medium text-body hover:border-ink"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {suggestions && (
        <div>
          <Label>LLM 제안</Label>
          <ul className="space-y-1.5">
            {suggestions.map((s) => (
              <li key={s.question}>
                <button
                  type="button"
                  onClick={() => setText(s.question)}
                  className="w-full rounded-[8px] bg-surface-card px-3 py-2 text-left hover:bg-hairline-soft"
                >
                  <span className="block text-sm font-medium text-ink">
                    {s.question}
                  </span>
                  <span className="block text-xs text-muted">{s.reason}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
