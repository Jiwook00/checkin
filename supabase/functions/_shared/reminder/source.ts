// 회고 본문 분류와 대표글 선택 (#79: scripts/eval-dataset.ts에서 옮김)
//
// 평가셋과 운영(Edge Function)이 "어떤 글을 콜백의 재료로 쓰는가"를 같은 규칙으로 판단한다.

// 직접 작성 글이 이 글자 수를 넘어야 본문 정상으로 본다
export const WRITTEN_MIN_CHARS = 200;
export interface RetroRow {
  id: string;
  title: string;
  session: string;
  member_id: string;
  content_type: "url" | "written";
  parse_status: "ok" | "degraded" | "failed" | null;
  content_markdown: string | null;
  created_at: string;
}

export type BodyState = "normal" | "failed" | "ambiguous";

export interface Retro extends RetroRow {
  markdown: string;
  state: BodyState;
}

export function classifySource(row: RetroRow): Retro {
  const markdown = (row.content_markdown ?? "").trim();
  let state: BodyState;
  if (row.parse_status === "failed") state = "failed";
  else if (row.parse_status === "ok") state = markdown ? "normal" : "failed";
  else if (
    row.content_type === "written" &&
    markdown.length > WRITTEN_MIN_CHARS
  )
    state = "normal";
  else state = "ambiguous"; // degraded, 짧은 직접 작성 글
  return { ...row, markdown, state };
}

// 같은 멤버·같은 회차의 여러 글 중 대표 하나를 고른다. 결정적이어야 하므로 반응 수 같은 가변 기준은 쓰지 않는다
export function compareRepresentative(a: Retro, b: Retro): number {
  const rank = (r: Retro) =>
    r.state === "normal" ? 0 : r.state === "ambiguous" ? 1 : 2;
  return (
    rank(a) - rank(b) ||
    b.markdown.length - a.markdown.length ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}
