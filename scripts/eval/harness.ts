// 리마인더 평가 하네스 (Deno 2.x, #74)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/eval/harness.ts run [--provider claude|ollama|echo] [--model <id>] \
//       [--subset dev|all] [--only <caseId>]... [--max-tokens N] [--dry-run] [--label <name>]
//
//   deno run ... scripts/eval/harness.ts compare <runA> <runB>
//
// - 평가셋은 local/eval/dataset/ (scripts/eval-dataset.ts가 만든다)에서 읽는다. DB에는 접근하지 않는다
// - 기본값: --provider echo, --subset dev, --max-tokens 200000. --only는 여러 번 줄 수 있고 --subset보다 우선한다
// - 결과: local/eval/runs/<runId>/config.json    (모델, 단계별 프롬프트 해시, 평가셋 해시, 선택한 case)
//         local/eval/runs/<runId>/records.jsonl  (case × 단계마다 한 줄. 끝나는 즉시 덧붙이므로 중단돼도 남는다)
//         local/eval/runs/<runId>/summary.json   (종료 상태, 토큰, 비용, 단계별 통계와 채점기 평균)
//   local/은 git 제외다. 회고 원문이 들어가므로 이 밖으로 내보내지 않는다
// - --max-tokens: 누적(입력+출력) + 이번 호출의 입력 추정 + max_tokens가 상한을 넘으면 호출하지 않고 멈춘다.
//   상한을 넘기지 않는 대신 출력 상한(max_tokens)만큼 여유를 남기고 멈추므로 보수적이다. 멈추면 exit 2
// - --dry-run: 호출하지 않고 파이프라인을 끝까지 돌며 예상 입력 토큰과 비용 상한을 출력한다 (기록 폴더 없음).
//   입력 토큰은 글자 ÷ 2 추정이고, 뒤 단계 입력에 앞 단계 출력이 들어가는 경우 그 출력은 추정에서 빠진다
// - 실행은 case를 하나씩 순서대로 한다 (누적 토큰과 기록 순서가 결정적이 되도록)
// - compare: 두 run(runId 또는 폴더 경로)의 설정 차이, 단계별 점수·토큰·지연·비용 차이, 점수가 바뀐 case를 마크다운으로
//   출력하고 <runB>/compare-<runA>.md에도 저장한다. 평가셋 해시가 다르면 맨 위에 경고한다.
//   단계별 표는 두 run에 모두 있는 case만 쓴다 (한쪽이 상한으로 중단됐을 때 공정하게 비교하려고)

import {
  costUsd,
  createClaudeProvider,
  createEchoProvider,
  createOllamaProvider,
  DEFAULT_CLAUDE_MODEL,
  estimateTokens,
  LLMError,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
  loadApiKey,
} from "./llm.ts";
import { type AnyStage, type Score, STAGES } from "./stages.ts";
import type { EvalCase } from "./types.ts";

const ROOT = new URL("../..", import.meta.url).pathname;
const DATASET_DIR = `${ROOT}local/eval/dataset`;
const RUNS_DIR = `${ROOT}local/eval/runs`;

const DEFAULT_MAX_TOKENS = 200_000;
const DEFAULT_PIPELINE = ["echo"];

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
];

interface RunOptions {
  provider: "claude" | "ollama" | "echo";
  model?: string;
  subset: "dev" | "all";
  only: string[];
  maxTokens: number;
  dryRun: boolean;
  label: string;
}

