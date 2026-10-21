// parse-content 파이프라인 벤치마크 (Deno 2.x)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/parse-bench.ts [--record | --replay] [--label <이름>] <set.json>...
//
//   예) 기준선 수집:  ... --record --label baseline local/bench/sets/a-production.json local/bench/sets/b-golden.json local/bench/sets/c-external.json
//   예) 비교 측정:    ... --replay local/bench/sets/*.json
//
// - 기본(플래그 없음): 실제 네트워크로 실행, 아무것도 저장하지 않음
// - --record: 실제 네트워크로 실행하고 원본 응답을 local/bench/snapshots/에 저장
// - --replay: 네트워크 없이 스냅샷으로 deps.fetch를 대체 (스냅샷이 없으면 그 요청은 실패)
// - 여러 세트에 같은 URL이 있으면 한 번만 실행하고 세트별로 집계한다
// - 결과: local/bench/<날짜>-<커밋>[-라벨].json + .md
//
// 세트 파일 형식: { "name": "A", "items": [{ "url": "...", "had_content"?: bool, "label"?: GoldenLabel }] }

import { encodeBase64, decodeBase64 } from "jsr:@std/encoding@1/base64";
import { runPipeline } from "../supabase/functions/parse-content/pipeline.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const BENCH_DIR = `${ROOT}local/bench`;
const SNAPSHOT_DIR = `${BENCH_DIR}/snapshots`;

const CONCURRENCY = 4;
const HOST_INTERVAL_MS = 1000;
// 하네스 보호용 상한. 파서의 fetchWithPolicy 타임아웃(10초)과 별개로 요청 하나가 실행 전체를 멈추지 않게 한다
const REQUEST_TIMEOUT_MS = 30_000;

// 설계 문서의 보일러플레이트 키워드. 서로 다른 키워드 2개 이상이 보이면 오염으로 본다
const BOILERPLATE_KEYWORDS = ["구독하기", "카테고리", "댓글", "Powered by"];
const BOILERPLATE_MIN_HITS = 2;
// 성공으로 저장됐지만 본문이 이보다 짧으면 조용한 실패로 의심한다 (설계 문서의 품질 플래그 기준)
const SHORT_CONTENT_CHARS = 200;
const CHAR_TOLERANCE = 0.2;

interface GoldenLabel {
  title: string;
  first_sentence: string;
  last_sentence: string;
  approx_chars: number;
  // 본문을 얻을 수 없는 페이지(비밀글, JS 렌더링 등). 파이프라인이 실패해야 합격
  expect_failure?: boolean;
}

interface SetItem {
  url: string;
  id?: string;
  had_content?: boolean;
  label?: GoldenLabel;
}

interface BenchSet {
  name: string;
  file: string;
  items: SetItem[];
}

interface RunRecord {
  url: string;
  platform: string;
  ok: boolean;
  stage?: string;
  error_code?: string;
  error?: string;
  // 파이프라인 소요 시간에서 하네스의 호스트 간격 대기를 뺀 값
  duration_ms: number;
  throttle_ms: number;
  fetch_count: number;
  title?: string;
  content_chars: number;
  content_markdown?: string;
  boilerplate_hits: string[];
}

interface Snapshot {
  request: { method: string; url: string; body: string | null };
  status?: number;
  content_type?: string | null;
  body_base64?: string;
  error?: string;
}

// --- 인자 ----------------------------------------------------------------

const args = [...Deno.args];
const mode: "live" | "record" | "replay" = args.includes("--record")
  ? "record"
  : args.includes("--replay")
    ? "replay"
    : "live";
const labelIdx = args.indexOf("--label");
const runLabel = labelIdx >= 0 ? args[labelIdx + 1] : "";
const setFiles = args.filter(
  (a, i) => !a.startsWith("--") && !(labelIdx >= 0 && i === labelIdx + 1),
);
if (setFiles.length === 0) {
  console.error("세트 파일을 하나 이상 주세요. 사용법은 파일 상단 주석 참고");
  Deno.exit(1);
}

// --- 플랫폼 분류 (리포트용, 파이프라인의 source_type보다 잘게) --------------

function platformOf(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  if (/notion\.(so|site|com)$/.test(host)) return "notion";
  if (host.endsWith("tistory.com")) return "tistory";
  if (host.endsWith("velog.io")) return "velog";
  if (host.endsWith("blog.naver.com") || host === "m.blog.naver.com")
    return "naver";
  if (host.endsWith("brunch.co.kr")) return "brunch";
  if (host === "medium.com" || host.endsWith(".medium.com")) return "medium";
  if (host.endsWith("github.io")) return "github.io";
  return "other";
}

