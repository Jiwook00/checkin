// 사람 라벨 ↔ LLM 채점기 일치도 도구 (#77)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/eval/labels.ts pick  [--run <runId>] [--seed 77]
//     scripts/eval/labels.ts sheet
//
// - pick: 기준 run(기본 g9 최종)의 judge 점수로 low/mid/high 층을 나눠 라벨 대상을 시드 고정으로 뽑는다.
//         tune → 보정(calibrate) 집합, holdout → 확인(check) 집합, 운영 최종 row(#84) → 보정 집합.
//         출력 local/eval/labels/targets.json (층·집합 정보는 여기에만 있다. 시트에는 넣지 않는다)
// - sheet: targets.json으로 라벨링 시트 한 장을 만든다 (local/eval/labels/sheet.html). judge 점수·이유는 넣지 않는다 (블라인드).
//          저장은 브라우저 localStorage, "JSON 내보내기"로 human-labels.json을 내려받는다
// - 읽기만 한다. DB에 접근하지 않는다. 회고 원문이 시트에 들어가므로 local/ 밖으로 내보내지 않는다

import type { EvalCase } from "./types.ts";

const DATASET = "local/eval/dataset";
const OUT = "local/eval/labels";
const DEFAULT_RUN = "20261028-185306-g9-final-all";

// 층별 목표 건수 (judge 점수가 low/mid/high인 콜백 메일). 모자라면 멈춘다
const QUOTA = {
  tune: { low: 1, mid: 4, high: 10 },
  holdout: { low: 1, mid: 4, high: 4 },
} as const;
const NO_SOURCE_QUOTA = { tune: 2, holdout: 1 } as const;
const OPS_EXPECT = 3;

type Stratum = "low" | "mid" | "high" | "none";

interface Target {
  labelId: string;
  origin: "ops" | "tune" | "holdout";
  set: "calibrate" | "check";
  kind: "callback" | "no_source";
  stratum: Stratum;
  // 하네스 case id 또는 운영 draft id
  ref: { caseId: string } | { draftId: string };
}

interface Material {
  kind: string;
  text: string;
  evidence: string;
}

interface Sections {
  opening: string;
  callback: string;
  callbackItem: number;
  commonQuestion: string;
  closing: string;
}

interface SheetItem {
  labelId: string;
  kind: "callback" | "no_source";
  month: string;
  materials: Material[];
  sections: Sections;
  notice: string[];
  source: { title: string; markdown: string } | null;
}

interface RunRecord {
  caseId: string;
  stage: string;
  output: Record<string, unknown>;
  scores?: Record<string, { value: number }>;
}

// 문자열 → 32비트 정수 (FNV-1a). 시드 고정 셔플에 쓴다
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await Deno.readTextFile(path)) as T;

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function stratumOf(r: RunRecord): Stratum {
  const v = ["grounded", "specific", "tone"].map((k) => r.scores?.[k]?.value);
  if (v.some((x) => x === undefined)) return "none";
  const min = Math.min(...(v as number[]));
  return min === 0 ? "low" : min < 1 ? "mid" : "high";
}

async function loadRun(run: string): Promise<Map<string, Record<string, RunRecord>>> {
  const text = await Deno.readTextFile(`local/eval/runs/${run}/records.jsonl`);
  const byCase = new Map<string, Record<string, RunRecord>>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as RunRecord;
    const m = byCase.get(r.caseId) ?? {};
    m[r.stage] = r;
    byCase.set(r.caseId, m);
  }
  return byCase;
}

function pickN<T extends { id: string }>(xs: T[], n: number, seed: string): T[] {
  return [...xs]
    .sort((a, b) => hash32(`${seed}:${a.id}`) - hash32(`${seed}:${b.id}`))
    .slice(0, n);
}

