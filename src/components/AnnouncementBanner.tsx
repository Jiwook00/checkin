import { useState } from "react";
import type { Announcement } from "../types";

interface Props {
  announcement: Announcement | null;
  onDeactivate: (id: string) => Promise<void>;
  onAdd: (content: string) => Promise<void>;
}

export default function AnnouncementBanner({
  announcement,
  onDeactivate,
  onAdd,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(text.trim());
      setText("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!announcement) return;
    await onDeactivate(announcement.id);
  }

  if (showForm) {
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="공지 내용을 입력하세요..."
          className="w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
          rows={2}
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => {
              setShowForm(false);
              setText("");
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-stone-500 hover:bg-amber-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            공지 등록
          </button>
        </div>
      </div>
    );
  }

  if (announcement) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <span className="mt-0.5 text-base">📣</span>
        <p className="flex-1 text-sm text-amber-900 leading-snug">
          {announcement.content}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {announcement.checkin_members && (
            <span className="text-xs text-amber-500">
              — {announcement.checkin_members.nickname}
            </span>
          )}
          <button
            onClick={handleDeactivate}
            className="text-amber-400 hover:text-amber-700 transition-colors text-sm leading-none"
            title="공지 해제"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
      >
        <span>📣</span>
        <span>공지 등록</span>
      </button>
    </div>
  );
}
