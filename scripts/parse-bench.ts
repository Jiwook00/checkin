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
// LLM 폴백 (#58): --llm off|dry|record|replay|live  (기본 off)
//   off     LLM 없이 실행 (기준선과 비교할 때)
//   dry     호출 없이 대상 판정·사전 필터·프롬프트 크기·예상 비용만 계산
//   replay  local/bench/snapshots-llm/의 응답을 재생 (스냅샷이 없으면 llm_missing_snapshot)
//   record  스냅샷이 있으면 재사용하고, 없을 때만 실제 호출해 저장 (ANTHROPIC_API_KEY 필요)
//   live    항상 실제 호출, 저장 안 함 (ANTHROPIC_API_KEY 필요)
//   --llm-max-calls N   실제 API 호출 상한 (기본 20). 넘으면 이후 호출은 llm_max_calls 오류로 기록
//   --llm-force         규칙 결과와 무관하게 라벨 있는 블로그 글에 LLM을 돌려 골든 정확도를 잰다
//
// 세트 파일 형식: { "name": "A", "items": [{ "url": "...", "had_content"?: bool, "label"?: GoldenLabel }] }

import { encodeBase64, decodeBase64 } from "jsr:@std/encoding@1/base64";
import { runPipeline } from "../supabase/functions/parse-content/pipeline.ts";
import {
  extractBlog,
  fetchBlogHtml,
} from "../supabase/functions/parse-content/blog-parser.ts";
import { ParseError } from "../supabase/functions/parse-content/errors.ts";
import {
  createAnthropicLlm,
  LLM_MODEL,
  pageText,
  prepareDocument,
  PRICE_INPUT_PER_MTOK,
  PRICE_OUTPUT_PER_MTOK,
  runLlmFallback,
  type LlmClient,
} from "../supabase/functions/parse-content/llm-fallback.ts";
import {
  assessQuality,
  DEGRADED_BELOW,
  MIN_TEXT_CHARS,
  toPlain,
} from "../supabase/functions/parse-content/quality.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const BENCH_DIR = `${ROOT}local/bench`;
const SNAPSHOT_DIR = `${BENCH_DIR}/snapshots`;
const LLM_SNAPSHOT_DIR = `${BENCH_DIR}/snapshots-llm`;

const CONCURRENCY = 4;
const HOST_INTERVAL_MS = 1000;
// 하네스 보호용 상한. 파서의 fetchWithPolicy 타임아웃(10초)과 별개로 요청 하나가 실행 전체를 멈추지 않게 한다
const REQUEST_TIMEOUT_MS = 30_000;

// 조용한 실패 판정 기준(글자 수·보일러플레이트 패턴)은 quality.ts가 단일 정의한다
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
  tier?: string;
  // 파이프라인이 판정한 결과. 성공이면 ok 또는 degraded
  status?: "ok" | "degraded";
  quality_score?: number;
  // 파서가 붙인 플래그(예: notion_truncated)와 quality.ts가 계산한 플래그를 합친 값
  quality_flags: string[];
  content_chars: number;
  content_markdown?: string;
  // LLM 폴백이 개입한 경우(대상이었던 경우 포함)
  llm?: LlmRecord;
}

interface LlmRecord {
  // 폴백 직전 규칙 단계의 결과 (에러 코드 또는 degraded)
  rule: string;
  outcome: string;
  calls: number;
  selector?: string;
  reasons: string[];
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  ms: number;
  // dry 모드에서 프롬프트 글자 수 합 (예상 토큰 계산용)
  prompt_chars: number;
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
const VALUE_FLAGS = ["--label", "--llm", "--llm-max-calls"];
function flagValue(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const runLabel = flagValue("--label") ?? "";
const setFiles = args.filter(
  (a, i) =>
    !a.startsWith("--") && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])),
);
type LlmMode = "off" | "dry" | "record" | "replay" | "live";
const llmMode = (flagValue("--llm") ?? "off") as LlmMode;
if (!["off", "dry", "record", "replay", "live"].includes(llmMode)) {
  console.error(`--llm 값이 올바르지 않아요: ${llmMode}`);
  Deno.exit(1);
}
const llmMaxCalls = Number(flagValue("--llm-max-calls") ?? 20);
const llmForce = args.includes("--llm-force");
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
if ((llmMode === "record" || llmMode === "live") && !anthropicKey) {
  console.error("--llm record/live는 ANTHROPIC_API_KEY 환경변수가 필요해요");
  Deno.exit(1);
}
if (llmForce && llmMode === "off") {
  console.error("--llm-force는 --llm off 이외의 모드와 함께 써야 해요");
  Deno.exit(1);
}
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

