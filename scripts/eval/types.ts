// 평가셋(scripts/eval-dataset.ts)과 하네스(scripts/eval/)가 함께 쓰는 타입

export type CaseType = "callback" | "no_source" | "reference";

export interface EvalCase {
  id: string;
  type: CaseType;
  memberId: string;
  memberName: string;
  // 멤버가 이번에 쓰게 될 회고 회차 (N+1)
  session: string;
  // 콜백 대상이 되는 직전 회차 (N)
  prevSession: string;
  // 이 case에서 콜백이 들어가는 게 정답인가. 채점기는 type 대신 이 값만 본다
  expectCallback: boolean;
  reason?: "parse_failed" | "not_participated";
  source: {
    retroId: string;
    title: string;
    markdown: string;
    chars: number;
  } | null;
  // reference 전용: 실제로 발송한 메일 (참고 답안)
  reference?: ReferenceMail;
  // 같은 멤버·회차의 callback/no_source case id
  pairedWith?: string;
  // 발송한 메일이 이 case의 expectCallback과 어긋날 때 이유
  ruleDeviation?: string;
  // local/eval/dataset/case-notes.json에서 붙는 메모 (예: "empty_body" = 본문이 사실상 없는 글).
  // 해시 계산 뒤에 붙으므로 casesSha256에 들어가지 않는다. 단계의 입력으로 쓰지 말고 채점기만 본다
  notes?: string[];
}

// 메일의 큰 틀 5단계. 직전 회차 글이 없으면 callback은 null이다
export interface ReferenceMail {
  file: string;
  sections: {
    opening: string;
    callback: string | null;
    commonQuestion: string;
    notice: string;
    closing: string;
  };
  // 위 구간을 메일에 나온 순서대로 이은 본문 (preheader·푸터 제외)
  text: string;
}
