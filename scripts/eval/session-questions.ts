// 공통 질문 스냅샷 (Deno 2.x, #78)
//
// 평가 하네스는 DB에 접근하지 않는다. 생성 단계가 쓰는 공통 질문은 `eval-dataset.ts --questions`가
// checkin_session_questions(approved)에서 받아 둔 local/eval/dataset/session-questions.json 에서만 읽는다.
//   - 같은 파일이면 같은 입력이다. 파일의 해시가 run config에 남고 compare가 달라진 것을 알려준다
//   - fallbackSessions: 질문이 없는 회차(2023년 등)가 고르는 풀. 처음 받을 때 정해지고 다시 받아도 유지된다.
//     새 질문이 승인될 때마다 풀이 커지면 질문이 없는 옛 case의 입력이 매번 바뀌어 비교가 끊기기 때문이다

export interface SessionQuestion {
  session: string;
  question: string;
}

export interface SessionQuestionSnapshot {
  fetchedAt: string;
  questions: SessionQuestion[];
  fallbackSessions: string[];
}

const ROOT = new URL("../..", import.meta.url).pathname;
export const SESSION_QUESTIONS_PATH = `${ROOT}local/eval/dataset/session-questions.json`;

// 해시에 들어가는 부분. fetchedAt은 빼서 같은 질문을 다시 받아도 해시가 바뀌지 않게 한다
export function snapshotPayload(s: SessionQuestionSnapshot): string {
  return JSON.stringify({
    questions: s.questions,
    fallbackSessions: s.fallbackSessions,
  });
}

let cached: SessionQuestionSnapshot | null = null;

// 동기 로더. Stage.input()이 동기 함수라서 처음 쓸 때 한 번 읽고 캐시한다
export function loadSessionQuestions(): SessionQuestionSnapshot {
  if (cached) return cached;
  let raw: string;
  try {
    raw = Deno.readTextFileSync(SESSION_QUESTIONS_PATH);
  } catch {
    throw new Error(
      `${SESSION_QUESTIONS_PATH} 가 없어요. 먼저 받아 두세요: deno run -A --no-lock --config supabase/functions/parse-content/deno.json scripts/eval-dataset.ts --questions`,
    );
  }
  const snap = JSON.parse(raw) as SessionQuestionSnapshot;
  if (!snap.questions?.length || !snap.fallbackSessions?.length)
    throw new Error(`${SESSION_QUESTIONS_PATH} 에 질문이 없어요.`);
  cached = snap;
  return snap;
}