async function pick(args: string[]) {
  const run = arg(args, "--run") ?? DEFAULT_RUN;
  const seed = arg(args, "--seed") ?? "77";
  const byCase = await loadRun(run);
  const cases = new Map(
    (await readJson<EvalCase[]>(`${DATASET}/cases.json`)).map((c) => [c.id, c]),
  );
  const subset = async (name: string) =>
    new Set((await readJson<{ ids: string[] }>(`${DATASET}/subset-${name}.json`)).ids);
  const tune = await subset("tune");
  const holdout = await subset("holdout");

  const picked: Omit<Target, "labelId">[] = [];
  const short: string[] = [];

  // 하네스 콜백 메일: judge 점수 층별
  for (const [name, ids, set] of [
    ["tune", tune, "calibrate"],
    ["holdout", holdout, "check"],
  ] as const) {
    const pool = [...byCase.entries()]
      .filter(([id]) => ids.has(id) && cases.get(id)?.type === "callback")
      .map(([id, m]) => ({ id, stratum: stratumOf(m.judge) }))
      .filter((x) => x.stratum !== "none");
    for (const s of ["low", "mid", "high"] as const) {
      const cand = pool.filter((x) => x.stratum === s);
      const want = QUOTA[name][s];
      if (cand.length < want) short.push(`${name} ${s}: 후보 ${cand.length} < ${want}`);
      for (const x of pickN(cand, want, `${seed}:${name}:${s}`)) {
        picked.push({
          origin: name,
          set,
          kind: "callback",
          stratum: s,
          ref: { caseId: x.id },
        });
      }
    }
  }

  // no_source: 콜백 없이 생성된 메일
  for (const [name, ids, set] of [
    ["tune", tune, "calibrate"],
    ["holdout", holdout, "check"],
  ] as const) {
    const cand = [...byCase.entries()]
      .filter(
        ([id, m]) =>
          ids.has(id) &&
          cases.get(id)?.type === "no_source" &&
          (m.generate?.output as { result?: unknown })?.result,
      )
      .map(([id]) => ({ id }));
    const want = NO_SOURCE_QUOTA[name];
    if (cand.length < want) short.push(`${name} no_source: 후보 ${cand.length} < ${want}`);
    for (const x of pickN(cand, want, `${seed}:${name}:no_source`)) {
      picked.push({
        origin: name,
        set,
        kind: "no_source",
        stratum: "none",
        ref: { caseId: x.id },
      });
    }
  }

  // 운영 최종 row(#84): 콜백이 있고 발송 대상 아님이 아닌 것
  const reviews = await readJson<{ drafts: Array<{ id: string; isLatest: boolean; hasCallback: boolean }> }>(
    `${DATASET}/reviews.json`,
  );
  const tags = await readJson<{ labels: Record<string, { tags: string[] }> }>(
    `${DATASET}/review-tags.json`,
  );
  const ops = reviews.drafts.filter(
    (d) => d.isLatest && d.hasCallback && !tags.labels[d.id]?.tags.includes("not_target"),
  );
  if (ops.length !== OPS_EXPECT) short.push(`운영: ${ops.length} != ${OPS_EXPECT}`);
  for (const d of ops) {
    picked.push({
      origin: "ops",
      set: "calibrate",
      kind: "callback",
      stratum: "none",
      ref: { draftId: d.id },
    });
  }

  if (short.length > 0) {
    console.error("라벨 대상을 못 채웠어요:\n- " + short.join("\n- "));
    Deno.exit(1);
  }

  // 층이 순서로 드러나지 않게 섞은 뒤 번호를 매긴다
  const key = (t: Omit<Target, "labelId">) =>
    "caseId" in t.ref ? t.ref.caseId : t.ref.draftId;
  picked.sort((a, b) => hash32(`${seed}:order:${key(a)}`) - hash32(`${seed}:order:${key(b)}`));
  const targets: Target[] = picked.map((t, i) => ({
    labelId: `L${String(i + 1).padStart(2, "0")}`,
    ...t,
  }));

  await Deno.mkdir(OUT, { recursive: true });
  await Deno.writeTextFile(
    `${OUT}/targets.json`,
    JSON.stringify({ run, seed, targets }, null, 2) + "\n",
  );

  const count = (f: (t: Target) => boolean) => targets.filter(f).length;
  console.log(`라벨 대상 ${targets.length}건 → ${OUT}/targets.json (기준 run ${run}, 시드 ${seed})`);
  console.log(
    `  보정 ${count((t) => t.set === "calibrate")} · 확인 ${count((t) => t.set === "check")}` +
      ` | 콜백 ${count((t) => t.kind === "callback")} · no_source ${count((t) => t.kind === "no_source")}`,
  );
  for (const o of ["ops", "tune", "holdout"] as const) {
    const rows = targets.filter((t) => t.origin === o);
    const s = (x: Stratum) => rows.filter((t) => t.stratum === x).length;
    console.log(
      `  ${o}: ${rows.length}건 (low ${s("low")} · mid ${s("mid")} · high ${s("high")} · 층 없음 ${s("none")})`,
    );
  }
}

