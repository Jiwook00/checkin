// 리마인더 평가 하네스 (Deno 2.x, #74)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/eval/harness.ts run [--provider claude|ollama|echo] [--model <id>] \
//       [--subset dev|tune|holdout|all] [--only <caseId>]... [--stages <a,b>] [--max-tokens N] [--dry-run]
//       [--cache [a,b]] [--label <name>] [--judge-provider claude-cli|claude] [--judge-model <id>]
//
//   deno run ... scripts/eval/harness.ts compare <runA> <runB> [--subset dev|tune|holdout]
//
// - 평가셋은 local/eval/dataset/ (scripts/eval-dataset.ts가 만든다)에서 읽는다. DB에는 접근하지 않는다
// - 기본값: --provider echo, --subset dev, --max-tokens 200000. --only는 여러 번 줄 수 있고 --subset보다 우선한다
// - --subset은 subset-<이름>.json의 id 목록이다 (dev: 개발용 20건, tune: 프롬프트 개선에 쓰는 40건, holdout: 나머지 171건).
//   서브셋 파일은 cases.json을 건드리지 않으므로 casesSha256이 바뀌지 않는다
// - case-notes.json이 있으면 case에 notes를 붙인다 (해시 계산 뒤라 평가셋 해시 불변). 단계 입력에는 넣지 않고 채점기만 본다
// - --stages: 실행할 단계를 쉼표로 이어 순서대로 쓴다 (stages.ts의 STAGES 이름, 기본 extract). 앞 단계 출력이 뒤 단계 입력(prev)으로 넘어간다
// - 채점처럼 role이 judge인 단계는 --judge-provider·--judge-model로 만든 provider로 부른다 (기본 claude-cli · claude-sonnet-5-5).
//   claude-cli는 구독 사용량이라 청구가 없다: 비용은 API 환산으로만 보고하고 --max-tokens 상한에서 뺀다
// - 호출 캐시: 성공한 호출은 항상 local/eval/cache/calls/<key>.json에 쓴다. --cache를 줘야 읽는다 (측정 run은 항상 새로 호출해야 하므로
//   기본은 읽지 않는다). --cache만 주면 모든 단계, --cache extract,generate처럼 단계를 주면 그 단계만 읽는다
//   (생성 흔들림과 채점 흔들림을 따로 재려고: 앞 단계는 캐시, 재고 싶은 단계만 새로 호출).
//   키 = sha256(provider · model · cacheTag · 요청 전체)라서 본문·system·스키마·max_tokens 중 하나라도 바뀌면 다른 키다.
//   적중한 호출은 토큰·상한에서 빼고 기록에 cached: true로 남기며, 지연 통계에서도 뺀다. dry-run은 캐시를 읽지도 쓰지도 않는다
// - 결과: local/eval/runs/<runId>/config.json    (모델, 단계별 프롬프트 해시, 평가셋 해시, 선택한 case)
//         local/eval/runs/<runId>/records.jsonl  (case × 단계마다 한 줄. 끝나는 즉시 덧붙이므로 중단돼도 남는다)
//         local/eval/runs/<runId>/summary.json   (종료 상태, 토큰, 비용, 단계별 통계와 채점기 평균)
//   local/은 git 제외다. 회고 원문이 들어가므로 이 밖으로 내보내지 않는다
// - --max-tokens: 누적(입력+출력) + 이번 호출의 입력 추정 + max_tokens가 상한을 넘으면 호출하지 않고 멈춘다.
//   상한을 넘기지 않는 대신 출력 상한(max_tokens)만큼 여유를 남기고 멈추므로 보수적이다. 멈추면 exit 2
// - --dry-run: 호출하지 않고 파이프라인을 끝까지 돌며 예상 입력 토큰과 비용 상한을 출력한다 (기록 폴더 없음).
//   입력 토큰은 글자 수 + 요청당 40 추정(한글 기준 실측 상한)이다. 뒤 단계 입력에 앞 단계 출력이 들어가는 경우, 단계가 dryRunText로
//   준 "전형적인 출력"으로 이어간다 (안 주면 입력을 그대로 돌려줘서 뒤 단계가 실제보다 작게 추정된다)
// - 실행은 case를 하나씩 순서대로 한다 (누적 토큰과 기록 순서가 결정적이 되도록)
// - compare: 두 run(runId 또는 폴더 경로)의 설정 차이, 단계별 점수·토큰·지연·비용 차이, 점수가 바뀐 case를 마크다운으로
//   출력하고 <runB>/compare-<runA>.md에도 저장한다. 평가셋 해시가 다르면 맨 위에 경고한다.
//   단계별 표는 두 run에 모두 있는 case만 쓴다 (한쪽이 상한으로 중단됐을 때 공정하게 비교하려고)

import {
  costUsd,
  createClaudeCliProvider,
  createClaudeProvider,
  createEchoProvider,
  createOllamaProvider,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_JUDGE_MODEL,
  estimateTokens,
  LLMError,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
  loadApiKey,
  type Price,
} from "./llm.ts";
import { type AnyStage, type Score, STAGES } from "./stages.ts";
import type { EvalCase } from "./types.ts";

const ROOT = new URL("../..", import.meta.url).pathname;
const DATASET_DIR = `${ROOT}local/eval/dataset`;
const RUNS_DIR = `${ROOT}local/eval/runs`;
const CACHE_DIR = `${ROOT}local/eval/cache/calls`;

const DEFAULT_MAX_TOKENS = 200_000;
const DEFAULT_PIPELINE = ["extract"];

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  Deno.exit(1);
}

