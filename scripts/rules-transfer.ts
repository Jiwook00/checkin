// LLM이 고른 셀렉터를 같은 호스트의 다른 글에 적용하면 어떻게 되는지 잰다 (#59, 호출 0)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/rules-transfer.ts --force <강제 평가 결과.json> --record <기준 결과.json> [--label <이름>] <골든 세트.json>...
//
//   예) ... --force local/bench/2026-10-21-37135e7-llm-force.json \
//          --record local/bench/2026-10-21-37135e7-llm-record.json \
//          local/bench/sets/b-golden.json local/bench/sets/c-llm-golden.json
//
// - --force: 강제 평가(parse-bench --llm-force)의 결과. recovered인 글의 셀렉터를 규칙 후보로 쓴다
// - --record: 기준 결과. ok인 같은 호스트 글 전부에 셀렉터를 적용하고 기준 본문과 비교한다
// - 페이지는 local/bench/snapshots/의 스냅샷만 읽는다. 네트워크·API 호출 없음
// - 결과: local/bench/<날짜>-<커밋>[-라벨]-rules-transfer.md

import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import { fetchBlogHtml } from "../supabase/functions/parse-content/blog-parser.ts";
import {
  extractFromNode,
  prepareDocument,
  validateSelector,
} from "../supabase/functions/parse-content/llm-fallback.ts";
import { toPlain } from "../supabase/functions/parse-content/quality.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const BENCH_DIR = `${ROOT}local/bench`;
const SNAPSHOT_DIR = `${BENCH_DIR}/snapshots`;
// 글자 수가 이 비율 안이면 기준과 같은 본문으로 본다
const SAME_TOLERANCE = 0.005;
// parse-bench의 골든 판정과 같은 글자 수 허용 범위
const CHAR_TOLERANCE = 0.2;

interface ForceRow {
  url: string;
  outcome: string;
  selector?: string;
}
interface BaseRow {
  url: string;
  ok: boolean;
  tier?: string;
  content_markdown?: string;
  content_chars: number;
}
interface GoldenLabel {
  first_sentence: string;
  last_sentence: string;
  approx_chars: number;
  expect_failure?: boolean;
}

const args = [...Deno.args];
const VALUE_FLAGS = ["--force", "--record", "--label"];
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const forceFile = flag("--force");
const recordFile = flag("--record");
const label = flag("--label") ?? "";
const setFiles = args.filter(
  (a, i) =>
    !a.startsWith("--") && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])),
);
if (!forceFile || !recordFile) {
  console.error("--force와 --record가 필요해요. 사용법은 파일 상단 주석 참고");
  Deno.exit(1);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 스냅샷에 있는 페이지만 읽는 fetch. 없으면 던진다 */
const snapshotFetch: typeof fetch = async (input) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const path = `${SNAPSHOT_DIR}/${await sha256Hex(`GET ${url}\n`)}.json`;
  const snap = JSON.parse(await Deno.readTextFile(path));
  if (snap.error) throw new TypeError(snap.error);
  return new Response(decodeBase64(snap.body_base64 ?? ""), {
    status: snap.status,
    headers: snap.content_type ? { "content-type": snap.content_type } : {},
  });
};

/** parse-bench의 골든 판정과 같은 문장 비교 정규화 */
function normalizeForMatch(s: string): string {
  return toPlain(s)
    .replace(/[\s_*]/g, "")
    .toLowerCase();
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}% (${n}/${d})`;
}

const host = (u: string) => new URL(u).hostname.toLowerCase();

const force: ForceRow[] = JSON.parse(await Deno.readTextFile(forceFile)).force;
const base: BaseRow[] = JSON.parse(await Deno.readTextFile(recordFile)).results;
const labels = new Map<string, GoldenLabel>();
for (const file of setFiles) {
  for (const it of JSON.parse(await Deno.readTextFile(file)).items) {
    if (it.label) labels.set(it.url, it.label);
  }
}

// 호스트마다 가장 많이 고른 셀렉터를 대표 규칙으로 쓴다 (동률이면 먼저 나온 것)
const seeds = force.filter((f) => f.outcome === "recovered" && f.selector);
const seedUrls = new Set(seeds.map((s) => s.url));
const hosts = [...new Set(seeds.map((s) => host(s.url)))];
const primary = new Map<string, string>();
const variants = new Map<string, string[]>();
for (const h of hosts) {
  const counts = new Map<string, number>();
  for (const s of seeds.filter((x) => host(x.url) === h)) {
    counts.set(s.selector!, (counts.get(s.selector!) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  primary.set(h, ranked[0][0]);
  variants.set(
    h,
    ranked.map(([sel, n]) => `\`${sel}\` ×${n}`),
  );
}

