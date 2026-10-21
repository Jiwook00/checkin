// 품질 판정기 보정 리포트 (Deno 2.x)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/quality-calibrate.ts [--label <이름>]
//
// 입력: local/bench/quality-cases.json (라벨링된 사례), 사례가 가리키는 벤치 리포트 JSON, local/bench/snapshots/
// 출력: local/bench/<날짜>-<커밋>-quality-calibration[-라벨].md
//
// 판정 기준은 quality.ts를 그대로 import한다. 이 스크립트는 기준을 정하지 않고 측정만 한다.

import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import {
  assessQuality,
  DEGRADED_BELOW,
  isDegraded,
  isEmptyContent,
} from "../supabase/functions/parse-content/quality.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const BENCH_DIR = `${ROOT}local/bench`;

interface Case {
  url: string;
  report: string;
  label: "good" | "bad" | "minor";
  defect: string | null;
  source: string;
  note: string;
}

interface ReportResult {
  url: string;
  platform: string;
  ok: boolean;
  tier?: string;
  content_chars: number;
  content_markdown?: string;
}

const args = [...Deno.args];
const labelIdx = args.indexOf("--label");
const runLabel = labelIdx >= 0 ? args[labelIdx + 1] : "";

const corpus: { reports: Record<string, string>; cases: Case[] } = JSON.parse(
  await Deno.readTextFile(`${BENCH_DIR}/quality-cases.json`),
);

const reportCache = new Map<string, Map<string, ReportResult>>();
async function loadReport(file: string) {
  let m = reportCache.get(file);
  if (!m) {
    const json = JSON.parse(await Deno.readTextFile(`${BENCH_DIR}/${file}`));
    m = new Map<string, ReportResult>(
      (json.results as ReportResult[]).map((r) => [r.url, r]),
    );
    reportCache.set(file, m);
  }
  return m;
}

/** 프로덕션 파이프라인과 같은 순서: 빈 본문은 실패, 아니면 점수로 degraded */
type Verdict = "ok" | "degraded" | "failed";
function judge(
  md: string,
  tier: string,
): { verdict: Verdict; score: number; flags: string[] } {
  if (isEmptyContent(md)) return { verdict: "failed", score: 0, flags: [] };
  const q = assessQuality({ markdown: md, tier: tier as never });
  return {
    verdict: isDegraded(q.score) ? "degraded" : "ok",
    score: q.score,
    flags: q.flags,
  };
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}% (${n}/${d})`;
}

// --- 코퍼스 판정 -------------------------------------------------------------

interface Judged extends Case {
  verdict: Verdict;
  score: number;
  flags: string[];
  chars: number;
  tier: string;
  platform: string;
}

const judged: Judged[] = [];
for (const c of corpus.cases) {
  const rec = (await loadReport(c.report)).get(c.url);
  if (!rec?.ok) throw new Error(`리포트에 성공 결과가 없음: ${c.url}`);
  const j = judge(rec.content_markdown ?? "", rec.tier ?? "");
  judged.push({
    ...c,
    ...j,
    chars: rec.content_chars,
    tier: rec.tier ?? "—",
    platform: rec.platform,
  });
}

const scored = judged.filter((x) => x.label !== "minor");
const bads = scored.filter((x) => x.label === "bad");
const goods = scored.filter((x) => x.label === "good");
// 탐지 = degraded 또는 빈 본문 실패. 둘 다 "정상 글로 저장되지 않음"
const caught = (x: Judged) => x.verdict !== "ok";

const out: string[] = [];
const date = new Date().toISOString().slice(0, 10);

out.push(`# 품질 판정 보정 — ${date}${runLabel ? ` · ${runLabel}` : ""}`);
out.push("");
out.push(
  `코퍼스 ${corpus.cases.length}건: good ${goods.length} · bad ${bads.length} · minor ${judged.length - scored.length}(정밀도·재현율에서 제외). 현재 기준 degraded < ${DEGRADED_BELOW}`,
);
out.push(
  "탐지 = degraded 판정 또는 빈 본문 실패. 정밀도 분모 = 탐지된 전체(minor 제외), 재현율 분모 = 해당 유형의 bad 전체",
);
out.push("");

// --- 전체 정밀도·재현율 -------------------------------------------------------

