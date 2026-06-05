import type {
  AvatarConfig,
  AvatarColor,
  AvatarShape,
  AvatarEyes,
  AvatarNose,
  AvatarMouth,
} from "../types";
import EmotionBlob from "./EmotionBlob";

interface EmotionPickerProps {
  value: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
}

const COLORS: { value: AvatarColor; hex: string; label: string }[] = [
  { value: "yellow", hex: "#f5d061", label: "노랑" },
  { value: "orange", hex: "#f4a44e", label: "주황" },
  { value: "green", hex: "#4cb878", label: "초록" },
  { value: "teal", hex: "#5bbfb5", label: "민트" },
  { value: "blue", hex: "#90b8d8", label: "파랑" },
  { value: "navy", hex: "#3b4e7a", label: "남색" },
  { value: "purple", hex: "#b8a9d9", label: "보라" },
  { value: "pink", hex: "#e8a0b8", label: "분홍" },
  { value: "red", hex: "#e8606b", label: "빨강" },
  { value: "gray", hex: "#b5b5b5", label: "회색" },
];

const SHAPES: { value: AvatarShape; label: string }[] = [
  { value: "round", label: "동글" },
  { value: "blob1", label: "울퉁1" },
  { value: "blob2", label: "울퉁2" },
  { value: "blob3", label: "울퉁3" },
];

const EYES_OPTIONS: { value: AvatarEyes; label: string }[] = [
  { value: "dots", label: "동그란" },
  { value: "happy", label: "초승달" },
  { value: "wink", label: "윙크" },
  { value: "sad", label: "슬픈" },
  { value: "crying", label: "눈물" },
  { value: "angry", label: "화난" },
  { value: "sparkle", label: "반짝" },
  { value: "cross", label: "X눈" },
  { value: "heart", label: "속눈썹" },
  { value: "round", label: "왕눈" },
  { value: "closed", label: "단정" },
  { value: "stripe", label: "띠" },
  { value: "bigdot", label: "통통" },
  { value: "slash", label: "빗금" },
  { value: "swirl", label: "방울" },
  { value: "arch", label: "아치" },
];

const NOSE_OPTIONS: { value: AvatarNose; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "dot", label: "점" },
  { value: "dots", label: "두점" },
  { value: "circle", label: "동그라미" },
  { value: "hook", label: "훅" },
];

const MOUTH_OPTIONS: { value: AvatarMouth; label: string }[] = [
  { value: "smile", label: "미소" },
  { value: "grin", label: "활짝" },
  { value: "flat", label: "일자" },
  { value: "frown", label: "찡그림" },
  { value: "wavy", label: "물결" },
  { value: "teeth", label: "이빨" },
  { value: "open", label: "동그란" },
  { value: "fang", label: "송곳니" },
  { value: "squiggle", label: "지그재그" },
  { value: "bigteeth", label: "크게" },
  { value: "onetooth", label: "이빨2" },
  { value: "spiky", label: "뾰족" },
  { value: "egg", label: "타원" },
  { value: "swoosh", label: "씩" },
  { value: "arc", label: "호" },
  { value: "ring", label: "링" },
  { value: "ahh", label: "아" },
  { value: "laugh", label: "폭소" },
  { value: "pout", label: "포" },
  { value: "curl", label: "컬" },
];

function OptionButton({
  selected,
  onClick,
  children,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex items-center justify-center rounded-[8px] border transition-all ${
        selected
          ? "border-ink bg-surface-strong"
          : "border-hairline bg-surface-card hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}

// 파츠 미리보기용 — 중립 배경에 해당 파츠만 표시
function PartPreview({
  config,
  size = 36,
}: {
  config: AvatarConfig;
  size?: number;
}) {
  return <EmotionBlob avatar={config} size={size} />;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  color: "yellow",
  shape: "blob1",
  eyes: "dots",
  nose: "none",
  mouth: "smile",
};

export default function EmotionPicker({ value, onChange }: EmotionPickerProps) {
  const set = <K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="space-y-4">
      {/* 색상 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted">색상</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(({ value: v, hex, label }) => (
            <button
              key={v}
              type="button"
              title={label}
              onClick={() => set("color", v)}
              className={`h-7 w-7 rounded-full border-2 transition-all ${
                value.color === v
                  ? "border-ink scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      {/* 모양 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted">모양</p>
        <div className="flex gap-2">
          {SHAPES.map(({ value: v, label }) => (
            <OptionButton
              key={v}
              selected={value.shape === v}
              onClick={() => set("shape", v)}
              label={label}
            >
              <PartPreview config={{ ...value, shape: v }} size={36} />
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 눈 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted">눈</p>
        <div className="flex flex-wrap gap-2">
          {EYES_OPTIONS.map(({ value: v, label }) => (
            <OptionButton
              key={v}
              selected={value.eyes === v}
              onClick={() => set("eyes", v)}
              label={label}
            >
              <PartPreview config={{ ...value, eyes: v }} size={36} />
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 코 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted">코</p>
        <div className="flex gap-2">
          {NOSE_OPTIONS.map(({ value: v, label }) => (
            <OptionButton
              key={v}
              selected={value.nose === v}
              onClick={() => set("nose", v)}
              label={label}
            >
              <PartPreview config={{ ...value, nose: v }} size={36} />
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 입 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted">입</p>
        <div className="flex flex-wrap gap-2">
          {MOUTH_OPTIONS.map(({ value: v, label }) => (
            <OptionButton
              key={v}
              selected={value.mouth === v}
              onClick={() => set("mouth", v)}
              label={label}
            >
              <PartPreview config={{ ...value, mouth: v }} size={36} />
            </OptionButton>
          ))}
        </div>
      </div>
    </div>
  );
}
