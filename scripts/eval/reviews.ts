// 운영 검토 기록 → 사람 라벨 내보내기의 순수 변환·집계 (#84). DB 접근과 파일 쓰기는 eval-dataset.ts --reviews가 한다
//
// reviews.json은 checkin_reminder_drafts를 가공 없이 옮긴 것이다 (멤버 이름·메일 본문이 들어가므로 local/에만 둔다).
// 지표 요약(reviews-summary.md)에는 멤버 이름과 사유 원문을 쓰지 않는다. PR·ADR에 그대로 붙일 수 있어야 한다.

import {
  CLAUDE_PRICES,
  costUsd,
} from "../../supabase/functions/_shared/reminder/claude.ts";

export interface DraftRow {
  id: string;
  session: string;
  member_id: string;
  input: Record<string, unknown> & {
    source?: { state?: string; retroId?: string | null; sha256?: string | null };
  };
  extract: {
    promptSha256?: string;
    sourceSha256?: string;
    model?: string;
    usage?: unknown;
    latencyMs?: number;
    reusedFrom?: string;
  } | null;
  output: {
    result?: { callbackItem?: number };
    parseError?: string;
  } | null;
  mail: string | null;
  model: string;
  prompt_sha256: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  rule_scores: Record<string, { value: number; reason?: string }>;
  status: "draft" | "approved" | "edited" | "rejected";
  edited_mail: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
  sent_via: string | null;
  created_at: string;
}

