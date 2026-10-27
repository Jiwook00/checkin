// 기준 답안과 생성 결과를 나란히 보는 리포트 (Deno 2.x, #76)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/eval/reference-report.ts <runId> [<runId>...] [--out <파일>]
//
// - 점수가 아니라 눈으로 비교하는 용도다. 기준 답안 옆에 run마다 한 열씩 생성 결과·고른 재료·채점 이유를 놓는다
//   (예: v1 run과 최종 run을 함께 주면 같은 답안 옆에서 프롬프트 개선이 보인다)
// - 기준 답안 두 종류
//     7월 메일 4통: 평가셋의 reference case (reference.sections). 사서 메타포를 쓰던 때의 말투라 지금 규칙으로는 banned에 걸린다.
//                   대니 메일은 직전 회차 글이 없는데 콜백이 들어간 규칙 이탈(ruleDeviation)이라 정답이 아니라 말투 참고다
//     8월 메일 5통: letters/2026-08/reminder-*.html. 현재 스킬 규칙을 따라 사람이 다듬은 답안이고, 직전(7월) 회고를 짚는
//                   callback:*:2026-08 case와 짝이다. 반응(이모지·댓글)은 이번 단계 범위 밖이라 회색으로만 보인다
// - run에 없는 case는 "이 run에 없음"으로 표시한다 (--only로 9건만 돌려도 된다)
// - 출력은 기본 <마지막 runId>/reference.html. local/은 git 제외이고 회고 원문·개인 정보가 들어 있으니 밖으로 내보내지 않는다

import type { EvalCase } from "./types.ts";

const ROOT = new URL("../..", import.meta.url).pathname;
const RUNS_DIR = `${ROOT}local/eval/runs`;
const DATASET = `${ROOT}local/eval/dataset/cases.json`;

// 8월 메일 파일 이름(멤버 별칭) → 짝이 되는 case의 멤버 이름. 파일 이름이 곧 멤버 이름이다
const AUGUST_MEMBERS = ["두도", "원", "대니", "아이리스", "벨라"];

interface Score {
  value: number;
  reason?: string;
}
interface Rec {
  caseId: string;
  stage: string;
  status: string;
  output: any;
  scores: Record<string, Score>;
}
interface LoadedRun {
  id: string;
  label: string;
  records: Map<string, Rec>; // `${caseId}\0${stage}`
}