const tp = bads.filter(caught).length;
const fp = goods.filter(caught).length;
out.push("## 정밀도·재현율");
out.push("");
out.push("| 지표 | 값 |");
out.push("| --- | --- |");
out.push(`| 정밀도 | ${pct(tp, tp + fp)} |`);
out.push(`| 재현율(전체 bad) | ${pct(tp, bads.length)} |`);
const byDefectAll = new Map<string, Judged[]>();
for (const b of bads) {
  const k = b.defect ?? "—";
  byDefectAll.set(k, [...(byDefectAll.get(k) ?? []), b]);
}
out.push("");
out.push("| 결함 유형 | 재현율 | 비고 |");
out.push("| --- | --- | --- |");
const defectNote: Record<string, string> = {
  contamination: "velog 댓글 영역·티스토리 보호글 스킨",
  empty: "naver 15건은 같은 템플릿(iframe 본문)",
  nav_junk: "",
  missing_content:
    "노션 잘림·토글 누락(#56 이전). 마크다운 텍스트만으로는 원리상 못 잡는다. 지금은 notion_truncated 플래그가 담당",
};
for (const [d, xs] of byDefectAll) {
  out.push(
    `| ${d} | ${pct(xs.filter(caught).length, xs.length)} | ${defectNote[d] ?? ""} |`,
  );
}
const emptyNoNaver = (byDefectAll.get("empty") ?? []).filter(
  (x) => x.platform !== "naver",
);
if (emptyNoNaver.length > 0) {
  out.push(
    `| empty (naver 제외) | ${pct(emptyNoNaver.filter(caught).length, emptyNoNaver.length)} | 중복 템플릿 제외 |`,
  );
}
out.push("");

// --- 임계값 스윕 ----------------------------------------------------------------

out.push("## 임계값 스윕");
out.push("");
out.push(
  "score < 임계값이면 degraded. 빈 본문 실패는 임계값과 무관하게 탐지로 센다.",
);
// 점수는 플래그 벌점의 합이라 몇 개 값으로만 나온다. 스윕이 계단 모양인 이유를 함께 보여준다
const scoreDist = new Map<string, number>();
for (const x of scored.filter((x) => x.verdict !== "failed")) {
  const k = `${x.score} (${x.flags.join("+") || "플래그 없음"})`;
  scoreDist.set(k, (scoreDist.get(k) ?? 0) + 1);
}
out.push(
  `점수 분포(빈 본문 제외): ${[...scoreDist]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}건`)
    .join(" · ")}`,
);
out.push("");
out.push("| 임계값 | 정밀도 | 재현율 | 오탐(good) | 놓침(bad) |");
out.push("| --- | --- | --- | --- | --- |");
for (let t = 0.3; t <= 0.91; t += 0.1) {
  const hit = (x: Judged) => x.verdict === "failed" || x.score < t;
  const tpT = bads.filter(hit).length;
  const fpT = goods.filter(hit).length;
  out.push(
    `| ${t.toFixed(1)}${Math.abs(t - DEGRADED_BELOW) < 1e-9 ? " ← 현재" : ""} | ${pct(tpT, tpT + fpT)} | ${pct(tpT, bads.length)} | ${fpT} | ${bads.length - tpT} |`,
  );
}
out.push("");

// --- 오판정 목록 ------------------------------------------------------------------

function table(rows: Judged[]) {
  out.push("| URL | 라벨 | 판정 | score | 플래그 | 글자 수 | 비고 |");
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    out.push(
      `| ${r.url.slice(0, 80)} | ${r.label}${r.defect ? `/${r.defect}` : ""} | ${r.verdict} | ${r.score} | ${r.flags.join(", ")} | ${r.chars} | ${r.note} |`,
    );
  }
  out.push("");
}

const falsePos = goods.filter(caught);
const falseNeg = bads.filter((x) => !caught(x));
out.push(`## 오탐 — good인데 탐지됨 (${falsePos.length}건)`);
out.push("");
if (falsePos.length > 0) table(falsePos);
else out.push("없음");
out.push("");
// 놓침은 유형이 많아 missing_content와 나머지를 나눠 본다
const missOther = falseNeg.filter((x) => x.defect !== "missing_content");
out.push(
  `## 놓침 — bad인데 통과 (${falseNeg.length}건, 이 중 missing_content ${falseNeg.length - missOther.length}건)`,
);
out.push("");
if (missOther.length > 0) {
  out.push("missing_content 외:");
  out.push("");
  table(missOther);
} else {
  out.push("missing_content 외에는 없음");
  out.push("");
}

const minors = judged.filter((x) => x.label === "minor");
out.push(`## minor (${minors.length}건): 판정기가 어떻게 보는가`);
out.push("");
out.push(
  `제목·작성자·키워드 등 130~220자가 섞인 brunch 이전 출력. 통과가 바람직하다. ok ${minors.filter((x) => x.verdict === "ok").length} · degraded ${minors.filter((x) => x.verdict === "degraded").length} · failed ${minors.filter((x) => x.verdict === "failed").length}`,
);
out.push("");
const minorFlagged = minors.filter(caught);
if (minorFlagged.length > 0) table(minorFlagged);

// --- 리포트 전체 재판정 (세트 A·B·C) ---------------------------------------------

