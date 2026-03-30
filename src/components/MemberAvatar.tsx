import { useState } from "react";
import { memberColorClass } from "../lib/vote";

interface MemberAvatarProps {
  memberId: string;
  name: string;
  avatarUrl: string | null | undefined;
  size: number;
  ringClass?: string;
  colorOverride?: string;
}

export default function MemberAvatar({
  memberId,
  name,
  avatarUrl,
  size,
  ringClass = "",
  colorOverride,
}: MemberAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showImage = !!avatarUrl && !imgError && !colorOverride;
  const colorClass =
    colorOverride ?? `${memberColorClass(memberId)} text-white`;
  const fontSize =
    size <= 24 ? "text-[10px]" : size <= 36 ? "text-xs" : "text-sm";

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-bold overflow-hidden ${colorClass} ${ringClass}`}
      style={{ width: size, height: size }}
      title={name}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={fontSize}>{name[0]}</span>
      )}
    </div>
  );
}