async function snapshotPath(
  req: { method: string; url: string; body: string | null },
  dir = SNAPSHOT_DIR,
) {
  const key = await sha256Hex(`${req.method} ${req.url}\n${req.body ?? ""}`);
  return `${dir}/${key}.json`;
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

/** 문장 포함 비교용. 공백과 강조 기호(_, *)까지 지워 마크다운 변환 차이를 흡수한다 */
function normalizeForMatch(s: string): string {
  return toPlain(s)
    .replace(/[\s_*]/g, "")
    .toLowerCase();
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
  const clean = !rec.quality_flags.includes("boilerplate");
  return { pass: first && last && chars && clean, first, last, chars, clean };
}

// --- LLM 폴백: fetch·클라이언트 -------------------------------------------

const llmStats = { live_calls: 0, cached: 0, blocked: 0 };

/**
 * Anthropic 호출용 fetch. 스냅샷 키는 페이지 fetch와 같은 방식(메서드+URL+본문 해시)이고
 * 헤더(API 키)는 저장하지 않는다. 프롬프트가 바뀌면 키가 달라져 스냅샷이 맞지 않는다.
 */
function makeLlmFetch(): typeof fetch {
  return async (input, init) => {
    const req = describeRequest(input, init);
    const path = await snapshotPath(req, LLM_SNAPSHOT_DIR);

    // replay, record: 스냅샷이 있으면 재사용한다 (record는 같은 요청에 두 번 과금하지 않는다)
    if (llmMode === "replay" || llmMode === "record") {
      try {
        const snap: Snapshot = JSON.parse(await Deno.readTextFile(path));
        llmStats.cached++;
        return new Response(decodeBase64(snap.body_base64 ?? ""), {
          status: snap.status,
        });
      } catch {
        // 스냅샷 없음
      }
      if (llmMode === "replay") throw new Error("llm_missing_snapshot");
    }

    // 실제 호출. 검사와 증가 사이에 await가 없어 동시 실행에서도 상한이 지켜진다
    if (llmStats.live_calls >= llmMaxCalls) {
      llmStats.blocked++;
      throw new Error("llm_max_calls");
    }
    llmStats.live_calls++;
    const res = await fetch(input, init);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (llmMode === "record" && res.ok) {
      await Deno.mkdir(LLM_SNAPSHOT_DIR, { recursive: true });
      await Deno.writeTextFile(
        path,
        JSON.stringify({
          request: req,
          status: res.status,
          content_type: res.headers.get("content-type"),
          body_base64: encodeBase64(bytes),
        } satisfies Snapshot),
      );
    }
    return new Response(bytes, { status: res.status });
  };
}

const llmFetch = makeLlmFetch();

/** dry 모드: 호출하지 않고 프롬프트 크기만 기록한다 */
function makeDryClient(sink: { chars: number }): LlmClient {
  return {
    select(system, user) {
      sink.chars += system.length + user.length;
      return Promise.resolve({
        selection: null,
        input_tokens: 0,
        output_tokens: 0,
        error: "dry",
      });
    },
  };
}

function makeLlmClient(sink: { chars: number }): LlmClient | undefined {
  if (llmMode === "off") return undefined;
  if (llmMode === "dry") return makeDryClient(sink);
  return createAnthropicLlm({
    apiKey: anthropicKey ?? "replay",
    fetch: llmFetch,
  });
}

// --- 실행 ------------------------------------------------------------------

async function runOne(url: string): Promise<RunRecord> {
  const counter = { n: 0, wait_ms: 0 };
  const sink = { chars: 0 };
  const result = await runPipeline(url, {
    fetch: makeFetch(counter),
    llm: makeLlmClient(sink),
  });
  const llm: LlmRecord | undefined = result.llm
    ? {
        rule: result.llm.rule,
        outcome: result.llm.outcome,
        calls: result.llm.calls,
        selector: result.llm.selector,
        reasons: result.llm.reasons,
        input_tokens: result.llm.usage?.input_tokens ?? 0,
        output_tokens: result.llm.usage?.output_tokens ?? 0,
        cost_usd: result.llm.usage?.cost_usd ?? 0,
        ms: result.llm.ms,
        prompt_chars: sink.chars,
      }
    : undefined;
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
      quality_flags: [],
      content_chars: 0,
      ...(llm ? { llm } : {}),
    };
  }
  return {
    ...base,
    ...(llm ? { llm } : {}),
    ok: true,
    title: result.title,
    tier: result.tier,
    status: result.status,
    quality_score: result.quality_score,
    quality_flags: result.quality_flags ?? [],
    content_chars: result.content_chars,
    content_markdown: result.content_markdown,
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

// --- LLM 강제 평가 · 부분 문자열 검사 ----------------------------------------

const FORCE_RULE_REASON = "평가 모드: 규칙 결과와 무관하게 본문 위치를 평가";

interface ForceRecord {
  url: string;
  platform: string;
  // runLlmFallback의 outcome, 또는 평가에서 뺀 경우 excluded
  outcome: string;
  selector?: string;
  reasons: string[];
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  ms: number;
  prompt_chars: number;
  content_markdown?: string;
  excluded?: string;
}

/** 라벨이 있는 블로그 글. 노션은 HTML이 클라이언트 렌더링이라 LLM 대상이 아니다 */
function forceTargets(sets: BenchSet[]): string[] {
  const urls = new Set<string>();
  for (const set of sets) {
    for (const it of set.items) {
      if (it.label && platformOf(it.url) !== "notion") urls.add(it.url);
    }
  }
  return [...urls];
}

async function runForceOne(url: string): Promise<ForceRecord> {
  const counter = { n: 0, wait_ms: 0 };
  const base = {
    url,
    platform: platformOf(url),
    reasons: [] as string[],
    calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    ms: 0,
    prompt_chars: 0,
  };
  let html: string;
  try {
    html = await fetchBlogHtml(url, makeFetch(counter));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      outcome: "excluded",
      excluded: `html 없음: ${message.slice(0, 80)}`,
    };
  }
  // 파이프라인도 보호글에는 LLM을 부르지 않는다
  try {
    extractBlog(html);
  } catch (err) {
    if (err instanceof ParseError && err.code === "PROTECTED_POST") {
      return { ...base, outcome: "excluded", excluded: "PROTECTED_POST" };
    }
  }
  const sink = { chars: 0 };
  const startedAt = performance.now();
  const r = await runLlmFallback(html, FORCE_RULE_REASON, makeLlmClient(sink)!);
  return {
    ...base,
    outcome: r.outcome,
    selector: r.selector,
    reasons: r.reasons,
    calls: r.calls,
    input_tokens: r.usage?.input_tokens ?? 0,
    output_tokens: r.usage?.output_tokens ?? 0,
    cost_usd: r.usage?.cost_usd ?? 0,
    ms: Math.round(performance.now() - startedAt),
    prompt_chars: sink.chars,
    content_markdown: r.parsed?.content_markdown,
  };
}

