import { useEffect, useMemo, useReducer, useState } from "react";
import {
  fetchLatestDrafts,
  fetchMembers,
  generateDraft,
  reviewDraft,
  type AdminMember,
  type ReviewInput,
} from "../../lib/reminder-drafts";
import type {
  ReminderDraft,
  Retrospective,
  SessionQuestions,
} from "../../types";
import GenerateStep, { type GenerateProgress } from "./GenerateStep";
import QuestionStep from "./QuestionStep";
import ReviewStep from "./ReviewStep";

const TABS = ["① 공통 질문", "② 초안 생성", "③ 검토"];
// 멤버를 동시에 몇 명씩 부를지. 호출당 5~10초라 2명이면 8명도 30초 안쪽이다
const CONCURRENCY = 2;

interface State {
  // 멤버별 가장 최근 초안
  drafts: ReminderDraft[];
  progress: Record<string, GenerateProgress>;
}

type Action =
  | { type: "loaded"; drafts: ReminderDraft[] }
  | { type: "start"; memberId: string }
  | { type: "done"; memberId: string; draft?: ReminderDraft }
  | { type: "failed"; memberId: string; message: string }
  | { type: "reviewed"; id: string; patch: Partial<ReminderDraft> };

// 하나의 액션이 초안 목록과 진행 상태를 함께 바꾸므로 reducer로 묶는다
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      return { drafts: action.drafts, progress: {} };
    case "start":
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.memberId]: { state: "running" },
        },
      };
    case "done":
      return {
        drafts: action.draft
          ? [
              action.draft,
              ...state.drafts.filter((d) => d.member_id !== action.memberId),
            ]
          : state.drafts,
        progress: { ...state.progress, [action.memberId]: { state: "done" } },
      };
    case "failed":
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.memberId]: { state: "error", message: action.message },
        },
      };
    case "reviewed":
      return {
        ...state,
        drafts: state.drafts.map((d) =>
          d.id === action.id ? { ...d, ...action.patch } : d,
        ),
      };
  }
}

function shiftSession(session: string, delta: number): string {
  const [y, m] = session.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface AdminRemindersPageProps {
  memberId: string;
  // App이 이미 가진 전역 데이터는 props로 받는다 (중복 fetch 금지)
  articles: Retrospective[];
  sessionQuestions: SessionQuestions;
  defaultSession: string;
  onQuestionApproved: (session: string, question: string) => void;
}

// /admin/reminders — ① 공통 질문 → ② 초안 생성 → ③ 검토. 접근 가드는 App의 라우트와 서버(RLS · Edge Function)가 각각 건다
export default function AdminRemindersPage({
  memberId,
  articles,
  sessionQuestions,
  defaultSession,
  onQuestionApproved,
}: AdminRemindersPageProps) {
  const [session, setSession] = useState(defaultSession);
  const [tab, setTab] = useState(0);
  const [members, setMembers] = useState<AdminMember[]>([]);
  // 초안을 불러온 회차. 현재 회차와 같을 때만 '불러옴'으로 본다 (effect 안에서 동기 setState를 피한다)
  const [loadedSession, setLoadedSession] = useState<string | null>(null);
  const [state, dispatch] = useReducer(reducer, { drafts: [], progress: {} });

  useEffect(() => {
    fetchMembers().then(setMembers);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchLatestDrafts(session).then((drafts) => {
      if (cancelled) return;
      dispatch({ type: "loaded", drafts });
      setLoadedSession(session);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // 파생값은 state로 두지 않고 렌더 때 계산한다
  const loaded = loadedSession === session;
  const writtenIds = useMemo(
    () =>
      new Set(
        articles.filter((a) => a.session === session).map((a) => a.member_id),
      ),
    [articles, session],
  );
  const draftByMember = useMemo(
    () => new Map(state.drafts.map((d) => [d.member_id, d])),
    [state.drafts],
  );
  const busy = Object.values(state.progress).some((p) => p.state === "running");
  const sessions = [
    shiftSession(defaultSession, 1),
    defaultSession,
    shiftSession(defaultSession, -1),
  ];

  const generate = async (ids: string[]) => {
    const queue = [...ids];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        dispatch({ type: "start", memberId: id });
        const res = await generateDraft(session, id);
        if (!res.ok) {
          dispatch({ type: "failed", memberId: id, message: res.message });
        } else {
          dispatch({
            type: "done",
            memberId: id,
            draft: res.data.kind === "draft" ? res.data.draft : undefined,
          });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
    );
  };

  const handleReview = async (
    draft: ReminderDraft,
    review: ReviewInput,
  ): Promise<string | null> => {
    const res = await reviewDraft(draft.id, review);
    if (!res.ok) return res.message;
    dispatch({ type: "reviewed", id: draft.id, patch: res.data });
    return null;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">리마인더</h1>
        <label className="flex items-center gap-2 text-sm text-muted">
          회고 회차
          <select
            value={session}
            disabled={busy}
            onChange={(e) => setSession(e.target.value)}
            className="rounded-[8px] border border-hairline bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-ink focus:outline-none disabled:text-muted-soft"
          >
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-6 flex gap-1 rounded-[8px] border border-hairline bg-canvas p-1">
        {TABS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i)}
            className={`flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold transition-colors ${
              tab === i
                ? "bg-primary text-on-primary"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <QuestionStep
          session={session}
          memberId={memberId}
          sessionQuestions={sessionQuestions}
          onApproved={onQuestionApproved}
        />
      )}

      {tab !== 0 && !loaded && (
        <p className="py-10 text-center text-sm text-muted">불러오는 중...</p>
      )}

      {tab === 1 && loaded && (
        <GenerateStep
          session={session}
          hasQuestion={Boolean(sessionQuestions[session])}
          members={members}
          writtenIds={writtenIds}
          draftByMember={draftByMember}
          progress={state.progress}
          busy={busy}
          onGenerate={generate}
        />
      )}

      {tab === 2 && loaded && (
        <ReviewStep
          members={members}
          writtenIds={writtenIds}
          draftByMember={draftByMember}
          progress={state.progress}
          onGenerate={generate}
          onReview={handleReview}
        />
      )}
    </div>
  );
}
