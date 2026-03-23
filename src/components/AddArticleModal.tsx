import Lottie from "lottie-react";
import { useEffect, useRef, useState } from "react";
import type { AddArticleForm } from "../types";
import diceShakeData from "./animations/dice-shake.json";

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

// Lottie 애니메이션 settled 프레임 SVG (좌=5, 우=3, 위=6 고정 — idle용)
function IsometricDice() {
  return (
    <svg
      viewBox="0 0 512 512"
      className="w-full h-full"
      style={{ backgroundColor: "rgb(255,255,255)" }}
    >
      <g transform="matrix(0.9765,0,0,0.9765,257.031,521.253)" opacity="0.15">
        <g transform="matrix(1,0,0,0.5,0,-49)">
          <g transform="matrix(0.7077,0.7065,-0.7065,0.7077,-1,-98)">
            <path
              fill="rgb(25,25,25)"
              d="M120,-70 C120,-70 120,70 120,70 C120,97.614 97.614,120 70,120 C70,120 -70,120 -70,120 C-97.614,120 -120,97.614 -120,70 C-120,70 -120,-70 -120,-70 C-120,-97.614 -97.614,-120 -70,-120 C-70,-120 70,-120 70,-120 C97.614,-120 120,-97.614 120,-70z"
            />
          </g>
        </g>
      </g>
      <g
        transform="matrix(1.0197,0.2506,-0.2506,1.0197,267.679,135.849)"
        opacity="1"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity="0"
          stroke="rgb(253,252,246)"
          strokeOpacity="1"
          strokeWidth="64"
          d="M-63.456,167.199 C-63.456,167.199 53.814,174.607 53.814,174.607 C53.814,174.607 -63.456,167.199 -63.456,167.199z"
        />
      </g>
      <g
        transform="matrix(1.0197,0.2506,-0.2506,1.0197,267.679,135.849)"
        opacity="1"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity="0"
          stroke="rgb(253,252,246)"
          strokeOpacity="1"
          strokeWidth="38"
          d="M63.067,285.581 C63.067,285.581 66.392,303.3 66.392,303.3 C66.392,303.3 63.067,285.581 63.067,285.581z"
        />
      </g>
      <g transform="matrix(1,0,0,1,256,256)">
        <path
          fill="rgb(212,209,193)"
          d="M103.079,158.744 C103.079,158.744 22.887,198.905 22.887,198.905 C11.076,204.82 1.514,197.888 1.514,183.411 C1.514,183.411 1.514,85.117 1.514,85.117 C1.514,70.64 11.076,54.131 22.887,48.216 C22.887,48.216 103.079,8.056 103.079,8.056 C114.89,2.141 124.451,9.072 124.451,23.549 C124.451,23.549 124.451,121.843 124.451,121.843 C124.451,136.32 114.89,152.829 103.079,158.744z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity="0"
          stroke="rgb(253,252,246)"
          strokeOpacity="1"
          strokeWidth="7"
          d="M103.079,158.744 C103.079,158.744 22.887,198.905 22.887,198.905 C11.076,204.82 1.514,197.888 1.514,183.411 C1.514,183.411 1.514,85.117 1.514,85.117 C1.514,70.64 11.076,54.131 22.887,48.216 C22.887,48.216 103.079,8.056 103.079,8.056 C114.89,2.141 124.451,9.072 124.451,23.549 C124.451,23.549 124.451,121.843 124.451,121.843 C124.451,136.32 114.89,152.829 103.079,158.744z"
        />
      </g>
      <g transform="matrix(1,0,0,1,256.5,256.5)">
        <path
          fill="rgb(25,25,25)"
          d="M33.159,138.123 C40.532,134.43 46.542,138.787 46.542,147.824 C46.542,156.861 40.532,167.184 33.159,170.877 C25.786,174.57 19.819,170.244 19.819,161.207 C19.819,152.17 25.786,141.816 33.159,138.123z"
        />
        <path
          fill="rgb(25,25,25)"
          d="M91.806,36.918 C99.179,33.225 105.146,37.551 105.146,46.588 C105.146,55.625 99.179,65.979 91.806,69.672 C84.433,73.365 78.424,69.008 78.424,59.971 C78.424,50.934 84.433,40.611 91.806,36.918z"
        />
        <path
          fill="rgb(25,25,25)"
          d="M62.651,87.668 C70.024,83.975 76.033,88.28 76.033,97.317 C76.033,106.354 70.024,116.729 62.651,120.422 C55.278,124.115 49.31,119.737 49.31,110.7 C49.31,101.663 55.278,91.361 62.651,87.668z"
        />
      </g>
      <g transform="matrix(1,0,0,1,256,256)">
        <path
          fill="rgb(236,233,217)"
          d="M-101.629,158.827 C-101.629,158.827 -21.307,198.923 -21.307,198.923 C-9.477,204.828 0.1,197.889 0.1,183.412 C0.1,183.412 0.1,85.118 0.1,85.118 C0.1,70.641 -9.477,54.139 -21.307,48.234 C-21.307,48.234 -101.629,8.138 -101.629,8.138 C-113.459,2.233 -123.036,9.172 -123.036,23.649 C-123.036,23.649 -123.036,121.943 -123.036,121.943 C-123.036,136.42 -113.459,152.922 -101.629,158.827z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity="0"
          stroke="rgb(253,252,246)"
          strokeOpacity="1"
          strokeWidth="7"
          d="M-101.629,158.827 C-101.629,158.827 -21.307,198.923 -21.307,198.923 C-9.477,204.828 0.1,197.889 0.1,183.412 C0.1,183.412 0.1,85.118 0.1,85.118 C0.1,70.641 -9.477,54.139 -21.307,48.234 C-21.307,48.234 -101.629,8.138 -101.629,8.138 C-113.459,2.233 -123.036,9.172 -123.036,23.649 C-123.036,23.649 -123.036,121.943 -123.036,121.943 C-123.036,136.42 -113.459,152.922 -101.629,158.827z"
        />
      </g>
      <g transform="matrix(1,0,0,1,256.5,256.5)">
        <path
          fill="rgb(25,25,25)"
          d="M-46.001,75.873 C-46.001,84.91 -39.982,95.28 -32.597,98.967 C-25.212,102.654 -19.235,98.271 -19.235,89.234 C-19.235,80.197 -25.212,69.899 -32.597,66.212 C-39.982,62.525 -46.001,66.836 -46.001,75.873z"
        />
        <path
          fill="rgb(25,25,25)"
          d="M-104.701,118.456 C-104.701,127.493 -98.724,137.791 -91.339,141.478 C-83.954,145.165 -77.935,140.854 -77.935,131.817 C-77.935,122.78 -83.954,112.41 -91.339,108.723 C-98.724,105.036 -104.701,109.419 -104.701,118.456z"
        />
        <path
          fill="rgb(25,25,25)"
          d="M-91.339,36.889 C-98.724,33.202 -104.701,37.533 -104.701,46.57 C-104.701,55.607 -98.724,65.957 -91.339,69.644 C-83.954,73.331 -77.935,68.969 -77.935,59.932 C-77.935,50.895 -83.954,40.576 -91.339,36.889z"
        />
        <path
          fill="rgb(25,25,25)"
          d="M-32.597,138.046 C-39.982,134.359 -46.001,138.721 -46.001,147.758 C-46.001,156.795 -39.982,167.114 -32.597,170.801 C-25.212,174.488 -19.235,170.157 -19.235,161.12 C-19.235,152.083 -25.212,141.733 -32.597,138.046z"
        />
        <path
          fill="rgb(25,25,25)"
          d="M-61.8,87.32 C-69.185,83.633 -75.162,88.016 -75.162,97.053 C-75.162,106.09 -69.185,116.388 -61.8,120.075 C-54.415,123.762 -48.396,119.451 -48.396,110.414 C-48.396,101.377 -54.415,91.007 -61.8,87.32z"
        />
      </g>
      <g transform="matrix(1,0,0,1,256,256)">
        <path
          fill="rgb(248,247,241)"
          d="M21.308,-53.43 C21.308,-53.43 101.63,-13.334 101.63,-13.334 C113.46,-7.429 113.475,2.141 101.664,8.056 C101.664,8.056 21.473,48.217 21.473,48.217 C9.662,54.132 -9.477,54.139 -21.307,48.234 C-21.307,48.234 -101.629,8.138 -101.629,8.138 C-113.459,2.233 -113.474,-7.337 -101.663,-13.252 C-101.663,-13.252 -21.472,-53.412 -21.472,-53.412 C-9.661,-59.327 9.478,-59.335 21.308,-53.43z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity="0"
          stroke="rgb(253,252,246)"
          strokeOpacity="1"
          strokeWidth="7"
          d="M21.308,-53.43 C21.308,-53.43 101.63,-13.334 101.63,-13.334 C113.46,-7.429 113.475,2.141 101.664,8.056 C101.664,8.056 21.473,48.217 21.473,48.217 C9.662,54.132 -9.477,54.139 -21.307,48.234 C-21.307,48.234 -101.629,8.138 -101.629,8.138 C-113.459,2.233 -113.474,-7.337 -101.663,-13.252 C-101.663,-13.252 -21.472,-53.412 -21.472,-53.412 C-9.661,-59.327 9.478,-59.335 21.308,-53.43z"
        />
      </g>
      {(
        [
          [202.5574, 237.1458],
          [261.5602, 209.6759],
          [229.6846, 253.1798],
          [290.2781, 224.6965],
          [258.966, 268.1624],
          [318.4685, 240.1925],
        ] as [number, number][]
      ).map(([tx, ty], i) => (
        <g
          key={i}
          transform={`matrix(0.6702,0.4058,-0.8116,0.3351,${tx},${ty})`}
        >
          <g transform="matrix(1,0,0,1,-64,30)">
            <g transform="matrix(1,0,0,1,83,-10.5)">
              <path
                fill="rgb(25,25,25)"
                d="M0,-18 C9.941,-18 18,-9.941 18,0 C18,9.941 9.941,18 0,18 C-9.941,18 -18,9.941 -18,0 C-18,-9.941 -9.941,-18 0,-18z"
              />
            </g>
          </g>
        </g>
      ))}
      <g transform="matrix(1,0,0,1,256,256)" opacity="0.25">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity="0"
          stroke="rgb(255,255,255)"
          strokeOpacity="1"
          strokeWidth="7"
          d="M98.847,51.461 C98.847,51.461 98.5,54.75 96.559,57.84"
        />
      </g>
    </svg>
  );
}

