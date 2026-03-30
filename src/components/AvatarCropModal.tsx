import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const OUTPUT_SIZE = 400;
const MAX_DISP_W = 320;
const MAX_DISP_H = 440;
const MIN_CROP_PX = 60;
const HANDLE = 32; // touch target size per corner

type Corner = "tl" | "tr" | "bl" | "br";

interface Crop {
  x: number;
  y: number;
  size: number;
}

function CornerBracket({ corner }: { corner: Corner }) {
  const thick = 3;
  const len = 16;
  const isRight = corner.includes("r");
  const isBottom = corner.includes("b");
  return (
    <div style={{ position: "relative", width: len, height: len }}>
      <div
        style={{
          position: "absolute",
          [isRight ? "right" : "left"]: 0,
          [isBottom ? "bottom" : "top"]: 0,
          width: len,
          height: thick,
          background: "white",
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          [isRight ? "right" : "left"]: 0,
          [isBottom ? "bottom" : "top"]: 0,
          width: thick,
          height: len,
          background: "white",
          borderRadius: 2,
        }}
      />
    </div>
  );
}

export default function AvatarCropModal({
  imageSrc,
  onConfirm,
  onCancel,
}: Props) {
  const [dispSize, setDispSize] = useState({ w: 0, h: 0 });
  const [displayScale, setDisplayScale] = useState(1);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, size: 0 });

  const cornerDrag = useRef<{
    corner: Corner;
    mx: number;
    my: number;
    crop: Crop;
  } | null>(null);
  const panDrag = useRef<{ mx: number; my: number; crop: Crop } | null>(null);

  // Track latest dispSize for use in move handlers without stale closure issues
  const dispSizeRef = useRef(dispSize);
  dispSizeRef.current = dispSize;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const s = Math.min(MAX_DISP_W / nw, MAX_DISP_H / nh, 1);
      const dw = nw * s;
      const dh = nh * s;
      setDisplayScale(s);
      setDispSize({ w: dw, h: dh });
      const initSize = Math.min(dw, dh) * 0.85;
      setCrop({
        x: (dw - initSize) / 2,
        y: (dh - initSize) / 2,
        size: initSize,
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const clamp = useCallback((c: Crop): Crop => {
    const { w: dw, h: dh } = dispSizeRef.current;
    const size = Math.max(MIN_CROP_PX, Math.min(c.size, dw, dh));
    const x = Math.max(0, Math.min(c.x, dw - size));
    const y = Math.max(0, Math.min(c.y, dh - size));
    return { x, y, size };
  }, []);

  const applyCornerMove = useCallback(
    (mx: number, my: number) => {
      if (!cornerDrag.current) return;
      const { corner, mx: smx, my: smy, crop: sc } = cornerDrag.current;
      const { w: dw, h: dh } = dispSizeRef.current;
      const dx = mx - smx;
      const dy = my - smy;

      let next = { ...sc };
      switch (corner) {
        case "br": {
          const d = Math.max(dx, dy);
          const maxSz = Math.min(dw - sc.x, dh - sc.y);
          next.size = Math.max(MIN_CROP_PX, Math.min(sc.size + d, maxSz));
          break;
        }
        case "tl": {
          const d = Math.max(-dx, -dy);
          const maxSz = Math.min(sc.x + sc.size, sc.y + sc.size);
          const newSz = Math.max(MIN_CROP_PX, Math.min(sc.size + d, maxSz));
          next = {
            x: sc.x + sc.size - newSz,
            y: sc.y + sc.size - newSz,
            size: newSz,
          };
          break;
        }
        case "tr": {
          const d = Math.max(dx, -dy);
          const maxSz = Math.min(dw - sc.x, sc.y + sc.size);
          const newSz = Math.max(MIN_CROP_PX, Math.min(sc.size + d, maxSz));
          next = { x: sc.x, y: sc.y + sc.size - newSz, size: newSz };
          break;
        }
        case "bl": {
          const d = Math.max(-dx, dy);
          const maxSz = Math.min(sc.x + sc.size, dh - sc.y);
          const newSz = Math.max(MIN_CROP_PX, Math.min(sc.size + d, maxSz));
          next = { x: sc.x + sc.size - newSz, y: sc.y, size: newSz };
          break;
        }
      }
      setCrop(clamp(next));
    },
    [clamp],
  );

  const applyPanMove = useCallback(
    (mx: number, my: number) => {
      if (!panDrag.current) return;
      const { mx: smx, my: smy, crop: sc } = panDrag.current;
      setCrop(clamp({ ...sc, x: sc.x + mx - smx, y: sc.y + my - smy }));
    },
    [clamp],
  );

  // Mouse
  const onMouseMove = (e: React.MouseEvent) => {
    applyCornerMove(e.clientX, e.clientY);
    applyPanMove(e.clientX, e.clientY);
  };
  const onMouseUp = () => {
    cornerDrag.current = null;
    panDrag.current = null;
  };

  // Touch
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    applyCornerMove(t.clientX, t.clientY);
    applyPanMove(t.clientX, t.clientY);
  };
  const onTouchEnd = () => {
    cornerDrag.current = null;
    panDrag.current = null;
  };

  const handleConfirm = () => {
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const sx = crop.x / displayScale;
      const sy = crop.y / displayScale;
      const sw = crop.size / displayScale;
      ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      canvas.toBlob(
        (blob) => {
          if (blob) onConfirm(blob);
        },
        "image/jpeg",
        0.92,
      );
    };
    img.src = imageSrc;
  };

  if (!dispSize.w) return null;

  const { x, y, size } = crop;
  const cursorMap: Record<Corner, string> = {
    tl: "nwse-resize",
    tr: "nesw-resize",
    bl: "nesw-resize",
    br: "nwse-resize",
  };
  const corners: Corner[] = ["tl", "tr", "bl", "br"];

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="bg-black rounded-2xl overflow-hidden w-full max-w-sm">
        <div className="px-5 pt-5 pb-3 text-center">
          <h2 className="text-base font-semibold text-white">
            프로필 사진 편집
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            모서리를 드래그해서 크기 조절, 안쪽을 드래그해서 위치 이동
          </p>
        </div>

        <div className="flex justify-center py-4 px-4">
          <div
            className="relative select-none"
            style={{
              width: dispSize.w,
              height: dispSize.h,
              touchAction: "none",
            }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Image */}
            <img
              src={imageSrc}
              draggable={false}
              style={{
                width: dispSize.w,
                height: dispSize.h,
                display: "block",
              }}
            />

            {/* Dark overlay — 4 pieces around the crop box */}
            <div
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: y,
                  background: "rgba(0,0,0,0.6)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: y + size,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.6)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: y,
                  left: 0,
                  width: x,
                  height: size,
                  background: "rgba(0,0,0,0.6)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: y,
                  left: x + size,
                  right: 0,
                  height: size,
                  background: "rgba(0,0,0,0.6)",
                }}
              />
            </div>

            {/* Crop box border + grid (pan handle) */}
            <div
              style={{
                position: "absolute",
                top: y,
                left: x,
                width: size,
                height: size,
                cursor: "move",
                boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,0.8)",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                panDrag.current = { mx: e.clientX, my: e.clientY, crop };
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                panDrag.current = { mx: t.clientX, my: t.clientY, crop };
              }}
            >
              {/* Rule-of-thirds grid */}
              {[33.33, 66.66].map((pct) => (
                <div
                  key={`h${pct}`}
                  style={{
                    position: "absolute",
                    top: `${pct}%`,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: "rgba(255,255,255,0.3)",
                    pointerEvents: "none",
                  }}
                />
              ))}
              {[33.33, 66.66].map((pct) => (
                <div
                  key={`v${pct}`}
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "rgba(255,255,255,0.3)",
                    pointerEvents: "none",
                  }}
                />
              ))}
            </div>

            {/* Corner handles */}
            {corners.map((corner) => {
              const cx = corner.includes("r") ? x + size : x;
              const cy = corner.includes("b") ? y + size : y;
              return (
                <div
                  key={corner}
                  style={{
                    position: "absolute",
                    top: cy - HANDLE / 2,
                    left: cx - HANDLE / 2,
                    width: HANDLE,
                    height: HANDLE,
                    cursor: cursorMap[corner],
                    zIndex: 10,
                    touchAction: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cornerDrag.current = {
                      corner,
                      mx: e.clientX,
                      my: e.clientY,
                      crop,
                    };
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const t = e.touches[0];
                    cornerDrag.current = {
                      corner,
                      mx: t.clientX,
                      my: t.clientY,
                      crop,
                    };
                  }}
                >
                  <CornerBracket corner={corner} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons — iOS 스타일 */}
        <div className="px-5 pb-5 flex justify-between items-center">
          <button
            className="text-sm font-medium text-stone-300 px-4 py-2 hover:text-white transition-colors"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="text-sm font-semibold text-yellow-400 px-4 py-2 hover:text-yellow-300 transition-colors"
            onClick={handleConfirm}
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
