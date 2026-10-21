interface DegradedBannerProps {
  sourceUrl: string | null;
}

// 본문은 저장됐지만 추출 품질 판정에서 걸린 글(parse_status = degraded)의 안내
export default function DegradedBanner({ sourceUrl }: DegradedBannerProps) {
  return (
    <div className="mb-8 flex items-start gap-3 rounded-[12px] border border-hairline bg-surface-soft px-4 py-3.5">
      <span
        aria-hidden="true"
        className="mt-[7px] h-2 w-2 flex-none rounded-full bg-warning"
      />
      <div className="flex-1 text-sm leading-normal text-body">
        <strong className="mb-0.5 block font-semibold text-ink">
          본문을 완전히 가져오지 못했을 수 있어요
        </strong>
        빠진 부분이 있거나 다른 내용이 섞였을 수 있어요.
      </div>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none self-center whitespace-nowrap rounded-[8px] border border-hairline bg-canvas px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-card"
        >
          원본 보기 ↗
        </a>
      )}
    </div>
  );
}