// 결과 표시용 플랫 면 (Lottie 색상 팔레트 적용)
function DiceFaceResult({ value }: { value: number }) {
  const dots = DOT_POSITIONS[value] ?? [];
  return (
    <svg
      viewBox="0 0 96 96"
      className="w-full h-full"
      style={{ backgroundColor: "rgb(255,255,255)" }}
    >
      <rect
        x="4"
        y="4"
        width="88"
        height="88"
        rx="18"
        ry="18"
        fill="rgb(248,247,241)"
        stroke="rgb(220,216,198)"
        strokeWidth="2"
      />
      {dots.map(([row, col]) => (
        <circle
          key={`${row}-${col}`}
          cx={16 + col * 32}
          cy={16 + row * 32}
          r="8"
          fill="rgb(25,25,25)"
        />
      ))}
    </svg>
  );
}

function LottieDie({
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
  const isClickable = !rolling && !rolled;
  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`w-24 h-24 rounded-2xl select-none overflow-hidden transition-all ${
        rolling
          ? "cursor-wait"
          : rolled
            ? ""
            : "cursor-pointer hover:scale-105 hover:shadow-md"
      }`}
    >
      {rolled ? (
        <DiceFaceResult value={value} />
      ) : rolling ? (
        <Lottie
          animationData={diceShakeData}
          loop={true}
          autoplay={true}
          style={{ width: 96, height: 96 }}
        />
      ) : (
        <IsometricDice />
      )}
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

    setTimeout(() => {
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
              <LottieDie
                value={diceValues[0]}
                rolling={diceRolling[0]}
                rolled={diceFinalValues[0] !== null}
                onClick={() => rollDie(0)}
              />
              <LottieDie
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