// --- 유틸 ---------------------------------------------------------------------

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function git(args: string[]): Promise<string> {
  try {
    const out = await new Deno.Command("git", { args, cwd: ROOT }).output();
    return new TextDecoder().decode(out.stdout).trim();
  } catch {
    return "";
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// --- 인자 ---------------------------------------------------------------------

const VALUE_FLAGS = [
  "--provider",
  "--model",
  "--subset",
  "--only",
  "--max-tokens",
  "--label",
  "--stages",
  "--judge-provider",
  "--judge-model",
];
const BOOLEAN_FLAGS = ["--dry-run"];
const SUBSETS = ["dev", "tune", "holdout", "all"] as const;
type SubsetName = (typeof SUBSETS)[number];

interface RunOptions {
  provider: "claude" | "ollama" | "echo";
  model?: string;
  subset: SubsetName;
  only: string[];
  stages: string[];
  maxTokens: number;
  dryRun: boolean;
  // true: 모든 단계에서 캐시를 읽는다 / 배열: 그 단계만 / false: 읽지 않는다
  cache: boolean | string[];
  label: string;
  judgeProvider: "claude-cli" | "claude";
  judgeModel: string;
}

function parseRunOptions(args: string[]): RunOptions {
  const values = new Map<string, string[]>();
  let cache: boolean | string[] = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (BOOLEAN_FLAGS.includes(a)) continue;
    // --cache는 값이 있어도 없어도 된다: 뒤에 --로 시작하지 않는 인자가 있으면 단계 목록으로 읽는다
    if (a === "--cache") {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        cache = next.split(",").map((s) => s.trim());
        i++;
      } else {
        cache = true;
      }
      continue;
    }
    if (!VALUE_FLAGS.includes(a)) die(`알 수 없는 인자: ${a}`);
    const v = args[++i];
    if (v === undefined || v.startsWith("--")) die(`${a}에 값이 필요해요.`);
    values.set(a, [...(values.get(a) ?? []), v]);
  }
  const one = (name: string) => values.get(name)?.at(-1);

  const provider = one("--provider") ?? "echo";
  if (provider !== "claude" && provider !== "ollama" && provider !== "echo") {
    die(`--provider는 claude | ollama | echo 중 하나예요: ${provider}`);
  }
  const subset = one("--subset") ?? "dev";
  if (!(SUBSETS as readonly string[]).includes(subset)) {
    die(`--subset은 ${SUBSETS.join(" | ")} 중 하나예요: ${subset}`);
  }
  const judgeProvider = one("--judge-provider") ?? "claude-cli";
  if (judgeProvider !== "claude-cli" && judgeProvider !== "claude") {
    die(`--judge-provider는 claude-cli | claude 중 하나예요: ${judgeProvider}`);
  }
  const maxTokens = Number(one("--max-tokens") ?? DEFAULT_MAX_TOKENS);
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    die(`--max-tokens는 양의 정수여야 해요: ${one("--max-tokens")}`);
  }
  const label = one("--label") ?? "";
  if (label && !/^[\w.-]+$/.test(label)) {
    die(`--label에는 영문·숫자·_ . - 만 쓸 수 있어요: ${label}`);
  }
  const stages = one("--stages")
    ? one("--stages")!
        .split(",")
        .map((s) => s.trim())
    : DEFAULT_PIPELINE;
  for (const name of stages) {
    if (!STAGES[name]) {
      die(
        `알 수 없는 단계예요: ${name || "(빈 값)"}. 쓸 수 있는 단계: ${Object.keys(STAGES).join(", ")}`,
      );
    }
  }
  if (Array.isArray(cache)) {
    for (const name of cache) {
      if (!stages.includes(name)) {
        die(
          `--cache에 준 단계가 이번 --stages에 없어요: ${name || "(빈 값)"} (이번 단계: ${stages.join(", ")})`,
        );
      }
    }
  }
  return {
    provider,
    model: one("--model"),
    subset: subset as SubsetName,
    only: values.get("--only") ?? [],
    stages,
    maxTokens,
    dryRun: args.includes("--dry-run"),
    cache,
    label,
    judgeProvider,
    judgeModel: one("--judge-model") ?? DEFAULT_JUDGE_MODEL,
  };
}

// --- 평가셋 -------------------------------------------------------------------

interface Manifest {
  generatedAt: string;
  caseIdsSha256: string;
  casesSha256: string;
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await Deno.readTextFile(path)) as T;
  } catch {
    die(
      `${path}를 읽을 수 없어요. 먼저 scripts/eval-dataset.ts로 평가셋을 만들어 주세요.`,
    );
  }
}

/** subset-<name>.json의 id 목록. 없으면 만드는 방법을 알려준다 */
async function loadSubsetIds(name: string): Promise<string[]> {
  const path = `${DATASET_DIR}/subset-${name}.json`;
  let raw: string;
  try {
    raw = await Deno.readTextFile(path);
  } catch {
    die(
      `${path}를 읽을 수 없어요. dev는 scripts/eval-dataset.ts, tune·holdout은 scripts/eval-dataset.ts --split으로 만들어요.`,
    );
  }
  return (JSON.parse(raw) as { ids: string[] }).ids;
}

async function loadDataset(opts: RunOptions) {
  const cases = await readJson<EvalCase[]>(`${DATASET_DIR}/cases.json`);
  const manifest = await readJson<Manifest>(`${DATASET_DIR}/manifest.json`);

  // eval-dataset.ts와 같은 계산이다. 다르면 cases.json이 manifest 이후에 바뀐 것
  const casesSha256 = await sha256(JSON.stringify(cases));
  const caseIdsSha256 = await sha256(cases.map((c) => c.id).join("\n"));
  if (
    casesSha256 !== manifest.casesSha256 ||
    caseIdsSha256 !== manifest.caseIdsSha256
  ) {
    console.warn(
      "! cases.json이 manifest.json과 달라요. 평가셋을 다시 만들었는지 확인하세요 (scripts/eval-dataset.ts --check).",
    );
  }

  // case 메모는 해시를 계산한 뒤에 붙인다 (메모를 고쳐도 평가셋 해시가 바뀌지 않는다)
  let notes: Record<string, string[]> = {};
  let notesSha256: string | null = null;
  try {
    const raw = await Deno.readTextFile(`${DATASET_DIR}/case-notes.json`);
    notes = JSON.parse(raw) as Record<string, string[]>;
    notesSha256 = await sha256(JSON.stringify(notes));
  } catch {
    // 없으면 메모 없이 진행
  }
  for (const c of cases) {
    if (notes[c.id]) c.notes = notes[c.id];
  }

  const byId = new Map(cases.map((c) => [c.id, c]));
  const pick = (ids: string[], what: string) =>
    ids.map((id) => {
      const c = byId.get(id);
      if (!c) die(`${what}의 case가 cases.json에 없어요: ${id}`);
      return c;
    });
  let selected: EvalCase[];
  let selection: SubsetName | "only";
  if (opts.only.length > 0) {
    selection = "only";
    selected = pick([...new Set(opts.only)], "--only");
  } else if (opts.subset === "all") {
    selection = "all";
    selected = cases;
  } else {
    selection = opts.subset;
    selected = pick(await loadSubsetIds(opts.subset), `subset-${opts.subset}`);
  }
  return {
    selected,
    dataset: {
      casesSha256,
      caseIdsSha256,
      manifestGeneratedAt: manifest.generatedAt,
      notesSha256,
      selection,
      caseIds: selected.map((c) => c.id),
    },
  };
}