out.push("## 리포트 전체 재판정");
out.push("");
out.push(
  "코퍼스 밖 확인용. 벤치 리포트의 성공 결과 전부에 현재 판정기를 돌린다. 이전 리포트는 #56 이전 코드의 출력이다.",
);
out.push("");
const setItems = new Map<string, Set<string>>();
for (const n of ["a-production", "b-golden", "c-external"]) {
  const json = JSON.parse(
    await Deno.readTextFile(`${BENCH_DIR}/sets/${n}.json`),
  );
  setItems.set(
    json.name,
    new Set((json.items as { url: string }[]).map((i) => i.url)),
  );
}
out.push("| 리포트 | 세트 | 성공 | ok | degraded | 빈 본문 실패 |");
out.push("| --- | --- | --- | --- | --- | --- |");
const reanalysis: { label: string; file: string }[] = [
  { label: "#56 이전 (c19e7ed)", file: corpus.reports.old },
  { label: "현재 (f7a0144)", file: corpus.reports.new },
];
const degradedA: string[] = [];
for (const { label, file } of reanalysis) {
  const rep = await loadReport(file);
  for (const [setName, urls] of setItems) {
    let nOk = 0;
    let nDeg = 0;
    let nEmpty = 0;
    let nSucc = 0;
    for (const u of urls) {
      const r = rep.get(u);
      if (!r?.ok) continue;
      nSucc++;
      const j = judge(r.content_markdown ?? "", r.tier ?? "");
      if (j.verdict === "ok") nOk++;
      else if (j.verdict === "degraded") {
        nDeg++;
        if (setName === "A") {
          degradedA.push(
            `${label} · ${r.platform} · ${j.flags.join(",")} · ${r.url}`,
          );
        }
      } else nEmpty++;
    }
    out.push(
      `| ${label} | ${setName} | ${nSucc} | ${pct(nOk, nSucc)} | ${pct(nDeg, nSucc)} | ${pct(nEmpty, nSucc)} |`,
    );
  }
}
out.push("");
if (degradedA.length > 0) {
  out.push("세트 A에서 degraded가 된 건:");
  out.push("");
  for (const l of degradedA) out.push(`- ${l}`);
  out.push("");
}

// --- whole_page 진단 ----------------------------------------------------------------

out.push("## whole_page 진단 (점수에는 쓰지 않음)");
out.push("");
out.push(
  "추출 글자 수 / 받은 HTML의 body 평문 글자 수. 깨끗한 추출과 오염된 추출이 갈리는지 본다. 노션은 HTML이 없어 제외.",
);
out.push("");

const urlToSnapshot = new Map<string, string>();
for await (const e of Deno.readDir(`${BENCH_DIR}/snapshots`)) {
  try {
    const s = JSON.parse(
      await Deno.readTextFile(`${BENCH_DIR}/snapshots/${e.name}`),
    );
    if (s.request.method === "GET" && s.body_base64) {
      urlToSnapshot.set(s.request.url, s.body_base64);
    }
  } catch {
    // 깨진 스냅샷은 건너뛴다
  }
}

const decoder = new TextDecoder();
function bodyTextLength(b64: string): number {
  const html = decoder.decode(decodeBase64(b64));
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  return body
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim().length;
}

function quantile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

const ratios = new Map<string, number[]>();
for (const x of judged) {
  if (x.platform === "notion" || x.chars === 0) continue;
  const b64 = urlToSnapshot.get(x.url);
  if (!b64) continue;
  const total = bodyTextLength(b64);
  if (total === 0) continue;
  const key = `${x.platform} · ${x.label}${x.defect ? `/${x.defect}` : ""}`;
  ratios.set(key, [...(ratios.get(key) ?? []), x.chars / total]);
}
out.push("| 플랫폼 · 라벨 | n | p10 | 중앙값 | p90 |");
out.push("| --- | --- | --- | --- | --- |");
for (const [k, xs] of [...ratios].sort((a, b) => a[0].localeCompare(b[0]))) {
  const f = (v: number) => v.toFixed(2);
  out.push(
    `| ${k} | ${xs.length} | ${f(quantile(xs, 0.1))} | ${f(quantile(xs, 0.5))} | ${f(quantile(xs, 0.9))} |`,
  );
}
out.push("");

// --- 쓰기 ----------------------------------------------------------------------------

async function gitSha(): Promise<string> {
  const run = async (...a: string[]) =>
    new TextDecoder()
      .decode(
        (await new Deno.Command("git", { args: a, cwd: ROOT }).output()).stdout,
      )
      .trim();
  const sha = await run("rev-parse", "--short", "HEAD");
  const dirty = await run(
    "status",
    "--porcelain",
    "supabase/functions/parse-content",
  );
  return dirty ? `${sha}-dirty` : sha;
}

const stem = `${BENCH_DIR}/${date}-${await gitSha()}-quality-calibration${runLabel ? `-${runLabel}` : ""}`;
await Deno.writeTextFile(`${stem}.md`, out.join("\n"));
console.error(`리포트: ${stem}.md`);
