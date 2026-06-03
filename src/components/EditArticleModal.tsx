import { useState, useEffect } from "react";
import type { Retrospective } from "../types";

interface EditArticleModalProps {
  isOpen: boolean;
  article: Retrospective | null;
  onClose: () => void;
  onSubmit: (data: { title: string; session: string }) => Promise<void>;
}

export default function EditArticleModal({
  isOpen,
  article,
  onClose,
  onSubmit,
}: EditArticleModalProps) {
  const [title, setTitle] = useState("");
  const [session, setSession] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setSession(article.session);
    }
  }, [article]);

  if (!isOpen || !article) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit({ title, session });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[12px] bg-canvas p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">회고 글 수정</h2>
          <button
            onClick={onClose}
            className="text-muted transition-colors hover:text-body"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-body">
              제목 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[8px] border border-hairline px-3 py-2 text-sm focus:border-ink focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-body">
              회차 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="2026-02"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="w-full rounded-[8px] border border-hairline px-3 py-2 text-sm focus:border-ink focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-[8px] bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[8px] bg-primary py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </form>
      </div>
    </div>
  );
}