// --- provider · 예산 ------------------------------------------------------------

async function makeProvider(opts: RunOptions): Promise<LLMProvider> {
  if (opts.provider === "echo") return createEchoProvider();
  if (opts.provider === "ollama") {
    if (!opts.model)
      die("--provider ollama는 --model이 필요해요 (예: qwen2.5:7b).");
    return createOllamaProvider({ model: opts.model });
  }
  // dry-run은 호출하지 않으므로 키가 없어도 단가·모델만 쓴다
  const apiKey = opts.dryRun ? "dry-run" : await loadApiKey();
  if (!apiKey) {
    die(
      "ANTHROPIC_API_KEY가 없어요. 셸 환경변수나 프로젝트 루트 .env에 넣어 주세요.",
    );
  }
  try {
    return createClaudeProvider({
      apiKey,
      model: opts.model ?? DEFAULT_CLAUDE_MODEL,
    });
  } catch (err) {
    die((err as Error).message);
  }
}

// role이 judge인 단계를 부르는 provider. judge 단계가 없으면 만들지 않는다
async function makeJudgeProvider(opts: RunOptions): Promise<LLMProvider> {
  try {
    if (opts.judgeProvider === "claude-cli") {
      return await createClaudeCliProvider({ model: opts.judgeModel });
    }
    const apiKey = opts.dryRun ? "dry-run" : await loadApiKey();
    if (!apiKey) {
      die(
        "ANTHROPIC_API_KEY가 없어요. --judge-provider claude는 API 키가 필요해요 (구독으로 돌리려면 claude-cli).",
      );
    }
    return createClaudeProvider({ apiKey, model: opts.judgeModel });
  } catch (err) {
    die((err as Error).message);
  }
}

class BudgetStop extends Error {
  constructor(
    readonly used: number,
    readonly needed: number,
    readonly limit: number,
  ) {
    super(`토큰 상한 ${limit} (누적 ${used} + 이번 호출 최대 ${needed})`);
    this.name = "BudgetStop";
  }
}

// 호출 캐시 파일: 키에 쓴 요청과 응답을 그대로 남긴다 (local/은 git 제외)
interface CacheEntry {
  key: string;
  provider: string;
  model: string;
  createdAt: string;
  response: LLMResponse;
}

type MeteredResponse = LLMResponse & { cached?: boolean };

// --max-tokens 상한. provider가 둘이어도(생성 + 채점) 한 상한을 같이 쓴다.
// 구독 provider(billing: subscription)의 호출은 청구되지 않으므로 세지 않는다
class Budget {
  used = 0;
  // dry-run: 최악의 경우(추정 입력 + max_tokens) 누적과, 상한을 처음 넘는 호출 번호
  worstCase = 0;
  billedCalls = 0;
  exceedsAtCall: number | null = null;
  constructor(readonly limit: number) {}
}

// 모든 LLM 호출이 지나는 곳. 캐시, 상한 검사, 토큰 집계, 호출 기록을 여기서 한다 (provider마다 하나)
class Meter {
  input = 0;
  output = 0;
  estimatedInput = 0;
  // 실제로 provider를 부른 횟수 (캐시 적중은 세지 않는다)
  calls = 0;
  cacheHits = 0;
  // 첫 호출이 끝난 직후의 provider 자원 상태 (모델이 막 로드된 상태라 메모리를 보기 좋다)
  firstSnapshot: Record<string, unknown> | undefined;
  worstCaseOutput = 0;

  constructor(
    readonly provider: LLMProvider,
    private budget: Budget,
    private dryRun: boolean,
  ) {}

  get billed() {
    return this.provider.billing !== "subscription";
  }

  private async cacheKey(req: LLMRequest): Promise<string> {
    return await sha256(
      [
        this.provider.name,
        this.provider.model,
        this.provider.cacheTag ?? "",
        JSON.stringify(req),
      ].join("\n"),
    );
  }

  async call(
    req: LLMRequest,
    opts: { readCache: boolean; dryRunText?: string },
  ): Promise<MeteredResponse> {
    const estimate =
      estimateTokens(req) + (this.provider.inputOverheadTokens ?? 0);
    const worst = estimate + req.maxTokens;

    if (this.dryRun) {
      this.calls++;
      this.estimatedInput += estimate;
      this.worstCaseOutput += req.maxTokens;
      if (this.billed) {
        this.budget.billedCalls++;
        this.budget.worstCase += worst;
        if (
          this.budget.exceedsAtCall === null &&
          this.budget.worstCase > this.budget.limit
        ) {
          this.budget.exceedsAtCall = this.budget.billedCalls;
        }
      }
      // 호출 없이 흐름만 이어간다. 단계가 전형적인 출력을 주면 그것을, 아니면 입력을 그대로 돌려준다
      const last = [...req.messages].reverse().find((m) => m.role === "user");
      return {
        text: opts.dryRunText ?? last?.content ?? "",
        usage: { input: estimate, output: 0 },
        latencyMs: 0,
        model: this.provider.model,
        stopReason: "dry-run",
      };
    }

    const key = await this.cacheKey(req);
    const cachePath = `${CACHE_DIR}/${key}.json`;
    if (opts.readCache) {
      try {
        const hit = JSON.parse(
          await Deno.readTextFile(cachePath),
        ) as CacheEntry;
        this.cacheHits++;
        return { ...hit.response, cached: true };
      } catch {
        // 없거나 깨진 캐시는 적중이 아니다
      }
    }

    if (this.billed && this.budget.used + worst > this.budget.limit) {
      throw new BudgetStop(this.budget.used, worst, this.budget.limit);
    }
    this.calls++;
    this.estimatedInput += estimate;
    const res = await this.provider.complete(req);
    this.input += res.usage.input;
    this.output += res.usage.output;
    if (this.billed) this.budget.used += res.usage.input + res.usage.output;
    if (!this.firstSnapshot && this.provider.snapshot) {
      this.firstSnapshot = await this.provider.snapshot();
    }

    // 읽기는 --cache일 때만 하지만 쓰기는 항상 한다. 쓰기 실패가 측정을 막으면 안 된다
    try {
      await Deno.mkdir(CACHE_DIR, { recursive: true });
      const entry: CacheEntry = {
        key,
        provider: this.provider.name,
        model: this.provider.model,
        createdAt: new Date().toISOString(),
        response: res,
      };
      await Deno.writeTextFile(cachePath, JSON.stringify(entry));
    } catch {
      // 무시
    }
    return res;
  }
}