// --- 시트 ------------------------------------------------------------------------------

async function buildItems(): Promise<SheetItem[]> {
  const { run, targets } = await readJson<{ run: string; targets: Target[] }>(
    `${OUT}/targets.json`,
  );
  const byCase = await loadRun(run);
  const cases = new Map(
    (await readJson<EvalCase[]>(`${DATASET}/cases.json`)).map((c) => [c.id, c]),
  );
  const reviews = await readJson<{
    drafts: Array<{
      id: string;
      session: string;
      input: { materials: Material[]; notice?: { writeLine: string; scheduleLine: string } };
      output: { result: Sections };
    }>;
  }>(`${DATASET}/reviews.json`);

  return targets.map((t): SheetItem => {
    if ("draftId" in t.ref) {
      const id = t.ref.draftId;
      const d = reviews.drafts.find((x) => x.id === id);
      if (!d) throw new Error(`reviews.json에 draft ${id}가 없어요`);
      const n = d.input.notice;
      return {
        labelId: t.labelId,
        kind: t.kind,
        month: `${Number(d.session.split("-")[1])}월`,
        materials: d.input.materials,
        sections: d.output.result,
        notice: n ? [n.writeLine, n.scheduleLine] : [],
        // 운영 row의 원문은 평가셋에 없다. 재료(evidence)만 보여 준다
        source: null,
      };
    }
    const caseId = t.ref.caseId;
    const c = cases.get(caseId);
    const gen = byCase.get(caseId)?.generate?.output as
      | { materials: Material[]; result: Sections; notice: { writeLine: string; scheduleLine: string } }
      | undefined;
    if (!c || !gen?.result) throw new Error(`case ${caseId}의 생성 결과를 못 찾았어요`);
    return {
      labelId: t.labelId,
      kind: t.kind,
      month: `${Number(c.session.split("-")[1])}월`,
      materials: gen.materials,
      sections: gen.result,
      notice: [gen.notice.writeLine, gen.notice.scheduleLine],
      source: c.source ? { title: c.source.title, markdown: c.source.markdown } : null,
    };
  });
}

async function sheet() {
  const items = await buildItems();
  const review = await readJson<{ taxonomy: Record<string, { def: string }> }>(
    `${DATASET}/review-tags.json`,
  );
  const tags = Object.entries(review.taxonomy)
    .filter(([k]) => k !== "not_target")
    .map(([k, v]) => ({ key: k, def: v.def }));
  tags.push({ key: "timeliness", def: "시의성: 그 시점에 더 알맞은 대목이 있었다" });

  // 층·집합·출처는 시트에 넣지 않는다 (블라인드). </script> 방지를 위해 <를 이스케이프한다
  const data = JSON.stringify({ items, tags }).replace(/</g, "\\u003c");
  const html = SHEET_HTML.replace("__DATA__", () => data);
  await Deno.mkdir(OUT, { recursive: true });
  await Deno.writeTextFile(`${OUT}/sheet.html`, html);
  console.log(`라벨링 시트 ${items.length}건 → ${OUT}/sheet.html`);
}

