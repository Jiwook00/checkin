interface SessionQuestionCardProps {
  question?: string;
  // banner: 홈 배너 안, form: 글 등록·작성 화면
  place: "banner" | "form";
}

// 이번 달 공통 질문 안내. 질문이 없는 회차에서는 아무것도 그리지 않고, 글 쓰기를 막지도 않는다
export default function SessionQuestionCard({
  question,
  place,
}: SessionQuestionCardProps) {
  if (!question) return null;

  if (place === "banner") {
    return (
      <div className="mt-3 rounded-[8px] bg-surface-card px-3 py-2">
        <p className="text-xs font-medium text-muted">이번 달 공통 질문</p>
        <p className="mt-0.5 text-sm font-medium text-ink">{question}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[8px] border border-hairline bg-surface-soft px-3 py-2.5">
      <p className="text-xs font-medium text-muted">이번 달 공통 질문</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{question}</p>
      <p className="mt-1 text-xs text-muted-soft">
        회고와 함께, 또는 이 질문에 한 줄만 남겨도 괜찮아요
      </p>
    </div>
  );
}