interface PostResult {
  url: string;
  host: string;
  seed: boolean;
  matched: boolean;
  why?: string;
  qualityOk: boolean;
  chars: number;
  baseChars: number;
  same: boolean;
  extraLines: string[];
  baseTier: string;
  golden?: boolean;
}

const posts: PostResult[] = [];
for (const h of hosts) {
  const selector = primary.get(h)!;
  for (const b of base.filter((r) => r.ok && host(r.url) === h)) {
    const res: PostResult = {
      url: b.url,
      host: h,
      seed: seedUrls.has(b.url),
      matched: false,
      qualityOk: false,
      chars: 0,
      baseChars: b.content_chars,
      same: false,
      extraLines: [],
      baseTier: b.tier ?? "—",
    };
    posts.push(res);
    let html: string;
    try {
      html = await fetchBlogHtml(b.url, snapshotFetch);
    } catch {
      res.why = "스냅샷 없음";
      continue;
    }
    const doc = prepareDocument(html);
    if (!doc) {
      res.why = "html_parse_failed";
      continue;
    }
    const check = validateSelector(doc, selector);
    if (!check.ok) {
      res.why = check.reason;
      continue;
    }
    res.matched = true;
    const extracted = extractFromNode(doc, check.node, "domain_rule");
    if (!extracted.ok) {
      res.why = extracted.reason;
      continue;
    }
    res.qualityOk = true;
    const md = extracted.parsed.content_markdown;
    res.chars = toPlain(md).length;
    res.same =
      Math.abs(res.chars - b.content_chars) <= b.content_chars * SAME_TOLERANCE;
    const baseLines = new Set(
      (b.content_markdown ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    );
    res.extraLines = md
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !baseLines.has(l));
    const lab = labels.get(b.url);
    if (lab && !lab.expect_failure) {
      const body = normalizeForMatch(md);
      res.golden =
        body.includes(normalizeForMatch(lab.first_sentence)) &&
        body.includes(normalizeForMatch(lab.last_sentence)) &&
        Math.abs(res.chars - lab.approx_chars) <=
          lab.approx_chars * CHAR_TOLERANCE;
    }
  }
}

function summarize(rs: PostResult[]): string[] {
  const n = rs.length;
  const matched = rs.filter((r) => r.matched);
  const ok = rs.filter((r) => r.qualityOk);
  const golden = rs.filter((r) => r.golden !== undefined);
  const dirty = ok.filter((r) => r.extraLines.length > 0);
  const ratios = ok.map((r) => r.chars / r.baseChars);
  return [
    pct(matched.length, n),
    pct(ok.length, n),
    pct(ok.filter((r) => r.same).length, ok.length),
    pct(dirty.length, ok.length),
    golden.length
      ? pct(golden.filter((r) => r.golden).length, golden.length)
      : "—",
    ok.length
      ? `${median(ratios).toFixed(3)} / ${Math.max(...ratios).toFixed(3)}`
      : "—",
  ];
}