// --- 기록 ---------------------------------------------------------------------

type RecordStatus = "ok" | "error" | "skipped" | "budget_stop";

interface CallRecord {
  model: string;
  input: number;
  output: number;
  latencyMs: number;
  stopReason: string;
  // provider가 남긴 주의 (예: Ollama context_full). 없으면 생략
  warning?: string;
  // 캐시 적중이면 input/output/latencyMs는 0이고 원래 값은 cachedUsage에 남는다
  cached?: boolean;
  cachedUsage?: { input: number; output: number; latencyMs: number };
}

interface StageRecord {
  caseId: string;
  stage: string;
  status: RecordStatus;
  inputSha256: string;
  output: unknown;
  error?: string;
  calls: CallRecord[];
  tokens: { input: number; output: number };
  latencyMs: number;
  scores: Record<string, Score>;
}

// 모델 ID → 단가와 청구 방식. 호출 기록(calls[].model)으로 단계별 비용을 계산한다
type PriceBook = Record<
  string,
  { price: Price; billing: "api" | "subscription" }
>;

interface StageStats {
  n: number;
  ok: number;
  errors: number;
  skipped: number;
  tokens: { input: number; output: number };
  // 이 단계 호출의 API 단가 환산 합. 구독 provider도 포함한다 (청구는 billedUsd만)
  costUsd: number;
  // 실제로 청구되는 부분 (subscription provider 제외)
  billedUsd: number;
  latencyMs: { p50: number; p95: number };
  scores: Record<string, number>;
  // weight가 붙은 채점기만. 가중 평균 (예: 근거 통과율을 case가 아니라 항목 기준으로)
  scoresWeighted: Record<string, number>;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function summarizeStages(
  records: StageRecord[],
  stages: { name: string }[],
  book: PriceBook,
): Record<string, StageStats> {
  const out: Record<string, StageStats> = {};
  const fallback = Object.values(book)[0];
  for (const st of stages) {
    const mine = records.filter((r) => r.stage === st.name);
    const done = mine.filter((r) => r.status === "ok");
    let usd = 0;
    let billed = 0;
    for (const c of mine.flatMap((r) => r.calls)) {
      const entry = book[c.model] ?? fallback;
      if (!entry) continue;
      const cost = costUsd(entry.price, c);
      usd += cost;
      if (entry.billing === "api") billed += cost;
    }
    const graders = new Map<string, number[]>();
    // [value × weight, weight]. weight가 없는 기록은 1로 센다
    const weighted = new Map<string, [number, number]>();
    for (const r of done) {
      for (const [g, s] of Object.entries(r.scores)) {
        graders.set(g, [...(graders.get(g) ?? []), s.value]);
        if (s.weight !== undefined) {
          const [sum, w] = weighted.get(g) ?? [0, 0];
          weighted.set(g, [sum + s.value * s.weight, w + s.weight]);
        }
      }
    }
    // 지연은 실제로 호출한 기록만 쓴다. 호출이 없거나(건너뜀) 전부 캐시에서 온 기록은 뺀다
    const timed = done.filter((r) => r.calls.some((c) => !c.cached));
    out[st.name] = {
      n: mine.length,
      ok: done.length,
      errors: mine.filter((r) => r.status === "error").length,
      skipped: mine.filter((r) => r.status === "skipped").length,
      tokens: {
        input: mine.reduce((n, r) => n + r.tokens.input, 0),
        output: mine.reduce((n, r) => n + r.tokens.output, 0),
      },
      costUsd: round6(usd),
      billedUsd: round6(billed),
      latencyMs: {
        p50: percentile(
          timed.map((r) => r.latencyMs),
          0.5,
        ),
        p95: percentile(
          timed.map((r) => r.latencyMs),
          0.95,
        ),
      },
      scores: Object.fromEntries(
        [...graders].map(([g, xs]) => [g, Math.round(mean(xs) * 1000) / 1000]),
      ),
      scoresWeighted: Object.fromEntries(
        [...weighted]
          .filter(([, [, w]]) => w > 0)
          .map(([g, [sum, w]]) => [g, Math.round((sum / w) * 1000) / 1000]),
      ),
    };
  }
  return out;
}

// --- run ----------------------------------------------------------------------

type RunStatus = "completed" | "stopped_budget" | "failed";

// macOS 스왑 사용량(MB). 모델이 16GB 메모리에 안 들어가면 여기서 먼저 드러난다. 못 읽으면 null
async function swapUsedMB(): Promise<number | null> {
  try {
    const out = await new Deno.Command("sysctl", {
      args: ["-n", "vm.swapusage"],
    }).output();
    const m = new TextDecoder().decode(out.stdout).match(/used = ([\d.]+)M/);
    return m ? Math.round(Number(m[1])) : null;
  } catch {
    return null;
  }
}

async function runCommand(args: string[]) {
  const opts = parseRunOptions(args);
  const stages = opts.stages.map((n) => STAGES[n]);
  const { selected, dataset } = await loadDataset(opts);
  const provider = await makeProvider(opts);
  const budget = new Budget(opts.maxTokens);
  const meter = new Meter(provider, budget, opts.dryRun);
  // 채점처럼 role이 judge인 단계가 있을 때만 judge provider를 만든다
  const judgeProvider = stages.some((s) => s.role === "judge")
    ? await makeJudgeProvider(opts)
    : undefined;
  const judgeMeter = judgeProvider
    ? new Meter(judgeProvider, budget, opts.dryRun)
    : undefined;
  const meterFor = (st: AnyStage) =>
    st.role === "judge" && judgeMeter ? judgeMeter : meter;
  // dry-run은 캐시를 읽지도 쓰지도 않는다. 읽기는 단계별로 정한다 (--cache는 전부, --cache a,b는 그 단계만)
  const readsCache = (st: AnyStage) =>
    !opts.dryRun &&
    (opts.cache === true ||
      (Array.isArray(opts.cache) && opts.cache.includes(st.name)));
  const book: PriceBook = {
    [provider.model]: {
      price: provider.price,
      billing: provider.billing ?? "api",
    },
    ...(judgeProvider
      ? {
          [judgeProvider.model]: {
            price: judgeProvider.price,
            billing: judgeProvider.billing ?? "api",
          },
        }
      : {}),
  };

  const swapStart = await swapUsedMB();
  const startedAt = new Date();
  const runId = `${localStamp(startedAt)}${opts.label ? `-${opts.label}` : ""}`;
  const runDir = `${RUNS_DIR}/${runId}`;

  const config = {
    runId,
    label: opts.label,
    startedAt: startedAt.toISOString(),
    gitCommit: (await git(["rev-parse", "--short", "HEAD"])) || "unknown",
    gitDirty:
      (await git(["status", "--porcelain", "--", "scripts", "supabase"])) !==
      "",
    argv: args,
    provider: provider.name,
    model: provider.model,
    price: provider.price,
    stages: await Promise.all(
      stages.map(async (s) => ({
        name: s.name,
        promptSha256: await sha256(s.prompts.join("\n---\n")),
      })),
    ),
    dataset,
    maxTokens: opts.maxTokens,
    dryRun: opts.dryRun,
    // false: 읽지 않음 / true: 모든 단계 / 단계 이름 배열: 그 단계만
    cache: opts.dryRun ? false : opts.cache,
    // provider 설정 중 응답에 영향을 주는 것 (예: Ollama num_ctx=16384)
    providerOptions: provider.cacheTag ?? "",
    // role이 judge인 단계를 부르는 provider. 없으면 null
    judge: judgeProvider
      ? {
          provider: judgeProvider.name,
          model: judgeProvider.model,
          price: judgeProvider.price,
          billing: judgeProvider.billing ?? "api",
          options: judgeProvider.cacheTag ?? "",
          info: judgeProvider.info ?? {},
        }
      : null,
    prices: book,
  };

  console.log(
    `\n${opts.dryRun ? "[dry-run] " : ""}run ${runId}  ${provider.name}/${provider.model}${judgeProvider ? `  채점 ${judgeProvider.name}/${judgeProvider.model}` : ""}  case ${selected.length}건 (${dataset.selection})  단계 ${stages.map((s) => s.name).join(" → ")}  상한 ${opts.maxTokens.toLocaleString()} tok\n`,
  );

  const records: StageRecord[] = [];
  const recordsPath = `${runDir}/records.jsonl`;
  if (!opts.dryRun) {
    await Deno.mkdir(runDir, { recursive: true });
    await Deno.writeTextFile(
      `${runDir}/config.json`,
      JSON.stringify(config, null, 2) + "\n",
    );
    await Deno.writeTextFile(recordsPath, "");
  }
  const push = async (r: StageRecord) => {
    records.push(r);
    if (!opts.dryRun) {
      await Deno.writeTextFile(recordsPath, JSON.stringify(r) + "\n", {
        append: true,
      });
    }
  };

  let status: RunStatus = "completed";
  let fatal: string | undefined;
  let casesDone = 0;

  try {
    caseLoop: for (const [idx, c] of selected.entries()) {
      const prev: Record<string, unknown> = {};
      let failedStage: string | null = null;

      for (const st of stages) {
        const input = st.input(c, prev);
        const base = {
          caseId: c.id,
          stage: st.name,
          inputSha256: await sha256(JSON.stringify(input)),
        };
        if (failedStage) {
          await push({
            ...base,
            status: "skipped",
            output: null,
            error: `앞 단계(${failedStage}) 실패`,
            calls: [],
            tokens: { input: 0, output: 0 },
            latencyMs: 0,
            scores: {},
          });
          continue;
        }

        // 단계 안에서 일어난 호출만 모은다 (실패해도 이미 쓴 토큰은 남긴다)
        const calls: CallRecord[] = [];
        const ctx = {
          call: async (req: LLMRequest, o?: { dryRunText?: string }) => {
            const res = await meterFor(st).call(req, {
              readCache: readsCache(st),
              dryRunText: o?.dryRunText,
            });
            calls.push(
              res.cached
                ? {
                    model: res.model,
                    input: 0,
                    output: 0,
                    latencyMs: 0,
                    stopReason: res.stopReason,
                    cached: true,
                    cachedUsage: {
                      input: res.usage.input,
                      output: res.usage.output,
                      latencyMs: res.latencyMs,
                    },
                  }
                : {
                    model: res.model,
                    input: res.usage.input,
                    output: res.usage.output,
                    latencyMs: res.latencyMs,
                    stopReason: res.stopReason,
                    ...(res.warning ? { warning: res.warning } : {}),
                  },
            );
            return res;
          },
        };
        const tokens = () => ({
          input: calls.reduce((n, x) => n + x.input, 0),
          output: calls.reduce((n, x) => n + x.output, 0),
        });
        const t0 = performance.now();
        try {
          const output = await st.run(input, ctx);
          const scores = st.grade?.(c, input, output) ?? {};
          prev[st.name] = output;
          const rec: StageRecord = {
            ...base,
            status: "ok",
            output,
            calls,
            tokens: tokens(),
            latencyMs: Math.round(performance.now() - t0),
            scores,
          };
          await push(rec);
          console.log(
            `[${idx + 1}/${selected.length}] ${c.id} ${st.name} ok  ${rec.tokens.input}+${rec.tokens.output} tok  ${(rec.latencyMs / 1000).toFixed(1)}s  ${Object.entries(
              scores,
            )
              .map(([g, s]) => `${g}=${s.value}`)
              .join(" ")}`,
          );
        } catch (err) {
          const isBudget = err instanceof BudgetStop;
          const message = err instanceof Error ? err.message : String(err);
          await push({
            ...base,
            status: isBudget ? "budget_stop" : "error",
            output: null,
            error: message,
            calls,
            tokens: tokens(),
            latencyMs: Math.round(performance.now() - t0),
            scores: {},
          });
          if (isBudget) {
            status = "stopped_budget";
            console.log(
              `[${idx + 1}/${selected.length}] ${c.id} ${st.name} 중단: ${message}`,
            );
            break caseLoop;
          }
          console.log(
            `[${idx + 1}/${selected.length}] ${c.id} ${st.name} 실패: ${message}`,
          );
          // 인증 실패는 모든 case가 같이 실패한다
          if (err instanceof LLMError && err.kind === "auth") {
            status = "failed";
            fatal = message;
            break caseLoop;
          }
          failedStage = st.name;
        }
      }
      casesDone++;
    }
  } catch (err) {
    status = "failed";
    fatal = err instanceof Error ? err.message : String(err);
  } finally {
    const tokens = dryRunOr(opts.dryRun, meter);
    const warnings = records
      .flatMap((r) => r.calls)
      .filter((c) => c.warning).length;
    const stageStats = summarizeStages(records, stages, book);
    const allStats = Object.values(stageStats);
    const summary = {
      status,
      finishedAt: new Date().toISOString(),
      ...(fatal ? { error: fatal } : {}),
      cases: { planned: selected.length, done: casesDone },
      // tokens·cacheHits는 생성 provider의 것이다. 채점 provider는 judge에 따로 둔다
      tokens: {
        input: tokens.input,
        output: tokens.output,
        estimatedInput: meter.estimatedInput,
      },
      ...(judgeMeter
        ? {
            judge: {
              provider: `${judgeMeter.provider.name}/${judgeMeter.provider.model}`,
              calls: judgeMeter.calls,
              tokens: {
                input: judgeMeter.input,
                output: judgeMeter.output,
                estimatedInput: judgeMeter.estimatedInput,
              },
              cacheHits: judgeMeter.cacheHits,
            },
          }
        : {}),
      cacheHits: meter.cacheHits,
      ...(warnings ? { warnings } : {}),
      // 모델 비교의 메모리 근거. Ollama는 첫 호출 직후와 끝의 /api/ps, 둘 다 스왑 사용량을 남긴다
      resources: {
        providerAfterFirstCall: meter.firstSnapshot ?? null,
        providerAtEnd: opts.dryRun
          ? null
          : ((await provider.snapshot?.()) ?? null),
        swapUsedMB: { start: swapStart, end: await swapUsedMB() },
      },
      // 실제 청구액 (구독 provider 제외)
      costUsd: round6(allStats.reduce((n, s) => n + s.billedUsd, 0)),
      // 모든 호출을 API 단가로 환산한 값 (구독으로 돌린 채점 포함)
      costUsdApiEquivalent: round6(allStats.reduce((n, s) => n + s.costUsd, 0)),
      stages: stageStats,
    };
    if (opts.dryRun) {
      printDryRun(opts, budget, [meter, judgeMeter], selected.length);
    } else {
      await Deno.writeTextFile(
        `${runDir}/summary.json`,
        JSON.stringify(summary, null, 2) + "\n",
      );
      printSummary(runDir, summary);
    }
  }
  if (status === "stopped_budget") Deno.exit(2);
  if (status === "failed") Deno.exit(1);
}

const dryRunOr = (dry: boolean, meter: Meter) =>
  dry ? { input: 0, output: 0 } : { input: meter.input, output: meter.output };

function printDryRun(
  opts: RunOptions,
  budget: Budget,
  meters: (Meter | undefined)[],
  cases: number,
) {
  console.log(`\ncase ${cases}건`);
  for (const m of meters) {
    if (!m) continue;
    const upper = costUsd(m.provider.price, {
      input: m.estimatedInput,
      output: m.worstCaseOutput,
    });
    console.log(
      `\n[${m.provider.name}/${m.provider.model}${m.billed ? "" : " · 구독"}]`,
    );
    console.log(`호출 ${m.calls}회`);
    console.log(
      `예상 입력   ${m.estimatedInput.toLocaleString()} tok  (글자 수 + 한글당 0.25 + 요청당 40 추정)`,
    );
    console.log(
      `출력 상한   ${m.worstCaseOutput.toLocaleString()} tok  (max_tokens 합)`,
    );
    console.log(
      m.billed
        ? `비용 상한   $${upper.toFixed(5)}`
        : `비용 상한   청구 없음 (API 환산 $${upper.toFixed(5)})`,
    );
  }
  if (budget.exceedsAtCall === null) {
    console.log(
      `\n상한 ${opts.maxTokens.toLocaleString()} tok: 최악의 경우에도 넘지 않아요 (청구되는 호출 ${budget.worstCase.toLocaleString()})`,
    );
  } else {
    console.log(
      `\n상한 ${opts.maxTokens.toLocaleString()} tok: 최악의 경우 ${budget.exceedsAtCall}번째 청구 호출 전에 멈출 수 있어요 (전체 ${budget.worstCase.toLocaleString()})`,
    );
  }
  console.log("");
}

function printSummary(
  runDir: string,
  s: {
    status: RunStatus;
    cases: { planned: number; done: number };
    tokens: { input: number; output: number; estimatedInput: number };
    cacheHits: number;
    judge?: {
      provider: string;
      calls: number;
      tokens: { input: number; output: number; estimatedInput: number };
      cacheHits: number;
    };
    warnings?: number;
    resources?: {
      providerAfterFirstCall: Record<string, unknown> | null;
      providerAtEnd: Record<string, unknown> | null;
      swapUsedMB: { start: number | null; end: number | null };
    };
    costUsd: number;
    costUsdApiEquivalent: number;
    stages: Record<string, StageStats>;
  },
) {
  console.log(
    `\n${s.status === "completed" ? "✓" : "!"} ${s.status}  case ${s.cases.done}/${s.cases.planned}  토큰 ${s.tokens.input}+${s.tokens.output} (추정 입력 ${s.tokens.estimatedInput})  청구 $${s.costUsd.toFixed(5)} (API 환산 $${s.costUsdApiEquivalent.toFixed(5)})${s.cacheHits ? `  캐시 적중 ${s.cacheHits}회` : ""}${s.warnings ? `  ⚠ 경고 ${s.warnings}회 (records의 calls[].warning)` : ""}`,
  );
  if (s.judge) {
    console.log(
      `  채점 ${s.judge.provider}: 호출 ${s.judge.calls}회  토큰 ${s.judge.tokens.input}+${s.judge.tokens.output} (추정 입력 ${s.judge.tokens.estimatedInput})${s.judge.cacheHits ? `  캐시 적중 ${s.judge.cacheHits}회` : ""}`,
    );
  }
  const mem = s.resources?.providerAfterFirstCall;
  if (mem?.loaded) {
    console.log(
      `  메모리: 러너 RSS ${mem.runnerRssMB ?? "?"}MB · /api/ps ${mem.sizeMB}MB (GPU ${mem.gpuPercent}%, 컨텍스트 ${mem.contextLength ?? "?"})  스왑 ${s.resources?.swapUsedMB.start ?? "?"} → ${s.resources?.swapUsedMB.end ?? "?"}MB`,
    );
  }
  for (const [name, st] of Object.entries(s.stages)) {
    const weighted = Object.entries(st.scoresWeighted).map(
      ([g, v]) => `${g}(가중)=${v}`,
    );
    console.log(
      `  ${name}: ok ${st.ok}/${st.n}  err ${st.errors}  skip ${st.skipped}  p50 ${st.latencyMs.p50}ms  p95 ${st.latencyMs.p95}ms  $${st.costUsd.toFixed(5)}  ${[
        ...Object.entries(st.scores).map(([g, v]) => `${g}=${v}`),
        ...weighted,
      ].join(" ")}`,
    );
  }
  console.log(`  기록: ${runDir}/\n`);
}

// --- compare ------------------------------------------------------------------

interface RunConfig {
  runId: string;
  provider: string;
  model: string;
  price: { inputPerMTok: number; outputPerMTok: number };
  gitCommit: string;
  gitDirty: boolean;
  stages: { name: string; promptSha256: string }[];
  dataset: {
    casesSha256: string;
    selection: string;
    caseIds: string[];
    // #76 이전 run에는 없다
    notesSha256?: string | null;
  };
  maxTokens: number;
  // #75 이전 run에는 없다 (없으면 false로 본다). #76부터 단계 이름 배열도 된다
  cache?: boolean | string[];
  providerOptions?: string;
  // #76 이전 run에는 없다
  judge?: {
    provider: string;
    model: string;
    price: Price;
    billing: "api" | "subscription";
    options: string;
    info: Record<string, unknown>;
  } | null;
  prices?: PriceBook;
}

// 오래된 run은 prices가 없어서 provider 하나의 단가로 대신한다
const priceBookOf = (config: RunConfig): PriceBook =>
  config.prices ?? {
    [config.model]: { price: config.price, billing: "api" },
  };

interface LoadedRun {
  dir: string;
  config: RunConfig;
  records: StageRecord[];
}

async function loadRun(arg: string): Promise<LoadedRun> {
  let dir = `${RUNS_DIR}/${arg}`;
  try {
    await Deno.stat(`${dir}/config.json`);
  } catch {
    dir = arg.replace(/\/$/, "");
  }
  try {
    const config = JSON.parse(
      await Deno.readTextFile(`${dir}/config.json`),
    ) as RunConfig;
    const records = (await Deno.readTextFile(`${dir}/records.jsonl`))
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as StageRecord)
      // 상한으로 멈춘 기록은 실행되지 않은 것이다. 비교에서는 그 case가 없는 것으로 본다
      .filter((r) => r.status !== "budget_stop");
    return { dir, config, records };
  } catch {
    die(
      `run을 읽을 수 없어요: ${arg} (${RUNS_DIR}/ 아래 runId 또는 폴더 경로)`,
    );
  }
}

