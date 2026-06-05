import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AddArticleForm, AvatarConfig } from "../types";
import EmotionPicker, { DEFAULT_AVATAR } from "./EmotionPicker";
import EmotionBlob from "./EmotionBlob";

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    form: AddArticleForm,
    setStatus: (s: string) => void,
  ) => Promise<{ parseFailed: boolean; articleId: string }>;
  onSaveAvatar: (articleId: string, avatar: AvatarConfig) => Promise<void>;
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
  onSaveAvatar,
  defaultSession,
}: AddArticleModalProps) {
  const navigate = useNavigate();
  const sessionInit = defaultSession ?? getCurrentSession();
  const [form, setForm] = useState<AddArticleForm>({
    title: "",
    source_url: "",
    session: sessionInit,
  });
  const [status, setStatus] = useState("등록 중...");
  const [error, setError] = useState("");
  const [parseFailed, setParseFailed] = useState(false);

  const [phase, setPhase] = useState<"choose" | "form" | "game">("choose");
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [apiResult, setApiResult] = useState<{
    parseFailed: boolean;
    articleId: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  const generationRef = useRef(0);
  const saveInitiated = useRef(false);

  useEffect(() => {
    if (!isOpen) setSaving(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmAvatar = async () => {
    if (!apiResult || saveInitiated.current) return;
    saveInitiated.current = true;
    setSaving(true);
    try {
      await onSaveAvatar(apiResult.articleId, avatar);
      if (apiResult.parseFailed) {
        setParseFailed(true);
        setPhase("form");
      } else {
        setCompleted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다");
      setPhase("form");
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setAvatar(DEFAULT_AVATAR);
    setApiResult(null);
    setSaving(false);
    setCompleted(false);
    setStatus("등록 중...");
    saveInitiated.current = false;
  };

  const handleClose = () => {
    generationRef.current++;
    setParseFailed(false);
    setError("");
    setPhase("choose");
    resetState();
    setForm({
      title: "",
      source_url: "",
      session: defaultSession ?? getCurrentSession(),
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPhase("game");
    resetState();

    const myGeneration = ++generationRef.current;
    onSubmit(form, setStatus)
      .then((result) => {
        if (generationRef.current === myGeneration) {
          setApiResult(result);
        }
      })
      .catch((err) => {
        if (generationRef.current === myGeneration) {
          setError(err instanceof Error ? err.message : "등록에 실패했습니다");
          setPhase("form");
        }
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[12px] bg-canvas p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">이번 달 나의 감정은?</h2>
          <button
            onClick={handleClose}
            className="text-muted transition-colors hover:text-body"
          >
            &times;
          </button>
        </div>

        {/* 방식 선택 */}
        {phase === "choose" ? (
          <div className="space-y-3">
            <button
              onClick={() => setPhase("form")}
              className="w-full rounded-[8px] border border-hairline bg-surface-card px-4 py-4 text-left transition-colors hover:border-ink hover:bg-surface-hover"
            >
              <p className="text-sm font-medium text-ink">링크로 등록</p>
              <p className="mt-0.5 text-xs text-muted">
                노션, 블로그 등 외부 URL을 붙여넣어 등록합니다
              </p>
            </button>
            <button
              onClick={() => {
                handleClose();
                navigate("/write");
              }}
              className="w-full rounded-[8px] border border-hairline bg-surface-card px-4 py-4 text-left transition-colors hover:border-ink hover:bg-surface-hover"
            >
              <p className="text-sm font-medium text-ink">직접 작성</p>
              <p className="mt-0.5 text-xs text-muted">
                에디터에서 바로 회고 글을 작성합니다
              </p>
            </button>
          </div>
        ) : parseFailed ? (
          /* 파싱 실패 */
          <>
            <div className="mb-4 opacity-50 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-body">
                  링크
                </label>
                <input
                  readOnly
                  value={form.source_url}
                  className="w-full rounded-[8px] border border-hairline px-3 py-2 text-sm bg-surface-card"
                />
              </div>
            </div>
            <div className="mb-4 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
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
              className="w-full rounded-[8px] bg-primary py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              확인
            </button>
          </>
        ) : phase === "game" ? (
          /* 감정 아바타 선택 */
          <>
            {/* 미리보기 고정 영역 */}
            <div className="flex flex-col items-center gap-2 pb-4 border-b border-hairline">
              <EmotionBlob avatar={avatar} size={72} />
              <p className="text-xs text-muted">
                {apiResult === null
                  ? "기다리는 동안 이번 달 기분을 꾸며봐요"
                  : "기다리는 동안 이번 달 기분을 꾸며봐요"}
              </p>
            </div>

            {/* 파츠 선택 — 스크롤 */}
            <div className="max-h-[300px] overflow-y-auto pt-3">
              <EmotionPicker value={avatar} onChange={setAvatar} />
            </div>

            {error && (
              <p className="mt-3 rounded-[8px] bg-error/10 px-3 py-2 text-sm text-error">
                {error}
              </p>
            )}

            <div className="mt-4">
              {completed ? (
                <button
                  onClick={handleClose}
                  className="w-full rounded-[8px] bg-primary py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
                >
                  확인
                </button>
              ) : apiResult === null ? (
                /* API 처리 중 — 완료 버튼 비활성 */
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 text-xs text-muted">
                    <span className="inline-block h-3 w-3 flex-shrink-0 animate-spin rounded-full border-2 border-hairline border-t-ink" />
                    {status}
                  </div>
                  <button
                    disabled
                    className="rounded-[8px] bg-primary px-5 py-2 text-sm font-medium text-on-primary opacity-40 cursor-not-allowed"
                  >
                    완료
                  </button>
                </div>
              ) : (
                /* API 완료 — 수동 확인 */
                <button
                  onClick={handleConfirmAvatar}
                  disabled={saving}
                  className="w-full rounded-[8px] bg-primary py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "완료"}
                </button>
              )}
            </div>
          </>
        ) : (
          /* 글 등록 폼 */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-body">
                링크 <span className="text-error">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://notion.so/... 또는 https://xxx.tistory.com/..."
                value={form.source_url}
                onChange={(e) =>
                  setForm({ ...form, source_url: e.target.value })
                }
                className="w-full rounded-[8px] border border-hairline px-3 py-2 text-sm focus:border-ink focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-body">
                제목{" "}
                <span className="text-xs text-muted">(비워두면 자동 추출)</span>
              </label>
              <input
                type="text"
                placeholder="회고 글 제목"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                value={form.session}
                onChange={(e) => setForm({ ...form, session: e.target.value })}
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
              className="w-full rounded-[8px] bg-primary py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              등록
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