const SHEET_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>갈피 메일 라벨링</title>
<style>
:root {
  --bg: #faf8f5; --card: #ffffff; --ink: #2b2623; --sub: #7a716a; --line: #e6e0d9;
  --accent: #8a5a3c; --chosen: #f3e9df; --ok: #4a7c59;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #1c1917; --card: #262220; --ink: #ece6df; --sub: #a1978d; --line: #3a3430; --accent: #d1a07c; --chosen: #3a2f27; --ok: #7fb58f; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.7 -apple-system, "Apple SD Gothic Neo", "Pretendard", system-ui, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 0 16px 96px; }
header { position: sticky; top: 0; z-index: 2; background: var(--bg); border-bottom: 1px solid var(--line); padding: 12px 0; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
header h1 { font-size: 16px; margin: 0; flex: 1; }
button { font: inherit; border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 8px; padding: 6px 12px; cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
details.rubric { margin: 16px 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); padding: 8px 16px; }
details.rubric summary { cursor: pointer; font-weight: 600; }
.card { margin: 20px 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); padding: 16px; }
.card.done { border-color: var(--ok); }
.card h2 { font-size: 13px; margin: 0 0 12px; color: var(--sub); font-weight: 600; }
.label { font-size: 12px; color: var(--sub); margin: 12px 0 4px; font-weight: 600; letter-spacing: .02em; }
.materials { margin: 0; padding: 0; list-style: none; font-size: 14px; }
.materials li { padding: 6px 10px; border-radius: 8px; margin-bottom: 4px; }
.materials li.chosen { background: var(--chosen); }
.materials .ev { color: var(--sub); display: block; font-size: 13px; }
.mail { white-space: pre-wrap; border-left: 3px solid var(--accent); padding: 4px 0 4px 12px; margin: 4px 0; }
.mail.notice { border-left-color: var(--line); color: var(--sub); font-size: 13px; }
.seg { font-size: 11px; color: var(--sub); margin-top: 8px; }
.score { margin-top: 12px; }
.score .name { font-weight: 600; display: inline-block; width: 64px; }
.score label { margin-right: 14px; cursor: pointer; white-space: nowrap; }
.opts { margin-top: 12px; font-size: 14px; }
.opts label { margin-right: 12px; white-space: nowrap; cursor: pointer; }
textarea { width: 100%; min-height: 56px; margin-top: 8px; font: inherit; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); padding: 8px; }
pre.src { white-space: pre-wrap; font: inherit; font-size: 14px; margin: 8px 0 0; }
.msg { color: var(--sub); font-size: 13px; }
</style>
</head>
<body>
<main>
<header>
  <h1>갈피 메일 라벨링 <span id="count" class="msg"></span></h1>
  <span id="msg" class="msg"></span>
  <button class="primary" id="export">JSON 내보내기</button>
</header>
<details class="rubric">
  <summary>점수 기준 (judge와 같은 정의)</summary>
  <p><b>grounded</b> 2 = 고른 재료의 근거(evidence)에 있는 사실만 짚음 · 1 = 요약에만 있거나 살짝 넘어감 · 0 = 사실이 틀리거나 지어냄</p>
  <p><b>specific</b> 2 = 이 사람에게만 보낼 수 있는 질문 · 1 = 재료를 짚지만 질문은 누구에게나 통함 · 0 = 누구에게나 할 수 있는 말</p>
  <p><b>tone</b> 2 = 담백하고 부담 없음 · 1 = 살짝 어색하거나 검사하는 투 기미 · 0 = 압박·이행 점검·과한 감정</p>
  <p><b>스펙 결함</b>: 프롬프트가 지시한 문구 때문에 생긴 문제(예: 정해진 여는 문장). 체크만 하고 항목 점수에서는 빼세요.</p>
  <p>콜백이 없는 메일은 tone만 매기세요. 기준이 애매하면 고민하지 말고 메모에 이유를 남기세요.</p>
</details>
<div id="list"></div>
</main>
<script>
var DATA = __DATA__;
var KEY = "checkin-labels-77";
var state = {};
try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { state = {}; }