interface RefSection {
  title: string;
  text: string;
  muted?: boolean;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function loadRun(id: string): Promise<LoadedRun> {
  const dir = `${RUNS_DIR}/${id}`;
  let config: any;
  let raw: string;
  try {
    config = JSON.parse(await Deno.readTextFile(`${dir}/config.json`));
    raw = await Deno.readTextFile(`${dir}/records.jsonl`);
  } catch {
    console.error(`\n✗ run을 읽을 수 없어요: ${id}\n`);
    Deno.exit(1);
  }
  const records = new Map<string, Rec>();
  for (const l of raw.split("\n").filter(Boolean)) {
    const r = JSON.parse(l) as Rec;
    records.set(`${r.caseId}\u0000${r.stage}`, r);
  }
  const gen = config.stages?.find((s: any) => s.name === "generate");
  return {
    id,
    label: `${id} (생성 프롬프트 ${gen ? gen.promptSha256.slice(0, 8) : "?"}, 채점 ${config.judge?.model ?? "없음"})`,
    records,
  };
}

// 8월 메일 HTML → 구간. 고정 문형을 경계로 자른다
async function augustSections(name: string): Promise<RefSection[] | null> {
  let html: string;
  try {
    html = await Deno.readTextFile(
      `${ROOT}letters/2026-08/reminder-${name}.html`,
    );
  } catch {
    return null;
  }
  const text = html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
  const start = text.search(/안녕하세요 [^,]+님, 갈피예요\./);
  if (start < 0) return null;
  const body = text.slice(start);
  const markers: [string, string, boolean?][] = [
    ["인사", "안녕하세요"],
    ["콜백", "지난 회고 잘 읽었습니다."],
    ["반응 (이번 범위 밖)", "지난 글에 달린 반응", true],
    ["안내", "8월 회고도 이제 쓰실 수 있어요"],
    ["공통 질문", "이번 달 공통 질문"],
    ["CTA", "8월 회고 쓰러 가기"],
    ["공지", "다음 모임 —"],
    ["마무리", "그럼 다음 회고 때 봬요"],
  ];
  const found = markers
    .map(([title, key, muted]) => ({ title, idx: body.indexOf(key), muted }))
    .filter((m) => m.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  return found.map((m, i) => ({
    title: m.title,
    text: body.slice(m.idx, found[i + 1]?.idx ?? body.length).trim(),
    muted: m.muted,
  }));
}

function julySections(c: EvalCase): RefSection[] {
  const s = c.reference!.sections;
  const out: RefSection[] = [
    { title: "인사", text: s.opening },
    ...(s.callback ? [{ title: "콜백", text: s.callback }] : []),
    { title: "공통 질문", text: s.commonQuestion },
    { title: "공지", text: s.notice },
    { title: "마무리", text: s.closing },
  ];
  return out;
}

function scoreRows(run: LoadedRun, caseId: string): string {
  const rows: string[] = [];
  for (const stage of ["generate", "judge"]) {
    const r = run.records.get(`${caseId}\u0000${stage}`);
    if (!r) continue;
    for (const [g, s] of Object.entries(r.scores)) {
      const ok = s.value === 1;
      rows.push(
        `<tr class="${ok ? "ok" : "bad"}"><td>${esc(g)}</td><td>${s.value}</td><td>${esc(s.reason ?? "")}</td></tr>`,
      );
    }
  }
  return rows.length
    ? `<table class="scores"><tr><th>채점기</th><th>값</th><th>이유</th></tr>${rows.join("")}</table>`
    : "";
}

function generatedCell(run: LoadedRun, caseId: string): string {
  const g = run.records.get(`${caseId}\u0000generate`);
  if (!g) return `<p class="muted">이 run에 없음</p>`;
  const o = g.output;
  if (!o?.result) {
    return `<p class="bad">생성 실패: ${esc(o?.parseError ?? g.status)}</p>`;
  }
  const r = o.result;
  const materials: { kind: string; evidence: string; text: string }[] =
    o.materials ?? [];
  const chosen = r.callbackItem > 0 ? materials[r.callbackItem - 1] : null;
  const sec = (title: string, text: string) =>
    text.trim()
      ? `<div class="sec"><h4>${title}</h4><p>${esc(text)}</p></div>`
      : `<div class="sec"><h4>${title}</h4><p class="muted">(없음)</p></div>`;
  return [
    sec("인사", r.opening),
    sec("콜백", r.callback),
    chosen
      ? `<div class="sec material"><h4>고른 재료 #${r.callbackItem} (${esc(chosen.kind)})</h4><p>“${esc(chosen.evidence)}”</p></div>`
      : "",
    sec("공통 질문", r.commonQuestion),
    `<div class="sec muted-sec"><h4>공지 (코드)</h4><p>${esc(o.notice.writeLine)}<br>${esc(o.notice.scheduleLine)}</p></div>`,
    sec("마무리", r.closing),
    `<details><summary>재료 ${materials.length}개 (근거 검증 통과)</summary><ol>${materials
      .map((m) => `<li>[${esc(m.kind)}] ${esc(m.evidence)}</li>`)
      .join("")}</ol></details>`,
    scoreRows(run, caseId),
  ].join("");
}

async function main() {
  const args = [...Deno.args];
  let out: string | undefined;
  const oi = args.indexOf("--out");
  if (oi !== -1) {
    out = args[oi + 1];
    args.splice(oi, 2);
  }
  if (args.length === 0) {
    console.error(
      "\n사용법: reference-report.ts <runId> [<runId>...] [--out <파일>]\n",
    );
    Deno.exit(1);
  }
  const runs = await Promise.all(args.map(loadRun));
  const cases: EvalCase[] = JSON.parse(await Deno.readTextFile(DATASET));

  interface Entry {
    caseId: string;
    heading: string;
    badges: string[];
    sections: RefSection[];
  }
  const entries: Entry[] = [];
  for (const c of cases.filter((x) => x.type === "reference")) {
    const badges = [
      "7월 메일 · 사서 메타포를 쓰던 때의 말투 (지금 규칙에서는 금지)",
    ];
    if (c.ruleDeviation)
      badges.push(`규칙 이탈 — 정답 아님, 말투 참고만: ${c.ruleDeviation}`);
    entries.push({
      caseId: c.id,
      heading: `${c.memberName} · ${c.id}`,
      badges,
      sections: julySections(c),
    });
  }
  for (const name of AUGUST_MEMBERS) {
    const c = cases.find(
      (x) =>
        x.type === "callback" &&
        x.session === "2026-08" &&
        x.memberName === name,
    );
    const sections = await augustSections(name);
    if (!c || !sections) {
      console.warn(`! 8월 ${name}: case 또는 메일 파일이 없어 건너뛰어요`);
      continue;
    }
    entries.push({
      caseId: c.id,
      heading: `${name} · ${c.id}`,
      badges: ["8월 메일 · 현재 규칙을 따라 사람이 다듬은 답안"],
      sections,
    });
  }

  const cards = entries.map((e) => {
    const ref = e.sections
      .map(
        (s) =>
          `<div class="sec${s.muted ? " muted-sec" : ""}"><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></div>`,
      )
      .join("");
    return `<section class="card">
<h3>${esc(e.heading)}</h3>
${e.badges.map((b) => `<p class="badge">${esc(b)}</p>`).join("")}
<div class="cols" style="--n:${runs.length + 1}">
<div class="col"><h2>기준 답안</h2>${ref}</div>
${runs.map((r) => `<div class="col"><h2>${esc(r.label)}</h2>${generatedCell(r, e.caseId)}</div>`).join("")}
</div>
</section>`;
  });

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>기준 답안 비교</title>
<style>
body{font:14px/1.6 -apple-system,"Apple SD Gothic Neo",sans-serif;margin:0;padding:24px;background:#fafaf8;color:#222}
h1{font-size:18px} h2{font-size:12px;color:#666;margin:0 0 8px;word-break:break-all}
h3{font-size:15px;margin:0 0 4px} h4{font-size:11px;color:#888;margin:8px 0 2px;font-weight:600}
p{margin:0;white-space:pre-wrap}
.warn{color:#a33;font-size:12px}
.card{background:#fff;border:1px solid #e5e3dc;border-radius:10px;padding:16px;margin:0 0 20px}
.cols{display:grid;grid-template-columns:repeat(var(--n),minmax(280px,1fr));gap:16px;overflow-x:auto}
.col{min-width:0;border-left:3px solid #eee;padding-left:12px}
.col:first-child{border-left-color:#c9b27c}
.badge{font-size:12px;color:#7a5c00;background:#fff6d6;border-radius:4px;padding:2px 8px;margin:2px 0;display:inline-block}
.muted,.muted-sec p{color:#999}
.material p{background:#f3f7ff;padding:4px 8px;border-radius:4px;font-size:13px}
.bad{color:#a33}
table.scores{border-collapse:collapse;font-size:12px;margin-top:10px;width:100%}
.scores td,.scores th{border-top:1px solid #eee;padding:3px 6px;text-align:left;vertical-align:top}
.scores tr.ok td:first-child{color:#2a7}
.scores tr.bad td:first-child{color:#a33}
details{font-size:12px;margin-top:8px;color:#555}
</style></head><body>
<h1>기준 답안 ↔ 생성 결과</h1>
<p class="warn">회고 원문·개인 정보가 들어 있어요. local/ 밖으로 내보내지 마세요. 점수보다 눈으로 비교하는 용도예요.</p>
<p>run: ${runs.map((r) => esc(r.label)).join(" · ")}</p>
${cards.join("\n")}
</body></html>
`;
  const path = out ?? `${RUNS_DIR}/${runs.at(-1)!.id}/reference.html`;
  await Deno.writeTextFile(path, html);
  console.log(`\n✓ ${entries.length}건 → ${path}\n`);
}

if (import.meta.main) await main();