function parseRunOptions(args: string[]): RunOptions {
  const values = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") continue;
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
  if (subset !== "dev" && subset !== "all") {
    die(`--subset은 dev | all 중 하나예요: ${subset}`);
  }
  const maxTokens = Number(one("--max-tokens") ?? DEFAULT_MAX_TOKENS);
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    die(`--max-tokens는 양의 정수여야 해요: ${one("--max-tokens")}`);
  }
  const label = one("--label") ?? "";
  if (label && !/^[\w.-]+$/.test(label)) {
    die(`--label에는 영문·숫자·_ . - 만 쓸 수 있어요: ${label}`);
  }
  return {
    provider,
    model: one("--model"),
    subset,
    only: values.get("--only") ?? [],
    maxTokens,
    dryRun: args.includes("--dry-run"),
    label,
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

async function loadDataset(opts: RunOptions) {
  const cases = await readJson<EvalCase[]>(`${DATASET_DIR}/cases.json`);
  const manifest = await readJson<Manifest>(`${DATASET_DIR}/manifest.json`);
  const subset = await readJson<{ ids: string[] }>(
    `${DATASET_DIR}/subset-dev.json`,
  );

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

  const byId = new Map(cases.map((c) => [c.id, c]));
  let selected: EvalCase[];
  let selection: "dev" | "all" | "only";
  if (opts.only.length > 0) {
    selection = "only";
    selected = [...new Set(opts.only)].map((id) => {
      const c = byId.get(id);
      if (!c) die(`평가셋에 없는 case id예요: ${id}`);
      return c;
    });
  } else if (opts.subset === "all") {
    selection = "all";
    selected = cases;
  } else {
    selection = "dev";
    selected = subset.ids.map((id) => {
      const c = byId.get(id);
      if (!c) die(`서브셋의 case가 cases.json에 없어요: ${id}`);
      return c;
    });
  }
  return {
    selected,
    dataset: {
      casesSha256,
      caseIdsSha256,
      manifestGeneratedAt: manifest.generatedAt,
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

// 모든 LLM 호출이 지나는 곳. 상한 검사, 토큰 집계, 호출 기록을 여기서 한다
class Meter {
  input = 0;
  output = 0;
  estimatedInput = 0;
  calls = 0;
  // dry-run: 최악의 경우(추정 입력 + max_tokens) 누적과, 상한을 처음 넘는 호출 번호
  worstCaseTokens = 0;
  worstCaseOutput = 0;
  exceedsAtCall: number | null = null;

  constructor(
    private provider: LLMProvider,
    private maxTokens: number,
    private dryRun: boolean,
  ) {}

  get total() {
    return this.input + this.output;
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    const estimate = estimateTokens(req);
    const worst = estimate + req.maxTokens;
    this.calls++;
    this.estimatedInput += estimate;

    if (this.dryRun) {
      this.worstCaseTokens += worst;
      this.worstCaseOutput += req.maxTokens;
      if (
        this.exceedsAtCall === null &&
        this.worstCaseTokens > this.maxTokens
      ) {
        this.exceedsAtCall = this.calls;
      }
      // 호출 없이 흐름만 이어가기 위해 입력을 그대로 돌려준다
      const last = [...req.messages].reverse().find((m) => m.role === "user");
      return {
        text: last?.content ?? "",
        usage: { input: estimate, output: 0 },
        latencyMs: 0,
        model: this.provider.model,
        stopReason: "dry-run",
      };
    }

    if (this.total + worst > this.maxTokens) {
      this.calls--;
      this.estimatedInput -= estimate;
      throw new BudgetStop(this.total, worst, this.maxTokens);
    }
    const res = await this.provider.complete(req);
    this.input += res.usage.input;
    this.output += res.usage.output;
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

interface StageStats {
  n: number;
  ok: number;
  errors: number;
  skipped: number;
  tokens: { input: number; output: number };
  latencyMs: { p50: number; p95: number };
  scores: Record<string, number>;
}

function summarizeStages(
  records: StageRecord[],
  stages: { name: string }[],
): Record<string, StageStats> {
  const out: Record<string, StageStats> = {};
  for (const st of stages) {
    const mine = records.filter((r) => r.stage === st.name);
    const done = mine.filter((r) => r.status === "ok");
    const graders = new Map<string, number[]>();
    for (const r of done) {
      for (const [g, s] of Object.entries(r.scores)) {
        graders.set(g, [...(graders.get(g) ?? []), s.value]);
      }
    }
    out[st.name] = {
      n: mine.length,
      ok: done.length,
      errors: mine.filter((r) => r.status === "error").length,
      skipped: mine.filter((r) => r.status === "skipped").length,
      tokens: {
        input: mine.reduce((n, r) => n + r.tokens.input, 0),
        output: mine.reduce((n, r) => n + r.tokens.output, 0),
      },
      latencyMs: {
        p50: percentile(
          done.map((r) => r.latencyMs),
          0.5,
        ),
        p95: percentile(
          done.map((r) => r.latencyMs),
          0.95,
        ),
      },
      scores: Object.fromEntries(
        [...graders].map(([g, xs]) => [g, Math.round(mean(xs) * 1000) / 1000]),
      ),
    };
  }
  return out;
}

// --- run ----------------------------------------------------------------------

type RunStatus = "completed" | "stopped_budget" | "failed";

async function runCommand(args: string[]) {
  const opts = parseRunOptions(args);
  const stages = DEFAULT_PIPELINE.map((n) => STAGES[n]);
  const { selected, dataset } = await loadDataset(opts);
  const provider = await makeProvider(opts);
  const meter = new Meter(provider, opts.maxTokens, opts.dryRun);

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
  };

  console.log(
    `\n${opts.dryRun ? "[dry-run] " : ""}run ${runId}  ${provider.name}/${provider.model}  case ${selected.length}건 (${dataset.selection})  단계 ${stages.map((s) => s.name).join(" → ")}  상한 ${opts.maxTokens.toLocaleString()} tok\n`,
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
          call: async (req: LLMRequest) => {
            const res = await meter.call(req);
            calls.push({
              model: res.model,
              input: res.usage.input,
              output: res.usage.output,
              latencyMs: res.latencyMs,
              stopReason: res.stopReason,
            });
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
    const summary = {
      status,
      finishedAt: new Date().toISOString(),
      ...(fatal ? { error: fatal } : {}),
      cases: { planned: selected.length, done: casesDone },
      tokens: {
        input: tokens.input,
        output: tokens.output,
        estimatedInput: meter.estimatedInput,
      },
      costUsd: Math.round(costUsd(provider.price, tokens) * 1e6) / 1e6,
      stages: summarizeStages(records, stages),
    };
    if (opts.dryRun) {
      printDryRun(opts, provider, meter, selected.length);
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
  provider: LLMProvider,
  meter: Meter,
  cases: number,
) {
  const upper = costUsd(provider.price, {
    input: meter.estimatedInput,
    output: meter.worstCaseOutput,
  });
  console.log(`\n호출 ${meter.calls}회 (case ${cases}건)`);
  console.log(
    `예상 입력   ${meter.estimatedInput.toLocaleString()} tok  (글자 ÷ 2 추정)`,
  );
  console.log(
    `출력 상한   ${meter.worstCaseOutput.toLocaleString()} tok  (max_tokens 합)`,
  );
  console.log(
    `비용 상한   $${upper.toFixed(5)}  (${provider.name}/${provider.model})`,
  );
  if (meter.exceedsAtCall === null) {
    console.log(
      `상한 ${opts.maxTokens.toLocaleString()} tok: 최악의 경우에도 넘지 않아요 (${meter.worstCaseTokens.toLocaleString()})`,
    );
  } else {
    console.log(
      `상한 ${opts.maxTokens.toLocaleString()} tok: 최악의 경우 ${meter.exceedsAtCall}번째 호출 전에 멈출 수 있어요 (전체 ${meter.worstCaseTokens.toLocaleString()})`,
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
    costUsd: number;
    stages: Record<string, StageStats>;
  },
) {
  console.log(
    `\n${s.status === "completed" ? "✓" : "!"} ${s.status}  case ${s.cases.done}/${s.cases.planned}  토큰 ${s.tokens.input}+${s.tokens.output} (추정 입력 ${s.tokens.estimatedInput})  $${s.costUsd.toFixed(5)}`,
  );
  for (const [name, st] of Object.entries(s.stages)) {
    console.log(
      `  ${name}: ok ${st.ok}/${st.n}  err ${st.errors}  skip ${st.skipped}  p50 ${st.latencyMs.p50}ms  p95 ${st.latencyMs.p95}ms  ${Object.entries(
        st.scores,
      )
        .map(([g, v]) => `${g}=${v}`)
        .join(" ")}`,
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
  };
  maxTokens: number;
}

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

const costOf = (run: LoadedRun, recs: StageRecord[]) =>
  costUsd(run.config.price, {
    input: recs.reduce((n, r) => n + r.tokens.input, 0),
    output: recs.reduce((n, r) => n + r.tokens.output, 0),
  });

async function compareCommand(args: string[]) {
  if (args.length !== 2) die("사용법: harness.ts compare <runA> <runB>");
  const [a, b] = await Promise.all(args.map(loadRun));
  const out: string[] = [];

  out.push(`# compare ${a.config.runId} → ${b.config.runId}`, "");

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
  diff("평가셋 선택", a.config.dataset.selection, b.config.dataset.selection);
  diff(
    "평가셋 해시",
    a.config.dataset.casesSha256.slice(0, 8),
    b.config.dataset.casesSha256.slice(0, 8),
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
  );
  const bStats = summarizeStages(
    bCommon,
    stageNames.map((name) => ({ name })),
  );

  out.push(`## 단계별 비교 (공통 case ${common.size}건)`, "");
  out.push(
    "| 단계 | ok | 채점 | 입력 tok | 출력 tok | 지연 p50 ms | 지연 p95 ms |",
  );
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const name of stageNames) {
    const x = aStats[name];
    const y = bStats[name];
    const graders = [
      ...new Set([...Object.keys(x.scores), ...Object.keys(y.scores)]),
    ];
    const scoreCell = graders.length
      ? graders
          .map((g) => `${g} ${change(x.scores[g] ?? 0, y.scores[g] ?? 0, 3)}`)
          .join("<br>")
      : "-";
    out.push(
      `| ${name} | ${x.ok}/${x.n} → ${y.ok}/${y.n} | ${scoreCell} | ${change(x.tokens.input, y.tokens.input)} | ${change(x.tokens.output, y.tokens.output)} | ${change(x.latencyMs.p50, y.latencyMs.p50)} | ${change(x.latencyMs.p95, y.latencyMs.p95)} |`,
    );
  }
  out.push(
    "",
    `비용 $${costOf(a, aCommon).toFixed(5)} → $${costOf(b, bCommon).toFixed(5)}`,
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
  const path = `${b.dir}/compare-${a.config.runId}.md`;
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