// --- fetch 대체: 스로틀 + 스냅샷 ------------------------------------------

const nextSlot = new Map<string, number>();

/** 호스트별 간격을 지키고, 기다린 시간(ms)을 돌려준다 */
async function throttle(host: string): Promise<number> {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + HOST_INTERVAL_MS);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
  return at - now;
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

function describeRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input;
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const body = typeof init?.body === "string" ? init.body : null;
  return { url, method, body };
}

async function snapshotPath(req: {
  method: string;
  url: string;
  body: string | null;
}) {
  const key = await sha256Hex(`${req.method} ${req.url}\n${req.body ?? ""}`);
  return `${SNAPSHOT_DIR}/${key}.json`;
}

function makeFetch(counter: { n: number; wait_ms: number }): typeof fetch {
  return async (input, init) => {
    counter.n++;
    const req = describeRequest(input, init);

    if (mode === "replay") {
      let snap: Snapshot;
      try {
        snap = JSON.parse(await Deno.readTextFile(await snapshotPath(req)));
      } catch {
        throw new Error(`[bench] 스냅샷 없음: ${req.method} ${req.url}`);
      }
      if (snap.error) throw new TypeError(snap.error);
      return new Response(decodeBase64(snap.body_base64 ?? ""), {
        status: snap.status,
        headers: snap.content_type ? { "content-type": snap.content_type } : {},
      });
    }

    counter.wait_ms += await throttle(new URL(req.url).hostname);
    // 파서가 넘긴 타임아웃 signal을 덮어쓰지 않고 합친다
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    let res: Response;
    try {
      res = await fetch(input, { ...init, signal });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (mode === "record") {
        await saveSnapshot({ request: req, error: message });
      }
      throw err;
    }
    if (mode !== "record") return res;

    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type");
    await saveSnapshot({
      request: req,
      status: res.status,
      content_type: contentType,
      body_base64: encodeBase64(bytes),
    });
    return new Response(bytes, {
      status: res.status,
      headers: contentType ? { "content-type": contentType } : {},
    });
  };
}

async function saveSnapshot(snap: Snapshot) {
  await Deno.writeTextFile(
    await snapshotPath(snap.request),
    JSON.stringify(snap),
  );
}

// --- 텍스트 정규화와 판정 ---------------------------------------------------

