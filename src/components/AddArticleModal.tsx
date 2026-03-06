import { useState } from "react";
import type { AddArticleForm } from "../types";

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: AddArticleForm) => Promise<{ parseFailed: boolean }>;
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
  defaultSession,
}: AddArticleModalProps) {
  const sessionInit = defaultSession ?? getCurrentSession();
  const [form, setForm] = useState<AddArticleForm>({
    title: "",
    source_url: "",
    session: sessionInit,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parseFailed, setParseFailed] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setParseFailed(false);
    setError("");
    setForm({
      title: "",
      source_url: "",
      session: defaultSession ?? getCurrentSession(),
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await onSubmit(form);
      if (result.parseFailed) {
        setParseFailed(true);
      } else {
        handleClose();
      }
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
            onClick={handleClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        {parseFailed ? (
          <>
            <div className="mb-4 opacity-50 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  링크
                </label>
                <input
                  readOnly
                  value={form.source_url}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50"
                />
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-800">
                파싱 실패 · 링크만 저장됨
              </p>
              <p className="mt-0.5 text-xs text-amber-600">
                글 내용을 가져오지 못했지만, 링크는 저장되었어요. 회고
                페이지에서 원본 링크를 통해 읽을 수 있습니다.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              확인
            </button>
          </>
        ) : (
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
                onChange={(e) =>
                  setForm({ ...form, source_url: e.target.value })
                }
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
        )}
      </div>
    </div>
  );
}