async function runPool<T>(
  items: string[],
  fn: (item: string) => Promise<T>,
): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      out.set(item, await fn(item));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

interface SubstringResult {
  url: string;
  source: "pipeline" | "force";
  // null이면 원문 HTML을 읽지 못해 검사하지 못함
  lines: number | null;
  missing: string[];
}

/** 스냅샷에 있는 원문 HTML만 읽는 fetch. 없으면 던진다 */
const snapshotOnlyFetch: typeof fetch = async (input, init) => {
  const snap: Snapshot = JSON.parse(
    await Deno.readTextFile(await snapshotPath(describeRequest(input, init))),
  );
  if (snap.error) throw new TypeError(snap.error);
  return new Response(decodeBase64(snap.body_base64 ?? ""), {
    status: snap.status,
    headers: snap.content_type ? { "content-type": snap.content_type } : {},
  });
};

/**
 * LLM 경로로 만든 본문의 5자 이상 줄이 모두 원문 DOM(template을 펼친 문서)의 보이는 텍스트에
 * 들어 있는지 확인한다. 셀렉터 방식이라 항상 참이어야 한다.
 */
async function checkSubstring(
  url: string,
  source: "pipeline" | "force",
  markdown: string,
): Promise<SubstringResult> {
  try {
    const html = await fetchBlogHtml(url, snapshotOnlyFetch);
    const doc = prepareDocument(html);
    if (!doc) return { url, source, lines: null, missing: [] };
    // DOM 쪽은 toPlain을 쓰지 않는다: 마크다운 문법 제거 정규식이 줄 머리의 "1. "을
    // 목록 표시로 지워 비교가 어긋난다. script·style 텍스트도 뺀다.
    // 꺾쇠는 양쪽에서 똑같이 뺀다: 원문의 "A <-> B"를 toPlain이 HTML 태그로 보고 지우기 때문
    const text = pageText(doc)
      .replace(/[<>\s_*]/g, "")
      .toLowerCase();
    const lines = markdown
      .split("\n")
      .map((l) => normalizeForMatch(l.replace(/[<>]/g, "")))
      .filter((l) => l.length >= 5);
    return {
      url,
      source,
      lines: lines.length,
      missing: lines.filter((l) => !text.includes(l)),
    };
  } catch {
    return { url, source, lines: null, missing: [] };
  }
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
    `조용한 실패 신호(성공 건 기준): 본문 ${MIN_TEXT_CHARS}자 미만에 이미지 없음(low_text), 보일러플레이트 줄 2줄 이상(boilerplate) — 기준은 quality.ts`,
  );
  out.push("");
  out.push("| 플랫폼 | 실패율 | low_text | boilerplate |");
  out.push("| --- | --- | --- | --- |");
  const byPlatform = groupBy(recs, (r) => r.platform);
  const silent = (rs: RunRecord[]) => {
    const ok = rs.filter((r) => r.ok);
    const short = ok.filter((r) => r.quality_flags.includes("low_text"));
    const dirty = ok.filter((r) => r.quality_flags.includes("boilerplate"));
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

  out.push("### 추출 단계(tier) 분포");
  out.push("| tier | 건수 | 품질 플래그 |");
  out.push("| --- | --- | --- |");
  for (const [tier, rs] of [
    ...groupBy(recs, (r) => (r.ok ? (r.tier ?? "—") : "실패")),
  ].sort((a, b) => b[1].length - a[1].length)) {
    const flagged = rs.filter((r) => r.quality_flags.length).length;
    out.push(
      `| ${tier} | ${pct(rs.length, recs.length)} | ${flagged > 0 ? flagged : "—"} |`,
    );
  }
  out.push("");

  // 저장 결과 분포: 파이프라인 status. 실패는 링크만 저장된다
  const degraded = recs.filter((r) => r.ok && r.status === "degraded");
  out.push("### 저장 상태 분포");
  out.push(`degraded 기준: 품질 점수 ${DEGRADED_BELOW} 미만 (본문은 저장)`);
  out.push("");
  out.push("| 플랫폼 | ok | degraded | failed |");
  out.push("| --- | --- | --- | --- |");
  const statusRow = (rs: RunRecord[]) => {
    const n = rs.length;
    const d = rs.filter((r) => r.ok && r.status === "degraded").length;
    const f = rs.filter((r) => !r.ok).length;
    return `${pct(n - d - f, n)} | ${pct(d, n)} | ${pct(f, n)}`;
  };
  for (const [platform, rs] of [...byPlatform].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    out.push(`| ${platform} | ${statusRow(rs)} |`);
  }
  out.push(`| **전체** | ${statusRow(recs)} |`);
  out.push("");
  const flagCounts = groupBy(
    recs
      .filter((r) => r.ok)
      .flatMap((r) => r.quality_flags.map((f) => ({ f }))),
    (x) => x.f,
  );
  if (flagCounts.size > 0) {
    out.push(
      `플래그 분포(성공 ${recs.filter((r) => r.ok).length}건 기준): ${[
        ...flagCounts,
      ]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([f, xs]) => `${f} ${xs.length}`)
        .join(" · ")}`,
    );
    out.push("");
  }
  if (degraded.length > 0) {
    out.push("<details><summary>degraded 목록</summary>");
    out.push("");
    out.push("| URL | tier | score | 플래그 | 글자 수 |");
    out.push("| --- | --- | --- | --- | --- |");
    for (const r of degraded) {
      out.push(
        `| ${r.url} | ${r.tier} | ${r.quality_score} | ${r.quality_flags.join(", ")} | ${r.content_chars} |`,
      );
    }
    out.push("");
    out.push("</details>");
    out.push("");
  }

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
      `기준: 첫 문장 포함 + 마지막 문장 포함 + 글자 수 ±${CHAR_TOLERANCE * 100}% + boilerplate 플래그 없음. expect_failure 라벨은 파이프라인이 실패해야 합격`,
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
                !v.clean && "보일러플레이트",
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

  if (llmMode !== "off") out.push(...renderLlmSet(recs));

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

// --- LLM 리포트 ---------------------------------------------------------------

function won(usd: number): string {
  return `$${usd.toFixed(5)}`;
}

/** dry 모드의 예상 비용. 출력은 thinking 포함 400토큰, 입력은 글자 ÷ 2(한글 기준 보수적)로 가정한다 */
const DRY_OUTPUT_TOKENS = 400;
const DRY_CHARS_PER_TOKEN = 2;
function dryEstimate(promptChars: number, calls: number) {
  const input = Math.ceil(promptChars / DRY_CHARS_PER_TOKEN);
  const usd =
    (input * PRICE_INPUT_PER_MTOK +
      DRY_OUTPUT_TOKENS * calls * PRICE_OUTPUT_PER_MTOK) /
    1_000_000;
  return { input, usd };
}

function renderLlmSet(recs: RunRecord[]): string[] {
  const n = recs.length;
  const targets = recs.filter((r) => r.llm);
  const skipped = targets.filter((r) => r.llm!.outcome === "skipped");
  const called = targets.filter((r) => r.llm!.calls > 0);
  const recovered = targets.filter((r) => r.llm!.outcome === "recovered");
  const retried = called.filter((r) => r.llm!.calls > 1);
  const cost = targets.reduce((sum, r) => sum + r.llm!.cost_usd, 0);
  const out: string[] = [];
  out.push("### LLM 폴백");
  out.push(
    llmMode === "dry"
      ? "dry 모드: 호출하지 않았다. 호출 URL은 '호출될 URL', 비용은 추정이다."
      : `모드 ${llmMode} · 모델 ${LLM_MODEL}`,
  );
  out.push("");
  out.push("| 항목 | 값 |");
  out.push("| --- | --- |");
  out.push(
    `| 대상 (블로그 규칙 실패·빈 본문·degraded) | ${pct(targets.length, n)} |`,
  );
  out.push(
    `| 사전 필터로 건너뜀 (보이는 텍스트 ${MIN_TEXT_CHARS}자 미만) | ${pct(skipped.length, targets.length)} |`,
  );
  out.push(`| 호출률 (호출된 URL / 세트 전체) | ${pct(called.length, n)} |`);
  if (llmMode !== "dry") {
    out.push(`| 복구 / 호출 | ${pct(recovered.length, called.length)} |`);
    out.push(`| 복구 / 대상 | ${pct(recovered.length, targets.length)} |`);
    out.push(
      `| 재요청 (호출 중 2회 호출) | ${pct(retried.length, called.length)} |`,
    );
    const outcomes = [...groupBy(targets, (r) => r.llm!.outcome)]
      .map(([k, v]) => `${k} ${v.length}`)
      .join(" · ");
    out.push(`| 결과 분포 | ${outcomes || "—"} |`);
    const errs = [
      ...groupBy(
        targets.flatMap((r) =>
          r.llm!.reasons.filter((x) => x.startsWith("llm_error=")),
        ),
        (x) => x,
      ),
    ]
      .map(([k, v]) => `${k} ${v.length}`)
      .join(" · ");
    out.push(`| 호출 오류 | ${errs || "—"} |`);
    out.push(
      `| 호출 1건당 평균 비용 | ${called.length ? won(cost / called.length) : "—"} |`,
    );
    out.push(`| 파싱 100건당 비용 | ${n ? won((cost / n) * 100) : "—"} |`);
    const tokIn = called.reduce((a, r) => a + r.llm!.input_tokens, 0);
    const tokOut = called.reduce((a, r) => a + r.llm!.output_tokens, 0);
    out.push(
      `| 호출 1건당 평균 토큰 (입력/출력) | ${called.length ? `${Math.round(tokIn / called.length)} / ${Math.round(tokOut / called.length)}` : "—"} |`,
    );
    if (llmMode === "live" && called.length > 0) {
      const ms = called.map((r) => r.llm!.ms);
      out.push(
        `| LLM 단계 추가 지연 p50 / p95 | ${percentile(ms, 50)}ms / ${percentile(ms, 95)}ms |`,
      );
    }
  } else {
    const chars = called.reduce((a, r) => a + r.llm!.prompt_chars, 0);
    const e = dryEstimate(chars, called.length);
    out.push(
      `| 호출될 URL | ${called.length}건 (재요청까지 최대 ${called.length * 2}회) |`,
    );
    out.push(`| 예상 입력 토큰 (글자 ÷ 2) | 약 ${e.input} |`);
    out.push(
      `| 예상 비용 (1회씩 / 재요청 포함 상한) | ${won(e.usd)} / ${won(e.usd * 2)} |`,
    );
  }
  out.push("");
  if (targets.length > 0) {
    out.push(
      "| URL | 규칙 결과 | LLM | 셀렉터 | 호출 | 글자 수 | 비용 | 사유 |",
    );
    out.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const r of targets) {
      const l = r.llm!;
      const what = llmMode === "dry" && l.calls > 0 ? "호출될 URL" : l.outcome;
      out.push(
        `| ${r.url} | ${l.rule} | ${what} | ${l.selector ? `\`${l.selector.replace(/\|/g, "\\|")}\`` : "—"} | ${l.calls} | ${r.ok ? r.content_chars : "—"} | ${l.cost_usd ? won(l.cost_usd) : "—"} | ${l.reasons.join("; ").replace(/\|/g, "\\|").slice(0, 100)} |`,
      );
    }
    out.push("");
  }
  return out;
}

function renderLlmGlobal(
  sets: BenchSet[],
  results: Map<string, RunRecord>,
  force: Map<string, ForceRecord>,
  subs: SubstringResult[],
): string {
  const out: string[] = [];
  out.push("## LLM 폴백 요약");
  out.push("");
  const natural = [...results.values()].filter((r) => r.llm);
  const naturalCost = natural.reduce((a, r) => a + r.llm!.cost_usd, 0);
  const forceCost = [...force.values()].reduce((a, r) => a + r.cost_usd, 0);
  out.push("| 항목 | 값 |");
  out.push("| --- | --- |");
  out.push(`| 모드 / 모델 | ${llmMode} / ${LLM_MODEL} |`);
  out.push(
    `| 단가 (프롬프트 10만 토큰 이하) | 입력 $${PRICE_INPUT_PER_MTOK} · 출력 $${PRICE_OUTPUT_PER_MTOK} / MTok |`,
  );
  out.push(
    `| 실제 API 호출 (상한 ${llmMaxCalls}) | ${llmStats.live_calls}회 · 스냅샷 재사용 ${llmStats.cached}회 · 상한으로 막힘 ${llmStats.blocked}회 |`,
  );
  if (llmMode !== "dry") {
    out.push(
      `| 계산상 비용 (토큰 × 단가, 재사용 포함) | 일반 경로 ${won(naturalCost)} · 강제 평가 ${won(forceCost)} |`,
    );
  }
  out.push("");

  if (llmForce) {
    const recs = [...force.values()];
    const evaluated = recs.filter((r) => r.outcome !== "excluded");
    out.push("## LLM tier 골든 정확도 (강제 평가)");
    out.push(
      "규칙 결과와 무관하게 라벨 있는 블로그 글(노션·보호글 제외)에 LLM을 돌려 골든 기준(첫 문장·마지막 문장·글자 수 ±20%·boilerplate 없음)으로 채점한다. expect_failure 라벨은 LLM이 복구하지 않아야 합격.",
    );
    out.push("");
    if (llmMode === "dry") {
      const chars = evaluated.reduce((a, r) => a + r.prompt_chars, 0);
      const calls = evaluated.filter((r) => r.calls > 0).length;
      const e = dryEstimate(chars, calls);
      out.push(
        `dry: 호출될 URL ${calls}건 (최대 ${calls * 2}회) · 예상 입력 토큰 약 ${e.input} · 예상 비용 ${won(e.usd)} / 재요청 포함 상한 ${won(e.usd * 2)}`,
      );
      out.push("");
    } else {
      const labelOf = new Map<string, GoldenLabel>();
      const setOf = new Map<string, string>();
      for (const set of sets) {
        for (const it of set.items) {
          if (it.label && !labelOf.has(it.url)) {
            labelOf.set(it.url, it.label);
            setOf.set(it.url, set.name);
          }
        }
      }
      const rows = evaluated.map((r) => {
        const label = labelOf.get(r.url)!;
        const rec: RunRecord = {
          url: r.url,
          platform: r.platform,
          ok: r.outcome === "recovered",
          duration_ms: r.ms,
          throttle_ms: 0,
          fetch_count: 1,
          quality_flags: [],
          content_chars: 0,
          content_markdown: r.content_markdown,
        };
        if (r.content_markdown) {
          const q = assessQuality({
            markdown: r.content_markdown,
            tier: "llm",
          });
          rec.quality_flags = q.flags;
          rec.content_chars = q.plain_chars;
        }
        return { r, label, rec, v: judgeGolden(rec, label) };
      });
      const normal = rows.filter((x) => !x.label.expect_failure);
      const mustFail = rows.filter((x) => x.label.expect_failure);
      out.push(
        `- 정확도 (정상 글 전체): **${pct(normal.filter((x) => x.v.pass).length, normal.length)}**`,
      );
      for (const [name, xs] of groupBy(
        normal,
        (x) => setOf.get(x.r.url) ?? "?",
      )) {
        out.push(
          `  - 세트 ${name}: ${pct(xs.filter((x) => x.v.pass).length, xs.length)}`,
        );
      }
      out.push(
        `- 오염된 본문을 고른 건 (boilerplate 플래그): ${normal.filter((x) => x.rec.ok && !x.v.clean).length}건`,
      );
      out.push(
        `- 복구하면 안 되는 글(expect_failure)을 잘못 복구한 건: ${mustFail.filter((x) => x.rec.ok).length} / ${mustFail.length}건`,
      );
      out.push(
        `- 평가에서 뺀 글: ${recs.length - evaluated.length}건 (${
          recs
            .filter((r) => r.excluded)
            .map((r) => `${r.url} ${r.excluded}`)
            .join(", ") || "—"
        })`,
      );
      out.push(
        `- 재요청한 글: ${evaluated.filter((r) => r.calls > 1).length}건 · 총 비용 ${won(forceCost)} · 호출 1건당 평균 ${won(
          forceCost /
            Math.max(
              1,
              evaluated.reduce((a, r) => a + r.calls, 0),
            ),
        )}`,
      );
      out.push("");
      out.push(
        "| URL | 결과 | 셀렉터 | 첫 문장 | 마지막 문장 | 글자 수 | 깨끗함 | 합격 | 호출 | 사유 |",
      );
      out.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
      const tick = (b: boolean) => (b ? "✓" : "✗");
      for (const { r, label, v } of rows) {
        out.push(
          `| ${r.url}${label.expect_failure ? " (실패해야 함)" : ""} | ${r.outcome} | ${r.selector ? `\`${r.selector.replace(/\|/g, "\\|")}\`` : "—"} | ${tick(v.first)} | ${tick(v.last)} | ${tick(v.chars)} | ${tick(v.clean)} | ${tick(v.pass)} | ${r.calls} | ${r.reasons.join("; ").replace(/\|/g, "\\|").slice(0, 100)} |`,
        );
      }
      out.push("");
    }
  }

  if (subs.length > 0) {
    const checked = subs.filter((x) => x.lines !== null);
    const clean = checked.filter((x) => x.missing.length === 0);
    const totalLines = checked.reduce((a, x) => a + (x.lines ?? 0), 0);
    const missingLines = checked.reduce((a, x) => a + x.missing.length, 0);
    out.push("## LLM 경로 본문의 원문 DOM 부분 문자열 검사");
    out.push(
      "LLM 경로(tier=llm)로 만든 본문의 5자 이상 줄이 모두 원문 DOM(template 펼침)의 보이는 텍스트에 들어 있는지 확인한다. 완료 기준: 전부 참.",
    );
    out.push("");
    out.push(
      `- 결과 **${clean.length}/${checked.length}** 통과 · 줄 **${totalLines - missingLines}/${totalLines}**${checked.length < subs.length ? ` · 원문 HTML을 읽지 못해 검사 못 한 결과 ${subs.length - checked.length}건` : ""}`,
    );
    for (const x of checked.filter((c) => c.missing.length > 0)) {
      out.push(
        `- ✗ ${x.url} (${x.source}): 빠진 줄 ${x.missing.length}개 — ${x.missing
          .slice(0, 3)
          .map((m) => m.slice(0, 40))
          .join(" | ")}`,
      );
    }
    out.push("");
  }
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

// LLM 강제 평가와 부분 문자열 검사 (--llm 이 off가 아닐 때만)
const forceResults = llmForce
  ? await runPool(forceTargets(sets), runForceOne)
  : new Map<string, ForceRecord>();
const substringResults: SubstringResult[] = [];
if (llmMode !== "off" && llmMode !== "dry") {
  for (const r of results.values()) {
    if (r.ok && r.content_markdown && r.tier === "llm") {
      substringResults.push(
        await checkSubstring(r.url, "pipeline", r.content_markdown),
      );
    }
  }
  for (const r of forceResults.values()) {
    if (r.content_markdown) {
      substringResults.push(
        await checkSubstring(r.url, "force", r.content_markdown),
      );
    }
  }
}
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
        llm: {
          mode: llmMode,
          model: LLM_MODEL,
          max_calls: llmMaxCalls,
          force: llmForce,
          stats: llmStats,
        },
      },
      results: [...results.values()],
      force: [...forceResults.values()],
      substring: substringResults,
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
  ...(llmMode === "off"
    ? []
    : [renderLlmGlobal(sets, results, forceResults, substringResults)]),
].join("\n");
await Deno.writeTextFile(`${stem}.md`, report);
console.error(`\n리포트: ${stem}.md`);