/** 마크다운 문법을 걷어내고 공백을 하나로 접은 평문. 글자 수와 문장 포함 비교에 쓴다 */
function toPlain(md: string): string {
  return md
    .replace(/```[^\n]*\n/g, "")
    .replace(/```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")
    .replace(/(\*\*|__|~~|\*|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 문장 포함 비교용. 공백과 강조 기호(_, *)까지 지워 마크다운 변환 차이를 흡수한다 */
function normalizeForMatch(s: string): string {
  return toPlain(s)
    .replace(/[\s_*]/g, "")
    .toLowerCase();
}

function boilerplateHits(md: string): string[] {
  return BOILERPLATE_KEYWORDS.filter((k) => md.includes(k));
}

interface GoldenVerdict {
  pass: boolean;
  first: boolean;
  last: boolean;
  chars: boolean;
  clean: boolean;
}

function judgeGolden(rec: RunRecord, label: GoldenLabel): GoldenVerdict {
  if (label.expect_failure) {
    const failed = !rec.ok;
    return {
      pass: failed,
      first: failed,
      last: failed,
      chars: failed,
      clean: failed,
    };
  }
  if (!rec.ok || !rec.content_markdown) {
    return {
      pass: false,
      first: false,
      last: false,
      chars: false,
      clean: false,
    };
  }
  const body = normalizeForMatch(rec.content_markdown);
  const first = body.includes(normalizeForMatch(label.first_sentence));
  const last = body.includes(normalizeForMatch(label.last_sentence));
  const chars =
    Math.abs(rec.content_chars - label.approx_chars) <=
    label.approx_chars * CHAR_TOLERANCE;
  const clean = rec.boilerplate_hits.length < BOILERPLATE_MIN_HITS;
  return { pass: first && last && chars && clean, first, last, chars, clean };
}

// --- 실행 ------------------------------------------------------------------

async function runOne(url: string): Promise<RunRecord> {
  const counter = { n: 0, wait_ms: 0 };
  const result = await runPipeline(url, { fetch: makeFetch(counter) });
  const base = {
    url,
    platform: platformOf(url),
    duration_ms: result.duration_ms - counter.wait_ms,
    throttle_ms: counter.wait_ms,
    fetch_count: counter.n,
  };
  if (!result.ok) {
    return {
      ...base,
      ok: false,
      stage: result.error.stage,
      error_code: result.error.code,
      error: result.error.message,
      content_chars: 0,
      boilerplate_hits: [],
    };
  }
  return {
    ...base,
    ok: true,
    title: result.title,
    content_chars: toPlain(result.content_markdown).length,
    content_markdown: result.content_markdown,
    boilerplate_hits: boilerplateHits(result.content_markdown),
  };
}

async function runAll(urls: string[]): Promise<Map<string, RunRecord>> {
  const results = new Map<string, RunRecord>();
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      const rec = await runOne(url);
      results.set(url, rec);
      done++;
      const mark = rec.ok ? "✓" : "✗";
      console.error(
        `[${done}/${urls.length}] ${mark} ${rec.duration_ms}ms ${url}${rec.ok ? "" : ` — ${rec.error?.slice(0, 80)}`}`,
      );
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

// --- 리포트 ------------------------------------------------------------------

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, idx)];
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}% (${n}/${d})`;
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
}

/** 에러 메시지를 묶음 단위로 접는다 (노션 응답 본문처럼 매번 다른 꼬리는 자른다) */
function errorBucket(error = ""): string {
  return error
    .replace(/(\d{3}) \{.*$/s, "$1")
    .replace(/https?:\/\/\S+/g, "<url>")
    .slice(0, 80);
}

function renderSet(set: BenchSet, results: Map<string, RunRecord>): string {
  const recs = set.items.map((it) => results.get(it.url)!);
  const failed = recs.filter((r) => !r.ok);
  const out: string[] = [];
  out.push(`## 세트 ${set.name} — ${set.items.length}건`);
  out.push(`파일: \`${set.file}\``);
  out.push("");

  out.push("### 하드 실패율 (플랫폼별)");
  out.push(
    `조용한 실패 신호(성공 건 기준): 본문 ${SHORT_CONTENT_CHARS}자 미만, 보일러플레이트 키워드 ${BOILERPLATE_MIN_HITS}종 이상`,
  );
  out.push("");
  out.push("| 플랫폼 | 실패율 | 짧은 본문 | 보일러플레이트 의심 |");
  out.push("| --- | --- | --- | --- |");
  const byPlatform = groupBy(recs, (r) => r.platform);
  const silent = (rs: RunRecord[]) => {
    const ok = rs.filter((r) => r.ok);
    const short = ok.filter((r) => r.content_chars < SHORT_CONTENT_CHARS);
    const dirty = ok.filter(
      (r) => r.boilerplate_hits.length >= BOILERPLATE_MIN_HITS,
    );
    return `${pct(short.length, ok.length)} | ${pct(dirty.length, ok.length)}`;
  };
  for (const [platform, rs] of [...byPlatform].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    const nFailed = rs.filter((r) => !r.ok).length;
    out.push(`| ${platform} | ${pct(nFailed, rs.length)} | ${silent(rs)} |`);
  }
  out.push(
    `| **전체** | **${pct(failed.length, recs.length)}** | ${silent(recs)} |`,
  );
  out.push("");

  if (failed.length > 0) {
    out.push("### 실패 원인");
    out.push("| 메시지 | 건수 |");
    out.push("| --- | --- |");
    for (const [msg, rs] of [
      ...groupBy(failed, (r) => errorBucket(r.error)),
    ].sort((a, b) => b[1].length - a[1].length)) {
      out.push(`| ${msg.replace(/\|/g, "\\|")} | ${rs.length} |`);
    }
    out.push("");
  }

  const withHistory = set.items.filter((it) => it.had_content !== undefined);
  if (withHistory.length > 0) {
    out.push("### DB 기존 상태 대비 (과거 실패가 지금도 실패하는가)");
    out.push("| DB 상태 | 지금 성공 | 지금 실패 |");
    out.push("| --- | --- | --- |");
    for (const had of [false, true]) {
      const its = withHistory.filter((it) => it.had_content === had);
      const nowOk = its.filter((it) => results.get(it.url)!.ok).length;
      out.push(
        `| ${had ? "본문 있음" : "본문 없음"} (${its.length}건) | ${nowOk} | ${its.length - nowOk} |`,
      );
    }
    out.push("");
  }

  const labeled = set.items.filter((it) => it.label);
  if (labeled.length > 0) {
    const verdicts = labeled.map((it) => ({
      it,
      v: judgeGolden(results.get(it.url)!, it.label!),
    }));
    out.push("### 골든셋 추출 정확도");
    out.push(
      `기준: 첫 문장 포함 + 마지막 문장 포함 + 글자 수 ±${CHAR_TOLERANCE * 100}% + 보일러플레이트 키워드 ${BOILERPLATE_MIN_HITS}종 미만. expect_failure 라벨은 파이프라인이 실패해야 합격`,
    );
    out.push("");
    out.push("| 플랫폼 | 정확도 | 첫 문장 | 마지막 문장 | 글자 수 | 깨끗함 |");
    out.push("| --- | --- | --- | --- | --- | --- |");
    const rows = [
      ...groupBy(verdicts, (x) => platformOf(x.it.url)),
      ["**전체**", verdicts] as const,
    ];
    for (const [platform, vs] of rows) {
      const n = vs.length;
      const c = (f: (v: GoldenVerdict) => boolean) =>
        pct(vs.filter((x) => f(x.v)).length, n);
      out.push(
        `| ${platform} | ${c((v) => v.pass)} | ${c((v) => v.first)} | ${c((v) => v.last)} | ${c((v) => v.chars)} | ${c((v) => v.clean)} |`,
      );
    }
    out.push("");
    const misses = verdicts.filter((x) => !x.v.pass);
    if (misses.length > 0) {
      out.push("<details><summary>불합격 목록</summary>");
      out.push("");
      out.push("| URL | 사유 | 추출 글자 수 / 라벨 |");
      out.push("| --- | --- | --- |");
      for (const { it, v } of misses) {
        const rec = results.get(it.url)!;
        const why = it.label!.expect_failure
          ? "실패해야 하는데 성공으로 저장됨"
          : !rec.ok
            ? `실패: ${errorBucket(rec.error)}`
            : [
                !v.first && "첫 문장 없음",
                !v.last && "마지막 문장 없음",
                !v.chars && "글자 수 벗어남",
                !v.clean &&
                  `보일러플레이트(${rec.boilerplate_hits.join(", ")})`,
              ]
                .filter(Boolean)
                .join(", ");
        out.push(
          `| ${it.url} | ${why} | ${rec.content_chars} / ${it.label!.approx_chars} |`,
        );
      }
      out.push("");
      out.push("</details>");
      out.push("");
    }
  }

  const ds = recs.map((r) => r.duration_ms);
  out.push("### 소요 시간");
  out.push(
    mode === "replay"
      ? "replay 모드라 네트워크 시간이 빠져 있다. 지연 비교는 record/live 실행끼리만 한다."
      : `하네스의 호스트당 ${HOST_INTERVAL_MS}ms 간격 대기는 빼고 잰다.`,
  );
  out.push("");
  out.push("| 플랫폼 | p50 | p95 |");
  out.push("| --- | --- | --- |");
  for (const [platform, rs] of byPlatform) {
    const d = rs.map((r) => r.duration_ms);
    out.push(
      `| ${platform} (${rs.length}) | ${percentile(d, 50)}ms | ${percentile(d, 95)}ms |`,
    );
  }
  out.push(
    `| **전체** (${ds.length}) | **${percentile(ds, 50)}ms** | **${percentile(ds, 95)}ms** |`,
  );
  out.push("");
  return out.join("\n");
}

async function gitCommit(): Promise<string> {
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

// --- main ----------------------------------------------------------------

const sets: BenchSet[] = [];
for (const file of setFiles) {
  const json = JSON.parse(await Deno.readTextFile(file));
  sets.push({ name: json.name, file, items: json.items });
}

await Deno.mkdir(SNAPSHOT_DIR, { recursive: true });
const urls = [...new Set(sets.flatMap((s) => s.items.map((it) => it.url)))];
console.error(
  `모드: ${mode} · 세트 ${sets.length}개 · 고유 URL ${urls.length}개`,
);

const startedAt = new Date();
const results = await runAll(urls);
const commit = await gitCommit();
const date = startedAt.toISOString().slice(0, 10);
const stem = `${BENCH_DIR}/${date}-${commit}${runLabel ? `-${runLabel}` : ""}`;

await Deno.writeTextFile(
  `${stem}.json`,
  JSON.stringify(
    {
      meta: {
        mode,
        commit,
        started_at: startedAt.toISOString(),
        sets: sets.map((s) => ({
          name: s.name,
          file: s.file,
          count: s.items.length,
        })),
      },
      results: [...results.values()],
    },
    null,
    2,
  ),
);

const report = [
  `# 파싱 벤치마크 — ${date} · \`${commit}\`${runLabel ? ` · ${runLabel}` : ""}`,
  "",
  `모드: ${mode} · 동시성 ${CONCURRENCY} · 고유 URL ${urls.length}개 · 요청 타임아웃(하네스) ${REQUEST_TIMEOUT_MS / 1000}초`,
  "",
  ...sets.map((s) => renderSet(s, results)),
].join("\n");
await Deno.writeTextFile(`${stem}.md`, report);
console.error(`\n리포트: ${stem}.md`);