export interface ReviewRecord {
  id: string;
  session: string;
  memberId: string;
  memberName: string;
  createdAt: string;
  // 멤버별 첫 생성 / 최신 row (재생성하면 첫 row와 최신 row가 달라진다)
  isFirst: boolean;
  isLatest: boolean;
  status: DraftRow["status"];
  reviewNote: string | null;
  reviewedAt: string | null;
  mail: string | null;
  editedMail: string | null;
  sentAt: string | null;
  sentVia: string | null;
  model: string;
  promptSha256: string;
  extract: {
    promptSha256: string | null;
    sourceSha256: string | null;
    reusedFrom: string | null;
  } | null;
  input: DraftRow["input"];
  // 고른 재료 번호 등 생성 결과. 0이면 콜백 없이 쓴 메일
  output: DraftRow["output"];
  hasCallback: boolean;
  ruleScores: DraftRow["rule_scores"];
  ruleFailed: string[];
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

export interface ReviewTags {
  taxonomy: Record<string, { judge: string | null; def: string }>;
  labels: Record<string, { tags: string[]; note?: string }>;
}

export function toReviewRecords(
  rows: DraftRow[],
  nick: Map<string, string>,
): ReviewRecord[] {
  const sorted = [...rows].sort(
    (a, b) =>
      a.member_id.localeCompare(b.member_id) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
  const byMember = new Map<string, DraftRow[]>();
  for (const r of sorted) {
    (byMember.get(r.member_id) ?? byMember.set(r.member_id, []).get(r.member_id)!).push(r);
  }
  return sorted.map((r) => {
    const mine = byMember.get(r.member_id)!;
    return {
      id: r.id,
      session: r.session,
      memberId: r.member_id,
      memberName: nick.get(r.member_id) ?? r.member_id,
      createdAt: r.created_at,
      isFirst: mine[0].id === r.id,
      isLatest: mine[mine.length - 1].id === r.id,
      status: r.status,
      reviewNote: r.review_note,
      reviewedAt: r.reviewed_at,
      mail: r.mail,
      editedMail: r.edited_mail,
      sentAt: r.sent_at,
      sentVia: r.sent_via,
      model: r.model,
      promptSha256: r.prompt_sha256,
      extract: r.extract
        ? {
            promptSha256: r.extract.promptSha256 ?? null,
            sourceSha256: r.extract.sourceSha256 ?? null,
            reusedFrom: r.extract.reusedFrom ?? null,
          }
        : null,
      input: r.input,
      output: r.output,
      hasCallback: (r.output?.result?.callbackItem ?? 0) > 0,
      ruleScores: r.rule_scores,
      ruleFailed: Object.entries(r.rule_scores)
        .filter(([, s]) => s.value < 1)
        .map(([k]) => k),
      tokensIn: r.tokens_in,
      tokensOut: r.tokens_out,
      latencyMs: r.latency_ms,
    };
  });
}

const percentile = (sorted: number[], p: number) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
    : 0;

const pct = (n: number, d: number) =>
  d === 0 ? "-" : `${n}/${d} (${Math.round((n / d) * 100)}%)`;

// 같은 규칙에 걸린 건수를 센다 (규칙 이름 → 건수)
function countBy<T>(xs: T[], key: (x: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
}

function costOf(records: ReviewRecord[]): number {
  let total = 0;
  for (const r of records) {
    const price = CLAUDE_PRICES[r.model];
    if (price) total += costUsd(price, { input: r.tokensIn, output: r.tokensOut });
  }
  return total;
}

// 멤버 이름과 사유 원문 없이 숫자만 낸다. 분모는 항상 적는다
export function buildReviewsSummary(
  session: string,
  records: ReviewRecord[],
  tags: ReviewTags | null,
): string {
  const L: string[] = [];
  const members = new Set(records.map((r) => r.memberId));
  const finals = records.filter((r) => r.isLatest);
  const firsts = records.filter((r) => r.isFirst);
  const regens = records.filter((r) => !r.isFirst);
  const reviewed = finals.filter((r) => r.status !== "draft");
  const sentMembers = new Set(records.filter((r) => r.sentAt).map((r) => r.memberId));
  const count = (rs: ReviewRecord[], s: DraftRow["status"]) =>
    rs.filter((r) => r.status === s).length;

  L.push(`# 운영 지표 — 회차 ${session}`, "");
  L.push(
    "분모: **대상 멤버** = 이 회차에 초안이 한 번이라도 만들어진 멤버(이미 쓴 멤버 제외). **최종 row** = 멤버별 가장 최근 초안.",
    "",
  );

  L.push("## 통수", "");
  L.push("| 항목 | 건수 |", "| --- | ---: |");
  L.push(`| 대상 멤버 | ${members.size} |`);
  L.push(`| 생성 row (전체) | ${records.length} |`);
  L.push(`| └ 첫 생성 | ${firsts.length} |`);
  L.push(`| └ 재생성 | ${regens.length} |`);
  L.push(`| 발송 표시된 멤버 | ${pct(sentMembers.size, members.size)} |`);
  L.push(
    `| 발송 안 함 (대상 − 발송) | ${members.size - sentMembers.size} |`,
    "",
  );

  L.push("## 검토 (최종 row 기준)", "");
  L.push("| 상태 | 건수 |", "| --- | ---: |");
  for (const [label, s] of [
    ["승인", "approved"],
    ["수정 승인", "edited"],
    ["반려", "rejected"],
    ["검토 전", "draft"],
  ] as const) {
    L.push(`| ${label} | ${pct(count(finals, s), finals.length)} |`);
  }
  L.push("");
  const everRejected = records.filter((r) => r.status === "rejected").length;
  L.push(
    `전체 row 기준 반려 ${pct(everRejected, records.length)} — 반려한 초안을 다시 생성하면 최종 row에서는 사라지지만 전체 row에는 남는다.`,
    "",
  );

  L.push("## 콜백 (최종 row 기준)", "");
  const cb = finals.filter((r) => r.hasCallback);
  L.push("| 항목 | 건수 |", "| --- | ---: |");
  L.push(`| 콜백 있음 | ${pct(cb.length, finals.length)} |`);
  L.push(`| 콜백 없음 | ${pct(finals.length - cb.length, finals.length)} |`, "");

  L.push("## 규칙 채점 × 사람 판단 (검토를 마친 최종 row)", "");
  const failed = reviewed.filter((r) => r.ruleFailed.length > 0);
  const passed = reviewed.filter((r) => r.ruleFailed.length === 0);
  const touched = (rs: ReviewRecord[]) =>
    rs.filter((r) => r.status === "edited" || r.status === "rejected").length;
  L.push("| | 승인 | 수정·반려 | 합계 |", "| --- | ---: | ---: | ---: |");
  L.push(
    `| 규칙 채점 걸림 | ${failed.length - touched(failed)} | ${touched(failed)} | ${failed.length} |`,
  );
  L.push(
    `| 규칙 채점 통과 | ${passed.length - touched(passed)} | ${touched(passed)} | ${passed.length} |`,
  );
  L.push(`| 합계 | ${reviewed.length - touched(reviewed)} | ${touched(reviewed)} | ${reviewed.length} |`, "");
  const ruleCounts = countBy(
    failed.flatMap((r) => r.ruleFailed),
    (x) => x,
  );
  if (ruleCounts.length > 0)
    L.push(
      `걸린 규칙: ${ruleCounts.map(([k, n]) => `${k} ${n}`).join(" · ")}`,
      "",
    );

  L.push("## 토큰 · 비용 · 지연", "");
  L.push(
    "비용은 Haiku 단가(`CLAUDE_PRICES`)로 환산. 재사용한 추출은 토큰에 들어가지 않는다.",
    "",
  );
  L.push(
    "| 구분 | n | 입력 tok | 출력 tok | 비용(USD) | 지연 p50 | 지연 최대 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  const sec = (ms: number[], p: number) =>
    ms.length ? `${(percentile([...ms].sort((a, b) => a - b), p) / 1000).toFixed(1)}초` : "-";
  const row = (label: string, rs: ReviewRecord[]) => {
    const ms = rs.map((r) => r.latencyMs);
    const max = ms.length ? `${(Math.max(...ms) / 1000).toFixed(1)}초` : "-";
    L.push(
      `| ${label} | ${rs.length} | ${rs.reduce((s, r) => s + r.tokensIn, 0).toLocaleString()} | ${rs
        .reduce((s, r) => s + r.tokensOut, 0)
        .toLocaleString()} | ${costOf(rs).toFixed(4)} | ${sec(ms, 0.5)} | ${max} |`,
    );
  };
  row("전체", records);
  row("첫 생성", firsts);
  row("재생성", regens);
  const extracted = records.filter((r) => r.extract && !r.extract.reusedFrom);
  const reused = records.filter((r) => r.extract?.reusedFrom);
  const none = records.filter((r) => !r.extract);
  row("└ 추출 호출 포함", extracted);
  row("└ 추출 재사용", reused);
  row("└ 추출 없음 (직전 글 없음)", none);
  L.push("");
  const hashes = [...new Set(records.map((r) => r.promptSha256.slice(0, 8)))];
  const models = [...new Set(records.map((r) => r.model))];
  L.push(`모델: ${models.join(", ")} · 생성 프롬프트 해시: ${hashes.join(", ")}`, "");

  if (tags) {
    L.push("## 검토 사유 유형 (손으로 붙인 태그)", "");
    const labeled = finals.filter((r) => tags.labels[r.id]);
    const unknownIds = Object.keys(tags.labels).filter(
      (id) => !records.some((r) => r.id === id),
    );
    L.push(
      `태그를 붙인 최종 row ${pct(labeled.length, touched(reviewed))} (수정·반려한 최종 row 대비)`,
      "",
    );
    L.push("| 태그 | 연결 judge 항목 | 건수 | 분모 |", "| --- | --- | ---: | ---: |");
    for (const [tag, def] of Object.entries(tags.taxonomy)) {
      const n = labeled.filter((r) => tags.labels[r.id].tags.includes(tag)).length;
      // 공통 질문 답변 재료는 콜백이 있는 메일에서만 생길 수 있다
      const denom = tag === "common_q_material" ? cb.length : labeled.length;
      L.push(`| ${tag} | ${def.judge ?? "judge 밖"} | ${n} | ${denom} |`);
    }
    L.push("");
    const unlisted = new Set(
      Object.values(tags.labels)
        .flatMap((l) => l.tags)
        .filter((t) => !(t in tags.taxonomy)),
    );
    if (unlisted.size > 0)
      L.push(`⚠ 목록에 없는 태그: ${[...unlisted].join(", ")} (새 유형으로 따로 센다)`, "");
    if (unknownIds.length > 0)
      L.push(`⚠ reviews.json에 없는 draft id ${unknownIds.length}개`, "");
  }
  return L.join("\n");
}