const sign = (n: number, digits = 0) =>
  `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;

// "A → B (Δ)". 같으면 Δ를 생략한다
function change(a: number, b: number, digits = 0): string {
  const f = (n: number) => n.toFixed(digits);
  return a === b ? f(a) : `${f(a)} → ${f(b)} (${sign(b - a, digits)})`;
}

async function compareCommand(args: string[]) {
  const usage =
    "사용법: harness.ts compare <runA> <runB> [--subset dev|tune|holdout]";
  const rest = [...args];
  let subsetName: string | undefined;
  const si = rest.indexOf("--subset");
  if (si !== -1) {
    subsetName = rest[si + 1];
    if (!subsetName || !["dev", "tune", "holdout"].includes(subsetName)) {
      die(`--subset은 dev | tune | holdout 중 하나예요. ${usage}`);
    }
    rest.splice(si, 2);
  }
  if (rest.length !== 2) die(usage);
  const [a, b] = await Promise.all(rest.map(loadRun));
  // 전체 run에서 서브셋 숫자만 뽑아 본다 (예: 최종 run의 holdout). 기록을 그 서브셋 case로 거른다
  if (subsetName) {
    const ids = new Set(await loadSubsetIds(subsetName));
    a.records = a.records.filter((r) => ids.has(r.caseId));
    b.records = b.records.filter((r) => ids.has(r.caseId));
  }
  const out: string[] = [];

  out.push(
    `# compare ${a.config.runId} → ${b.config.runId}${subsetName ? ` (${subsetName} 서브셋만)` : ""}`,
    "",
  );

  // 1. 설정 차이
  const sameData =
    a.config.dataset.casesSha256 === b.config.dataset.casesSha256;
  if (!sameData) {
    out.push(
      "> ⚠ 두 run의 평가셋(casesSha256)이 달라요. 점수 차이가 프롬프트·모델 때문인지 데이터 때문인지 가릴 수 없어요.",
      "",
    );
  }
  const aStages = new Map(a.config.stages.map((s) => [s.name, s.promptSha256]));
  const bStages = new Map(b.config.stages.map((s) => [s.name, s.promptSha256]));
  const diffs: string[] = [];
  const diff = (label: string, x: unknown, y: unknown) => {
    if (x !== y) diffs.push(`- ${label}: ${x} → ${y}`);
  };
  diff("provider", a.config.provider, b.config.provider);
  diff("model", a.config.model, b.config.model);
  diff("max-tokens", a.config.maxTokens, b.config.maxTokens);
  diff(
    "캐시 읽기(--cache)",
    JSON.stringify(a.config.cache ?? false),
    JSON.stringify(b.config.cache ?? false),
  );
  diff(
    "provider 설정",
    a.config.providerOptions ?? "",
    b.config.providerOptions ?? "",
  );
  // 채점 provider·모델·설정이 다르면 점수 차이를 프롬프트 탓으로 읽으면 안 된다
  const judgeLabel = (c: RunConfig) =>
    c.judge ? `${c.judge.provider}/${c.judge.model}` : "(없음)";
  diff("채점 provider", judgeLabel(a.config), judgeLabel(b.config));
  diff(
    "채점 설정",
    a.config.judge?.options ?? "",
    b.config.judge?.options ?? "",
  );
  diff(
    "채점 도구 버전",
    JSON.stringify(a.config.judge?.info ?? {}),
    JSON.stringify(b.config.judge?.info ?? {}),
  );
  diff("평가셋 선택", a.config.dataset.selection, b.config.dataset.selection);
  diff(
    "평가셋 해시",
    a.config.dataset.casesSha256.slice(0, 8),
    b.config.dataset.casesSha256.slice(0, 8),
  );
  diff(
    "case 메모 해시",
    (a.config.dataset.notesSha256 ?? "(없음)").slice(0, 8),
    (b.config.dataset.notesSha256 ?? "(없음)").slice(0, 8),
  );
  diff(
    "코드",
    `${a.config.gitCommit}${a.config.gitDirty ? "+dirty" : ""}`,
    `${b.config.gitCommit}${b.config.gitDirty ? "+dirty" : ""}`,
  );
  for (const name of new Set([...aStages.keys(), ...bStages.keys()])) {
    const x = aStages.get(name);
    const y = bStages.get(name);
    if (x !== y) {
      diffs.push(
        `- 프롬프트(${name}): ${x ? x.slice(0, 8) : "(없음)"} → ${y ? y.slice(0, 8) : "(없음)"}`,
      );
    }
  }
  out.push(
    "## 설정 차이",
    "",
    ...(diffs.length ? diffs : ["- 없음 (같은 설정)"]),
    "",
  );

  // case 구성
  const aIds = new Set(a.records.map((r) => r.caseId));
  const bIds = new Set(b.records.map((r) => r.caseId));
  const common = new Set([...aIds].filter((id) => bIds.has(id)));
  const onlyA = [...aIds].filter((id) => !bIds.has(id));
  const onlyB = [...bIds].filter((id) => !aIds.has(id));

  // 2. 단계별 표 (공통 case 기준)
  const inCommon = (r: StageRecord) => common.has(r.caseId);
  const aCommon = a.records.filter(inCommon);
  const bCommon = b.records.filter(inCommon);
  const stageNames = [...new Set([...aStages.keys(), ...bStages.keys()])];
  const aStats = summarizeStages(
    aCommon,
    stageNames.map((name) => ({ name })),
    priceBookOf(a.config),
  );
  const bStats = summarizeStages(
    bCommon,
    stageNames.map((name) => ({ name })),
    priceBookOf(b.config),
  );

  out.push(`## 단계별 비교 (공통 case ${common.size}건)`, "");
  out.push(
    "| 단계 | ok | 채점 | 입력 tok | 출력 tok | 지연 p50 ms | 지연 p95 ms | API 환산 $ |",
  );
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const name of stageNames) {
    const x = aStats[name];
    const y = bStats[name];
    const graders = [
      ...new Set([...Object.keys(x.scores), ...Object.keys(y.scores)]),
    ];
    const weighted = [
      ...new Set([
        ...Object.keys(x.scoresWeighted),
        ...Object.keys(y.scoresWeighted),
      ]),
    ];
    const scoreCell = graders.length
      ? [
          ...graders.map(
            (g) => `${g} ${change(x.scores[g] ?? 0, y.scores[g] ?? 0, 3)}`,
          ),
          ...weighted.map(
            (g) =>
              `${g}(가중) ${change(x.scoresWeighted[g] ?? 0, y.scoresWeighted[g] ?? 0, 3)}`,
          ),
        ].join("<br>")
      : "-";
    out.push(
      `| ${name} | ${x.ok}/${x.n} → ${y.ok}/${y.n} | ${scoreCell} | ${change(x.tokens.input, y.tokens.input)} | ${change(x.tokens.output, y.tokens.output)} | ${change(x.latencyMs.p50, y.latencyMs.p50)} | ${change(x.latencyMs.p95, y.latencyMs.p95)} | ${change(x.costUsd, y.costUsd, 5)} |`,
    );
  }
  // 청구는 구독 provider(채점)를 뺀 값이고, API 환산은 모든 호출을 API 단가로 센 값이다
  const sum = (s: Record<string, StageStats>, k: "billedUsd" | "costUsd") =>
    Object.values(s).reduce((n, st) => n + st[k], 0);
  out.push(
    "",
    `청구 $${sum(aStats, "billedUsd").toFixed(5)} → $${sum(bStats, "billedUsd").toFixed(5)}  ·  API 환산 $${sum(aStats, "costUsd").toFixed(5)} → $${sum(bStats, "costUsd").toFixed(5)}`,
    "",
  );

  // 3. 점수·상태가 바뀐 case, 4. 점수는 같고 출력만 바뀐 case
  const key = (r: StageRecord) => `${r.caseId}\u0000${r.stage}`;
  const bByKey = new Map(b.records.map((r) => [key(r), r]));
  const changed: string[] = [];
  let outputOnly = 0;
  for (const ra of a.records) {
    const rb = bByKey.get(key(ra));
    if (!rb) continue;
    let scoreChanged = false;
    if (ra.status !== rb.status) {
      scoreChanged = true;
      changed.push(
        `| ${ra.caseId} | ${ra.stage} | 상태 | ${ra.status} → ${rb.status} | ${rb.error ?? ""} |`,
      );
    } else {
      for (const g of new Set([
        ...Object.keys(ra.scores),
        ...Object.keys(rb.scores),
      ])) {
        const x = ra.scores[g]?.value;
        const y = rb.scores[g]?.value;
        if (x !== y) {
          scoreChanged = true;
          changed.push(
            `| ${ra.caseId} | ${ra.stage} | ${g} | ${x ?? "-"} → ${y ?? "-"} | ${rb.scores[g]?.reason ?? ""} |`,
          );
        }
      }
    }
    if (
      !scoreChanged &&
      JSON.stringify(ra.output) !== JSON.stringify(rb.output)
    ) {
      outputOnly++;
    }
  }
  out.push(`## 점수가 바뀐 case (${changed.length}건)`, "");
  if (changed.length) {
    out.push(
      "| case | 단계 | 채점기 | A → B | B의 이유 |",
      "| --- | --- | --- | --- | --- |",
      ...changed,
    );
  } else {
    out.push("없음");
  }
  out.push("", `점수는 같지만 출력이 바뀐 기록: ${outputOnly}건`, "");

  // 5. 한쪽에만 있는 case
  if (onlyA.length || onlyB.length) {
    out.push("## 한쪽에만 있는 case", "");
    out.push(
      `- A에만 ${onlyA.length}건${onlyA.length ? `: ${onlyA.slice(0, 5).join(", ")}${onlyA.length > 5 ? " …" : ""}` : ""}`,
    );
    out.push(
      `- B에만 ${onlyB.length}건${onlyB.length ? `: ${onlyB.slice(0, 5).join(", ")}${onlyB.length > 5 ? " …" : ""}` : ""}`,
      "",
    );
  }

  const text = out.join("\n");
  console.log("\n" + text);
  const path = `${b.dir}/compare-${a.config.runId}${subsetName ? `-${subsetName}` : ""}.md`;
  await Deno.writeTextFile(path, text + "\n");
  console.log(`저장: ${path}\n`);
}

// --- main ---------------------------------------------------------------------

async function main() {
  const [cmd, ...rest] = Deno.args;
  if (cmd === "run") return await runCommand(rest);
  if (cmd === "compare") return await compareCommand(rest);
  die(
    "사용법: harness.ts run [옵션] | compare <runA> <runB>  (자세한 옵션은 파일 상단 주석)",
  );
}

if (import.meta.main) await main();
