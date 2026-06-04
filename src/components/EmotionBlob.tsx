import type {
  AvatarConfig,
  AvatarColor,
  AvatarShape,
  AvatarEyes,
  AvatarNose,
  AvatarMouth,
} from "../types";

interface EmotionBlobProps {
  avatar: AvatarConfig;
  size?: number;
  className?: string;
}

const COLOR_HEX: Record<AvatarColor, string> = {
  yellow: "#f5d061",
  orange: "#f4a44e",
  green: "#4cb878",
  blue: "#90b8d8",
  purple: "#b8a9d9",
  red: "#e8606b",
  gray: "#b5b5b5",
  navy: "#3b4e7a",
  pink: "#e8a0b8",
  teal: "#5bbfb5",
};

// navy처럼 어두운 배경에선 얼굴 요소를 밝게
const DARK_COLORS = new Set<AvatarColor>(["navy"]);

const SHAPE_PATH: Record<AvatarShape, string> = {
  round:
    "M26 4 C38 4 48 14 48 26 C48 38 38 48 26 48 C14 48 4 38 4 26 C4 14 14 4 26 4Z",
  blob1:
    "M26 4 C36 3 47 10 48 22 C49 34 42 47 28 48 C14 49 4 40 4 27 C4 14 16 5 26 4Z",
  blob2:
    "M25 4 C36 2 49 11 48 24 C47 37 38 50 24 48 C10 46 3 36 4 23 C5 10 14 6 25 4Z",
  blob3:
    "M28 4 C40 5 49 15 47 28 C45 41 34 50 21 47 C8 44 3 33 5 20 C7 7 16 3 28 4Z",
};

// 눈 위치: 왼쪽 lx,ly / 오른쪽 rx,ry
const LX = 18;
const RX = 34;
const EY = 22;

function Eyes({ type, ink }: { type: AvatarEyes; ink: string }) {
  switch (type) {
    case "dots":
      return (
        <>
          <circle cx={LX} cy={EY} r="2" fill={ink} />
          <circle cx={RX} cy={EY} r="2" fill={ink} />
        </>
      );
    case "happy":
      return (
        <>
          <path
            d={`M${LX - 3} ${EY + 1} Q${LX} ${EY - 2} ${LX + 3} ${EY + 1}`}
            fill="none"
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d={`M${RX - 3} ${EY + 1} Q${RX} ${EY - 2} ${RX + 3} ${EY + 1}`}
            fill="none"
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
    case "wink":
      return (
        <>
          {/* 왼쪽 윙크 */}
          <path
            d={`M${LX - 3} ${EY} Q${LX} ${EY + 3} ${LX + 3} ${EY}`}
            fill="none"
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* 오른쪽 일반 눈 */}
          <circle cx={RX} cy={EY} r="2" fill={ink} />
        </>
      );
    case "sad":
      return (
        <>
          <circle cx={LX} cy={EY} r="1.8" fill={ink} />
          <circle cx={RX} cy={EY} r="1.8" fill={ink} />
          {/* 처진 눈썹 효과: 안쪽이 올라간 선 */}
          <line
            x1={LX - 2}
            y1={EY - 4}
            x2={LX + 2}
            y2={EY - 2}
            stroke={ink}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1={RX - 2}
            y1={EY - 2}
            x2={RX + 2}
            y2={EY - 4}
            stroke={ink}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      );
    case "crying":
      return (
        <>
          <circle cx={LX} cy={EY} r="2" fill={ink} />
          <circle cx={RX} cy={EY} r="2" fill={ink} />
          {/* 눈물방울 */}
          <ellipse
            cx={LX}
            cy={EY + 6}
            rx="1.5"
            ry="2.5"
            fill="#6ea8cc"
            opacity="0.75"
          />
          <ellipse
            cx={RX}
            cy={EY + 6}
            rx="1.5"
            ry="2.5"
            fill="#6ea8cc"
            opacity="0.75"
          />
        </>
      );
    case "angry":
      return (
        <>
          {/* 화난 눈썹 */}
          <line
            x1={LX - 3}
            y1={EY - 3}
            x2={LX + 3}
            y2={EY - 1}
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1={RX - 3}
            y1={EY - 1}
            x2={RX + 3}
            y2={EY - 3}
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={LX} cy={EY + 1} r="2" fill={ink} />
          <circle cx={RX} cy={EY + 1} r="2" fill={ink} />
        </>
      );
  }
}

const NX = 26;
const NY = 30;

function Nose({ type, ink }: { type: AvatarNose; ink: string }) {
  switch (type) {
    case "none":
      return null;
    case "dot":
      return <circle cx={NX} cy={NY} r="1.2" fill={ink} opacity="0.5" />;
    case "dots":
      return (
        <>
          <circle cx={NX - 2} cy={NY} r="1" fill={ink} opacity="0.5" />
          <circle cx={NX + 2} cy={NY} r="1" fill={ink} opacity="0.5" />
        </>
      );
    case "circle":
      return (
        <circle
          cx={NX}
          cy={NY}
          r="2.5"
          fill="none"
          stroke={ink}
          strokeWidth="1.5"
          opacity="0.5"
        />
      );
  }
}

const MY = 38;

function Mouth({ type, ink }: { type: AvatarMouth; ink: string }) {
  switch (type) {
    case "smile":
      return (
        <path
          d={`M${26 - 6} ${MY - 1} Q26 ${MY + 4} ${26 + 6} ${MY - 1}`}
          fill="none"
          stroke={ink}
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    case "grin":
      return (
        <path
          d={`M${26 - 8} ${MY - 2} Q26 ${MY + 7} ${26 + 8} ${MY - 2}`}
          fill="none"
          stroke={ink}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      );
    case "flat":
      return (
        <line
          x1={26 - 6}
          y1={MY}
          x2={26 + 6}
          y2={MY}
          stroke={ink}
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    case "frown":
      return (
        <path
          d={`M${26 - 6} ${MY + 2} Q26 ${MY - 4} ${26 + 6} ${MY + 2}`}
          fill="none"
          stroke={ink}
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    case "wavy":
      return (
        <path
          d={`M${26 - 6} ${MY} Q${26 - 3} ${MY - 3} 26 ${MY} Q${26 + 3} ${MY + 3} ${26 + 6} ${MY}`}
          fill="none"
          stroke={ink}
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
  }
}

export default function EmotionBlob({
  avatar,
  size = 52,
  className,
}: EmotionBlobProps) {
  const fill = COLOR_HEX[avatar.color];
  const ink = DARK_COLORS.has(avatar.color) ? "#e8eaf6" : "#1a1a1a";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d={SHAPE_PATH[avatar.shape]} fill={fill} />
      <Eyes type={avatar.eyes} ink={ink} />
      <Nose type={avatar.nose} ink={ink} />
      <Mouth type={avatar.mouth} ink={ink} />
    </svg>
  );
}