function entry(id) {
  if (!state[id]) state[id] = { specDefect: false, tags: [], note: "" };
  return state[id];
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  refresh();
}
function needs(item) { return item.kind === "callback" ? ["grounded", "specific", "tone"] : ["tone"]; }
function isDone(item) {
  var e = state[item.labelId];
  return !!e && needs(item).every(function (k) { return typeof e[k] === "number"; });
}
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function refresh() {
  var done = 0;
  DATA.items.forEach(function (item) {
    var ok = isDone(item);
    if (ok) done++;
    var card = document.getElementById("card-" + item.labelId);
    if (card) card.className = "card" + (ok ? " done" : "");
  });
  document.getElementById("count").textContent = done + "/" + DATA.items.length + " 완료";
}
function seg(parent, name, text) {
  if (!text) return;
  parent.appendChild(el("div", "seg", name));
  parent.appendChild(el("div", "mail", text));
}
function scoreRow(item, key, label) {
  var row = el("div", "score");
  row.appendChild(el("span", "name", label));
  [0, 1, 2].forEach(function (v) {
    var lab = el("label");
    var inp = document.createElement("input");
    inp.type = "radio";
    inp.name = item.labelId + "-" + key;
    inp.checked = entry(item.labelId)[key] === v;
    inp.addEventListener("change", function () { entry(item.labelId)[key] = v; persist(); });
    lab.appendChild(inp);
    lab.appendChild(document.createTextNode(" " + v));
    row.appendChild(lab);
  });
  return row;
}
function render() {
  var list = document.getElementById("list");
  DATA.items.forEach(function (item, i) {
    var card = el("section", "card");
    card.id = "card-" + item.labelId;
    card.appendChild(el("h2", null, (i + 1) + " / " + DATA.items.length + " · " + item.labelId + " · " + item.month + " 회고 리마인더" + (item.kind === "no_source" ? " (직전 글 없음)" : "")));

    if (item.materials.length > 0) {
      card.appendChild(el("div", "label", "추출된 재료 (judge가 보는 것과 같음)"));
      var ul = el("ul", "materials");
      item.materials.forEach(function (m, idx) {
        var li = el("li", idx + 1 === item.sections.callbackItem ? "chosen" : "");
        li.appendChild(document.createTextNode((idx + 1) + ". [" + m.kind + "] " + m.text));
        li.appendChild(el("span", "ev", "근거: " + m.evidence));
        ul.appendChild(li);
      });
      card.appendChild(ul);
      if (item.sections.callbackItem > 0) card.appendChild(el("div", "msg", "음영 = 콜백에 고른 재료 (" + item.sections.callbackItem + "번)"));
    }

    card.appendChild(el("div", "label", "생성된 메일"));
    seg(card, "opening", item.sections.opening);
    seg(card, "callback", item.sections.callback);
    seg(card, "commonQuestion", item.sections.commonQuestion);
    seg(card, "closing", item.sections.closing);
    if (item.notice.length > 0) {
      card.appendChild(el("div", "seg", "공지 (코드가 붙임)"));
      card.appendChild(el("div", "mail notice", item.notice.join("\\n")));
    }

    if (item.source) {
      var det = el("details");
      det.appendChild(el("summary", "msg", "직전 회고 원문 펼치기 — " + item.source.title));
      det.appendChild(el("pre", "src", item.source.markdown));
      card.appendChild(det);
    }

    card.appendChild(el("div", "label", "점수"));
    if (item.kind === "callback") {
      card.appendChild(scoreRow(item, "grounded", "grounded"));
      card.appendChild(scoreRow(item, "specific", "specific"));
    }
    card.appendChild(scoreRow(item, "tone", "tone"));

    var opts = el("div", "opts");
    var sd = el("label");
    var sdi = document.createElement("input");
    sdi.type = "checkbox";
    sdi.checked = !!entry(item.labelId).specDefect;
    sdi.addEventListener("change", function () { entry(item.labelId).specDefect = sdi.checked; persist(); });
    sd.appendChild(sdi);
    sd.appendChild(document.createTextNode(" 스펙 결함이 있음"));
    opts.appendChild(sd);
    DATA.tags.forEach(function (t) {
      var l = el("label");
      l.title = t.def;
      var c = document.createElement("input");
      c.type = "checkbox";
      c.checked = entry(item.labelId).tags.indexOf(t.key) >= 0;
      c.addEventListener("change", function () {
        var e = entry(item.labelId);
        e.tags = e.tags.filter(function (x) { return x !== t.key; });
        if (c.checked) e.tags.push(t.key);
        persist();
      });
      l.appendChild(c);
      l.appendChild(document.createTextNode(" " + t.key));
      opts.appendChild(l);
    });
    card.appendChild(opts);

    var ta = document.createElement("textarea");
    ta.placeholder = "한 줄 메모 (기준이 애매했던 점, 왜 이 점수인지)";
    ta.value = entry(item.labelId).note || "";
    ta.addEventListener("input", function () { entry(item.labelId).note = ta.value; persist(); });
    card.appendChild(ta);

    list.appendChild(card);
  });
  refresh();
}
document.getElementById("export").addEventListener("click", function () {
  var labels = {};
  var missing = 0;
  DATA.items.forEach(function (item) {
    var e = state[item.labelId];
    if (!isDone(item)) missing++;
    if (e) labels[item.labelId] = e;
  });
  var out = { labeler: "danny", labeledAt: new Date().toISOString(), labels: labels };
  var blob = new Blob([JSON.stringify(out, null, 2) + "\\n"], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "human-labels.json";
  a.click();
  URL.revokeObjectURL(a.href);
  document.getElementById("msg").textContent = missing > 0 ? "내려받음 (미완료 " + missing + "건 포함)" : "내려받음";
});
render();
</script>
</body>
</html>
`;

const [cmd, ...rest] = Deno.args;
if (cmd === "pick") await pick(rest);
else if (cmd === "sheet") await sheet();
else {
  console.error("사용법: labels.ts pick [--run <runId>] [--seed 77] | sheet");
  Deno.exit(1);
}
