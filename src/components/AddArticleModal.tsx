import { useEffect, useRef, useState } from "react";
import type { AddArticleForm } from "../types";

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    form: AddArticleForm,
    setStatus: (s: string) => void,
  ) => Promise<{ parseFailed: boolean; articleId: string }>;
  onSaveDiceScore: (articleId: string, score: number) => Promise<void>;
  defaultSession?: string;
}

function getCurrentSession(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 2],
    [2, 0],
  ],
  3: [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

function DiceFace({
  value,
  rolling,
  rolled,
  onClick,
}: {
  value: number;
  rolling: boolean;
  rolled: boolean;
  onClick?: () => void;
}) {
  const occupied = new Set(
    (DOT_POSITIONS[value] ?? []).map(([r, c]) => `${r},${c}`),
  );
  const isClickable = !rolling && !rolled;
  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`w-20 h-20 bg-white border-2 rounded-2xl shadow-sm p-2.5 grid grid-cols-3 grid-rows-3 gap-0.5 transition-all select-none ${
        rolling
          ? "animate-bounce border-gray-200 cursor-wait"
          : rolled
            ? "border-gray-200"
            : "border-gray-300 cursor-pointer hover:border-gray-500 hover:shadow-md hover:scale-105"
      }`}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        return (
          <div key={i} className="flex items-center justify-center">
            {occupied.has(`${row},${col}`) && (
              <div className="w-3 h-3 bg-gray-800 rounded-full" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AddArticleModal({
  isOpen,
  onClose,
  onSubmit,
  onSaveDiceScore,
  defaultSession,
}: AddArticleModalProps) {
  const sessionInit = defaultSession ?? getCurrentSession();
  const [form, setForm] = useState<AddArticleForm>({
    title: "",
    source_url: "",
    session: sessionInit,
  });
  const [status, setStatus] = useState("등록 중...");
  const [error, setError] = useState("");
  const [parseFailed, setParseFailed] = useState(false);

  // 게임 상태
  const [phase, setPhase] = useState<"form" | "game">("form");
  const [diceValues, setDiceValues] = useState<[number, number]>([1, 1]);
  const [diceRolling, setDiceRolling] = useState<[boolean, boolean]>([
    false,
    false,
  ]);
  const [diceFinalValues, setDiceFinalValues] = useState<
    [number | null, number | null]
  >([null, null]);
  const diceScore =
    diceFinalValues[0] !== null && diceFinalValues[1] !== null
      ? diceFinalValues[0] + diceFinalValues[1]
      : null;
  const [apiResult, setApiResult] = useState<{
    parseFailed: boolean;
    articleId: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  // 모달 재열기 시 이전 API 콜백 무효화용
  const generationRef = useRef(0);
  const saveInitiated = useRef(false);

  // 주사위 결과 + API 완료 → 저장 (hooks는 early return 전에 선언)
  useEffect(() => {
    if (
      !isOpen ||
      diceScore === null ||
      apiResult === null ||
      saveInitiated.current
    )
      return;
    saveInitiated.current = true;
    setSaving(true);

    onSaveDiceScore(apiResult.articleId, diceScore)
      .then(() => {
        if (apiResult.parseFailed) {
          setParseFailed(true);
          setPhase("form");
        } else {
          setSaving(false);
          setCompleted(true);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "저장에 실패했습니다");
        setPhase("form");
        setSaving(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, diceScore, apiResult]);

  if (!isOpen) return null;

  const resetGameState = () => {
    setDiceValues([1, 1]);
    setDiceRolling([false, false]);
    setDiceFinalValues([null, null]);
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
    setPhase("form");
    resetGameState();
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
    resetGameState();

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

  const rollDie = (index: 0 | 1) => {
    if (diceRolling[index] || diceFinalValues[index] !== null) return;

    setDiceRolling((prev) => {
      const next = [...prev] as [boolean, boolean];
      next[index] = true;
      return next;
    });

    const intervalId = setInterval(() => {
      setDiceValues((prev) => {
        const next = [...prev] as [number, number];
        next[index] = Math.ceil(Math.random() * 6) as 1 | 2 | 3 | 4 | 5 | 6;
        return next;
      });
    }, 80);

    setTimeout(() => {
      clearInterval(intervalId);
      const val = Math.ceil(Math.random() * 6);
      setDiceValues((prev) => {
        const next = [...prev] as [number, number];
        next[index] = val;
        return next;
      });
      setDiceFinalValues((prev) => {
        const next = [...prev] as [number | null, number | null];
        next[index] = val;
        return next;
      });
      setDiceRolling((prev) => {
        const next = [...prev] as [boolean, boolean];
        next[index] = false;
        return next;
      });
    }, 1500);
  };

  const bothRolled = diceFinalValues[0] !== null && diceFinalValues[1] !== null;
  const neitherRolled =
    diceFinalValues[0] === null && diceFinalValues[1] === null;

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

        {/* 파싱 실패 UI */}
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
        ) : phase === "game" ? (
          /* 주사위 게임 UI */
          <>
            <p className="text-center text-sm font-medium text-gray-600">
              기다리는 동안 발표 순서를 정해요
            </p>
            <p className="mb-5 text-center text-xs text-gray-400">
              주사위 합이 높을수록 먼저 발표해요
            </p>

            <div className="flex justify-center gap-5 mb-3">
              <DiceFace
                value={diceValues[0]}
                rolling={diceRolling[0]}
                rolled={diceFinalValues[0] !== null}
                onClick={() => rollDie(0)}
              />
              <DiceFace
                value={diceValues[1]}
                rolling={diceRolling[1]}
                rolled={diceFinalValues[1] !== null}
                onClick={() => rollDie(1)}
              />
            </div>

            {/* 힌트 텍스트 */}
            {!bothRolled && (
              <p className="mb-3 text-center text-xs text-gray-400">
                {neitherRolled
                  ? "주사위를 클릭해서 굴리세요"
                  : "나머지 주사위도 굴려주세요"}
              </p>
            )}

            {/* 합산 결과 */}
            {diceScore !== null && (
              <div className="mb-4 text-center">
                <p className="text-4xl font-bold text-gray-900">{diceScore}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {diceFinalValues[0]} + {diceFinalValues[1]}
                </p>
              </div>
            )}

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            {/* 하단 영역 */}
            {completed ? (
              <button
                onClick={handleClose}
                className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                확인
              </button>
            ) : (
              <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                <span className="inline-block h-3 w-3 flex-shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                <span className="text-xs text-gray-400">
                  {saving ? "저장 중..." : status}
                </span>
              </div>
            )}
          </>
        ) : (
          /* 글 등록 폼 */
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
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              등록
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
