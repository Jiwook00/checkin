import { useState } from "react";
import type { AddArticleForm } from "../types";

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: AddArticleForm) => Promise<void>;
  defaultAuthor?: string;
  defaultSession?: string;
}

function getCurrentSession(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AddArticleModal({
  isOpen,
  onClose,
  onSubmit,
  defaultAuthor = "",
  defaultSession,
}: AddArticleModalProps) {
  const sessionInit = defaultSession ?? getCurrentSession();
  const [form, setForm] = useState<AddArticleForm>({
    title: "",
    author: defaultAuthor,
    source_url: "",
    session: sessionInit,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onSubmit(form);
      setForm({
        title: "",
        author: defaultAuthor,
        source_url: "",
        session: defaultSession ?? getCurrentSession(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">회고 글 추가</h2>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              링크 <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://notion.so/... 또는 https://xxx.tistory.com/..."
              value={form.source_url}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              제목{" "}
              <span className="text-xs text-gray-400">
                (비워두면 자동 추출)
              </span>
            </label>
            <input
              type="text"
              placeholder="회고 글 제목"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                작성자
              </label>
              <input
                type="text"
                readOnly
                value={form.author}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                회차 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="2026-02"
                value={form.session}
                onChange={(e) => setForm({ ...form, session: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "파싱 중..." : "등록"}
          </button>
        </form>
      </div>
    </div>
  );
}