const out: string[] = [];
const hostRows = hosts.map((h) => ({
  h,
  rs: posts.filter((p) => p.host === h),
}));
out.push("# 도메인 규칙 호스트 일반화 측정 (#59)");
out.push("");
out.push(
  `강제 평가: \`${forceFile.replace(ROOT, "")}\` · 기준 결과: \`${recordFile.replace(ROOT, "")}\` · 호출 0 (스냅샷만 사용)`,
);
out.push("");
out.push(
  "> **해석 주의**: 아래 호스트의 글은 기존 셀렉터가 이미 성공한다. 규칙을 LLM 바로 앞에 두는 설계에서는 이 글들에 규칙이 쓰이지 않는다. 이 표는 **규칙을 tier 0(플랫폼 셀렉터 앞)에 뒀다면 무슨 일이 생겼을지**를 재는 것이다.",
);
out.push("");
out.push(
  "열: 매칭 1개 = 셀렉터가 정확히 한 노드에 맞음 · 품질 통과 = `extractFromNode`(빈 본문·degraded 거부) 통과 · 기준과 동일 = 글자 수가 기준 결과와 ±0.5% · 추가 줄 있음 = 기준 본문에 없는 줄이 섞임 · 골든 = 첫·마지막 문장 + 글자 수 ±20%(라벨이 있는 글만) · 글자 수 비율 = 중앙값 / 최대(기준 대비)",
);
out.push("");

const header =
  "| 대상 | 글 수 | 매칭 1개 | 품질 통과 | 기준과 동일 | 추가 줄 있음 | 골든 | 글자 수 비율 |";
const sep = "| --- | --- | --- | --- | --- | --- | --- | --- |";

// 일반화 대상: 같은 호스트에 글이 2개 이상 있는 호스트 (시드 하나뿐인 호스트는 자명하다)
const multi = hostRows.filter((x) => x.rs.length >= 2);
const multiPosts = multi.flatMap((x) => x.rs);
out.push("## 요약 (같은 호스트에 글이 2개 이상인 호스트)");
out.push("");
out.push(header);
out.push(sep);
out.push(
  `| 전체 (시드 글 포함) | ${multiPosts.length} | ${summarize(multiPosts).join(" | ")} |`,
);
const nonSeed = multiPosts.filter((p) => !p.seed);
out.push(
  `| 시드가 아닌 글만 | ${nonSeed.length} | ${summarize(nonSeed).join(" | ")} |`,
);
out.push("");

out.push("## 호스트별");
out.push("");
out.push(
  "| 호스트 | 셀렉터 (강제 평가 선택) | 글 수 | 매칭 1개 | 품질 통과 | 기준과 동일 | 추가 줄 있음 | 골든 | 글자 수 비율 |",
);
out.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const { h, rs } of hostRows) {
  out.push(
    `| ${h} | ${variants.get(h)!.join(", ")} | ${rs.length} | ${summarize(rs).join(" | ")} |`,
  );
}
out.push("");

const failures = posts.filter((p) => !p.qualityOk);
if (failures.length > 0) {
  out.push("## 규칙이 적용되지 않은 글");
  out.push("");
  out.push("| URL | 사유 |");
  out.push("| --- | --- |");
  for (const f of failures) out.push(`| ${f.url} | ${f.why ?? "—"} |`);
  out.push("");
}

out.push("## 추가로 섞인 줄 (호스트별 첫 글 기준 앞 8줄)");
out.push("");
for (const { h, rs } of hostRows) {
  const first = rs.find((r) => r.extraLines.length > 0);
  if (!first) continue;
  const counts = rs.filter((r) => r.qualityOk).map((r) => r.extraLines.length);
  out.push(
    `- **${h}**: 글당 추가 줄 중앙값 ${median(counts)}, 최대 ${Math.max(...counts)}. 예시(${first.url}):`,
  );
  for (const l of first.extraLines.slice(0, 8)) {
    out.push(`  - ${l.slice(0, 80).replace(/\|/g, "\\|")}`);
  }
}
out.push("");

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
const date = new Date().toISOString().slice(0, 10);
const path = `${BENCH_DIR}/${date}-${sha}${dirty ? "-dirty" : ""}${label ? `-${label}` : ""}-rules-transfer.md`;
await Deno.writeTextFile(path, out.join("\n"));
console.error(`리포트: ${path}`);
