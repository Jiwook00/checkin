// 리마인더 생성 코어가 하네스와 Edge Function에 함께 내보내는 공용 타입 (#79)

// value는 0~1. LLM 채점기는 reason을 반드시 남긴다
// weight가 있으면 summary가 가중 평균(scoresWeighted)도 낸다 (예: 근거 통과율을 case가 아니라 항목 기준으로 볼 때)
export interface Score {
  value: number;
  reason?: string;
  weight?: number;
}
