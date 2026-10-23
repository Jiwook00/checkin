// 리마인더 평가셋 추출 (Deno 2.x, #73)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/eval-dataset.ts [--check]
//
// - DB에서 SELECT만 한다. DB에는 아무것도 쓰지 않는다 (.env의 VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요)
// - 결과: local/eval/dataset/cases.json     (case 목록, id 순 정렬, 시각 정보 없음 → 같은 DB면 같은 파일)
//         local/eval/dataset/subset-dev.json (개발용 서브셋 20건: seed·층 구성·id)
//         local/eval/dataset/summary.md      (유형별 건수, 본문 길이 분포, 멤버별 건수, 기준선 대비)
//         local/eval/dataset/manifest.json   (case id 목록 해시, git 커밋, 생성 시각)
//         local/eval/dataset/build-log.json  (중복 제거·제외 내역)
//   local/은 git 제외다. 회고 원문이 들어가므로 이 밖으로 내보내지 않는다
// - --check: 파일을 쓰지 않고 다시 계산해 manifest와 비교한다. 같으면 exit 0, case id가 달라졌으면 exit 1
//
// reference case: local/메일예시/checkin-galpi-<영문이름>-2026-07.html 에 발송한 메일을 둔다.
//   없으면 reference 0건으로 계속 진행한다 (local/이라 다른 환경에는 없을 수 있다)
//
// 평가 단위: 멤버 m이 회차 N+1에 글을 썼다면, "N+1 글을 쓰기 전에 받았을 리마인더"가 case 하나다.
//   N = 존재하는 회차를 정렬한 순서상 직전 회차 (2024-12처럼 빠진 달은 건너뛴다)
//   - callback  : m의 N 글이 본문 정상      → 콜백이 들어가야 한다
//   - no_source : m의 N 글이 failed          → 콜백이 없어야 정답 (reason: parse_failed)
//                 m의 N 글이 없음            → 콜백이 없어야 정답 (reason: not_participated)
//   - 판정하기 애매한 글(degraded, 200자 이하 직접 작성)이 N 글이면 case를 만들지 않고 제외 사유를 남긴다
//   N+1에 참여하지 않은 멤버는 case가 없다 (callback/no_source가 같은 모집단을 보게 하려고)
//
// 중복 제거 (본문 앞 80자 비교는 쓰지 않는다 — KPT 템플릿·이미지 머리말이 같은 서로 다른 글이 중복으로 잡힌다):
//   1) 같은 멤버·같은 회차의 여러 글 → 하나만: 본문 정상 > 본문 길이 > 먼저 등록 > id
//   2) 같은 멤버의 다른 회차에 본문이 공백 정규화 후 완전히 같은 글 → 가장 이른 회차만 남긴다

import { createClient } from "@supabase/supabase-js";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT_DIR = `${ROOT}local/eval/dataset`;

// 직접 작성 글이 이 글자 수를 넘어야 본문 정상으로 본다
const WRITTEN_MIN_CHARS = 200;
// supabase-js 기본 조회 상한. 넘으면 일부만 읽은 채 평가셋을 만들게 되므로 멈춘다
const QUERY_ROW_LIMIT = 1000;

export type CaseType = "callback" | "no_source" | "reference";

export interface EvalCase {
  id: string;
  type: CaseType;
  memberId: string;
  memberName: string;
  // 멤버가 이번에 쓰게 될 회고 회차 (N+1)
  session: string;
  // 콜백 대상이 되는 직전 회차 (N)
  prevSession: string;
  // 이 case에서 콜백이 들어가는 게 정답인가. 채점기는 type 대신 이 값만 본다
  expectCallback: boolean;
  reason?: "parse_failed" | "not_participated";
  source: {
    retroId: string;
    title: string;
    markdown: string;
    chars: number;
  } | null;
  // reference 전용: 실제로 발송한 메일 (참고 답안)
  reference?: ReferenceMail;
  // 같은 멤버·회차의 callback/no_source case id
  pairedWith?: string;
  // 발송한 메일이 이 case의 expectCallback과 어긋날 때 이유
  ruleDeviation?: string;
}

// 메일의 큰 틀 5단계. 직전 회차 글이 없으면 callback은 null이다
export interface ReferenceMail {
  file: string;
  sections: {
    opening: string;
    callback: string | null;
    commonQuestion: string;
    notice: string;
    closing: string;
  };
  // 위 구간을 메일에 나온 순서대로 이은 본문 (preheader·푸터 제외)
  text: string;
}

interface RetroRow {
  id: string;
  title: string;
  session: string;
  member_id: string;
  content_type: "url" | "written";
  parse_status: "ok" | "degraded" | "failed" | null;
  content_markdown: string | null;
  created_at: string;
}

type BodyState = "normal" | "failed" | "ambiguous";

interface Retro extends RetroRow {
  markdown: string;
  state: BodyState;
}

interface Dropped {
  retroId: string;
  memberName: string;
  session: string;
  reason: "same_session_duplicate" | "same_body_other_session";
  keptRetroId: string;
  keptSession: string;
}

interface Excluded {
  memberName: string;
  session: string;
  prevSession: string;
  reason: string;
}

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  Deno.exit(1);
}

async function loadEnv(): Promise<Record<string, string>> {
  let raw = "";
  try {
    raw = await Deno.readTextFile(`${ROOT}.env`);
  } catch {
    die(".env 파일을 찾을 수 없어요. 프로젝트 루트에 있어야 해요.");
  }
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

function classify(row: RetroRow): Retro {
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
function compareRepresentative(a: Retro, b: Retro): number {
  const rank = (r: Retro) =>
    r.state === "normal" ? 0 : r.state === "ambiguous" ? 1 : 2;
  return (
    rank(a) - rank(b) ||
    b.markdown.length - a.markdown.length ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

function dedupe(retros: Retro[], nick: Map<string, string>) {
  const dropped: Dropped[] = [];

  // 1) 같은 멤버·같은 회차
  const bySlot = new Map<string, Retro[]>();
  for (const r of retros) {
    const k = `${r.member_id}:${r.session}`;
    (bySlot.get(k) ?? bySlot.set(k, []).get(k)!).push(r);
  }
  let kept: Retro[] = [];
  for (const group of bySlot.values()) {
    const sorted = [...group].sort(compareRepresentative);
    kept.push(sorted[0]);
    for (const loser of sorted.slice(1)) {
      dropped.push({
        retroId: loser.id,
        memberName: nick.get(loser.member_id) ?? loser.member_id,
        session: loser.session,
        reason: "same_session_duplicate",
        keptRetroId: sorted[0].id,
        keptSession: sorted[0].session,
      });
    }
  }

  // 2) 같은 멤버의 다른 회차에 같은 본문 → 가장 이른 회차만
  const byBody = new Map<string, Retro[]>();
  for (const r of kept) {
    const body = normalize(r.markdown);
    if (!body) continue;
    const k = `${r.member_id}:${body}`;
    (byBody.get(k) ?? byBody.set(k, []).get(k)!).push(r);
  }
  const dropIds = new Set<string>();
  for (const group of byBody.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => a.session.localeCompare(b.session) || a.id.localeCompare(b.id),
    );
    for (const loser of sorted.slice(1)) {
      dropIds.add(loser.id);
      dropped.push({
        retroId: loser.id,
        memberName: nick.get(loser.member_id) ?? loser.member_id,
        session: loser.session,
        reason: "same_body_other_session",
        keptRetroId: sorted[0].id,
        keptSession: sorted[0].session,
      });
    }
  }
  const crossDropped = new Set(
    kept
      .filter((r) => dropIds.has(r.id))
      .map((r) => `${r.member_id}:${r.session}`),
  );
  kept = kept.filter((r) => !dropIds.has(r.id));

  dropped.sort(
    (a, b) =>
      a.session.localeCompare(b.session) || a.retroId.localeCompare(b.retroId),
  );
  return { kept, dropped, crossDropped };
}

function buildCases(
  kept: Retro[],
  crossDropped: Set<string>,
  nick: Map<string, string>,
) {
  const timeline = [...new Set(kept.map((r) => r.session))].sort();
  const bySlot = new Map(kept.map((r) => [`${r.member_id}:${r.session}`, r]));
  const memberIds = [...new Set(kept.map((r) => r.member_id))];

  const cases: EvalCase[] = [];
  const excluded: Excluded[] = [];

  for (const memberId of memberIds) {
    const memberName = nick.get(memberId) ?? memberId;
    for (let i = 1; i < timeline.length; i++) {
      const session = timeline[i];
      const prevSession = timeline[i - 1];
      const current = bySlot.get(`${memberId}:${session}`);
      const prev = bySlot.get(`${memberId}:${prevSession}`);
      const wrote = Boolean(current);

      // 이번 회차 글이 다른 회차와 본문이 같아 빠진 경우: 참여 여부를 단정할 수 없다
      if (!wrote && crossDropped.has(`${memberId}:${session}`)) {
        excluded.push({
          memberName,
          session,
          prevSession,
          reason: "duplicate_body_current",
        });
        continue;
      }
      if (!wrote) continue; // N+1에 참여하지 않으면 case가 없다

      const base = {
        memberId,
        memberName,
        session,
        prevSession,
      };
      const id = (type: CaseType) =>
        `${type}:${memberId.slice(0, 8)}:${session}`;

      if (!prev) {
        if (crossDropped.has(`${memberId}:${prevSession}`)) {
          excluded.push({
            memberName,
            session,
            prevSession,
            reason: "duplicate_body_prev",
          });
          continue;
        }
        cases.push({
          id: id("no_source"),
          type: "no_source",
          ...base,
          expectCallback: false,
          reason: "not_participated",
          source: null,
        });
      } else if (prev.state === "failed") {
        cases.push({
          id: id("no_source"),
          type: "no_source",
          ...base,
          expectCallback: false,
          reason: "parse_failed",
          source: null,
        });
      } else if (prev.state === "normal") {
        cases.push({
          id: id("callback"),
          type: "callback",
          ...base,
          expectCallback: true,
          source: {
            retroId: prev.id,
            title: prev.title,
            markdown: prev.markdown,
            chars: prev.markdown.length,
          },
        });
      } else {
        excluded.push({
          memberName,
          session,
          prevSession,
          reason: `ambiguous_prev(${prev.parse_status ?? prev.content_type}, ${prev.markdown.length}자)`,
        });
      }
    }
  }

  cases.sort((a, b) => a.id.localeCompare(b.id));
  excluded.sort(
    (a, b) =>
      a.session.localeCompare(b.session) ||
      a.memberName.localeCompare(b.memberName),
  );
  return { cases, excluded, timeline };
}

// --- reference: 7월에 발송한 메일 ------------------------------------------
// 파일명의 영문 이름 → 닉네임. 메일 형식이 바뀔 예정이라 "그대로 맞출 정답"이 아니라 참고 답안으로만 쓴다
const REFERENCE_DIR = `${ROOT}local/메일예시`;
const REFERENCE_SESSION = "2026-07";
const REFERENCE_MEMBERS: Record<string, string> = {
  danny: "대니",
  iris: "아이리스",
  roni: "로니",
  dudo: "두도",
};

function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<(style|head|script)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|td|th|h\d|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return text
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

// 메일의 구간을 고정 문구로 자른다. 문구를 못 찾으면 조용히 잘못 자르지 않고 멈춘다
export function splitMail(file: string, html: string): ReferenceMail {
  const lines = htmlToLines(html);
  const find = (pred: (l: string) => boolean, from = 0) => {
    for (let i = from; i < lines.length; i++) if (pred(lines[i])) return i;
    return -1;
  };
  const starts = (p: string) => (l: string) => l.startsWith(p);

  const iOpen = find((l) => l === "안녕하세요, 저는 갈피예요");
  if (iOpen < 0)
    die(`${file}: 인사 구간("안녕하세요, 저는 갈피예요")을 찾지 못했어요.`);
  const iCb = find(
    (l) =>
      l.startsWith("지난달 남겨주신 글") ||
      l.startsWith("지난 회고에 남겨주신 글"),
    iOpen,
  );
  const iQ = find(starts("그리고 이번 달엔"), iOpen);
  const iClose = find(starts("이번 달 못 오시게"), iOpen);
  const iNotice = find(starts("이번 달 만남은"), iOpen);
  const iCta = find((l) => l === "이번 달 회고 쓰러 가기", iOpen);
  for (const [name, i] of [
    ["공통 질문", iQ],
    ["마무리", iClose],
    ["안내", iNotice],
    ["CTA", iCta],
  ] as const)
    if (i < 0) die(`${file}: ${name} 구간을 찾지 못했어요.`);
  const ordered = [
    iOpen,
    ...(iCb >= 0 ? [iCb] : []),
    iQ,
    iClose,
    iNotice,
    iCta,
  ];
  if (ordered.some((v, k) => k > 0 && v <= ordered[k - 1]))
    die(`${file}: 구간 순서가 예상과 달라요 (${ordered.join(" < ")}).`);

  const join = (a: number, b: number) => lines.slice(a, b).join("\n");
  const opening = join(iOpen + 1, iCb >= 0 ? iCb : iQ);
  const callback = iCb >= 0 ? join(iCb, iQ) : null;
  const commonQuestion = join(iQ, iClose);
  const closing = `${join(iClose, iNotice)}\n${lines[iCta]}`;
  const notice = join(iNotice, iCta);
  const sections = { opening, callback, commonQuestion, notice, closing };

  const text = [opening, callback, commonQuestion, closing, notice]
    .filter((s) => s !== null)
    .join("\n\n");
  return { file, sections, text };
}

async function buildReferences(
  kept: Retro[],
  nick: Map<string, string>,
  cases: EvalCase[],
  timeline: string[],
): Promise<EvalCase[]> {
  const idOf = new Map([...nick].map(([id, name]) => [name, id]));
  const sessionIdx = timeline.indexOf(REFERENCE_SESSION);
  if (sessionIdx < 1) {
    console.warn(
      `  ! 회차 ${REFERENCE_SESSION}가 타임라인에 없어 reference를 건너뛰어요.`,
    );
    return [];
  }
  const prevSession = timeline[sessionIdx - 1];
  const bySlot = new Map(kept.map((r) => [`${r.member_id}:${r.session}`, r]));
  const caseIds = new Set(cases.map((c) => c.id));

  let entries: Deno.DirEntry[] = [];
  try {
    entries = [...Deno.readDirSync(REFERENCE_DIR)];
  } catch {
    console.warn(`  ! ${REFERENCE_DIR} 가 없어 reference 0건으로 진행해요.`);
    return [];
  }

  const refs: EvalCase[] = [];
  for (const entry of entries) {
    const m = entry.name.match(
      new RegExp(`^checkin-galpi-(\\w+)-${REFERENCE_SESSION}\\.html$`),
    );
    if (!m) continue;
    const name = REFERENCE_MEMBERS[m[1]];
    if (!name)
      die(`${entry.name}: 영문 이름 '${m[1]}'의 닉네임 매핑이 없어요.`);
    const memberId = idOf.get(name);
    if (!memberId)
      die(`${entry.name}: 닉네임 '${name}' 멤버를 DB에서 찾지 못했어요.`);

    const mail = splitMail(
      entry.name,
      await Deno.readTextFile(`${REFERENCE_DIR}/${entry.name}`),
    );
    const prev = bySlot.get(`${memberId}:${prevSession}`);
    const expectCallback = prev?.state === "normal";
    const id = `reference:${memberId.slice(0, 8)}:${REFERENCE_SESSION}`;
    const paired = [`callback`, `no_source`]
      .map((t) => `${t}:${memberId.slice(0, 8)}:${REFERENCE_SESSION}`)
      .find((c) => caseIds.has(c));

    let ruleDeviation: string | undefined;
    const hasCallback = mail.sections.callback !== null;
    if (hasCallback && !expectCallback)
      ruleDeviation = `메일에는 콜백이 있지만 직전 회차(${prevSession})에 본문 정상 글이 없다`;
    else if (!hasCallback && expectCallback)
      ruleDeviation = `직전 회차(${prevSession}) 글이 있는데 메일에 콜백이 없다`;

    refs.push({
      id,
      type: "reference",
      memberId,
      memberName: name,
      session: REFERENCE_SESSION,
      prevSession,
      expectCallback,
      source:
        prev?.state === "normal"
          ? {
              retroId: prev.id,
              title: prev.title,
              markdown: prev.markdown,
              chars: prev.markdown.length,
            }
          : null,
      reference: mail,
      ...(paired ? { pairedWith: paired } : {}),
      ...(ruleDeviation ? { ruleDeviation } : {}),
    });
  }
  if (refs.length === 0)
    console.warn(
      `  ! ${REFERENCE_DIR} 에 ${REFERENCE_SESSION} 메일이 없어 reference 0건이에요.`,
    );
  return refs.sort((a, b) => a.id.localeCompare(b.id));
}

// --- 개발용 서브셋 ----------------------------------------------------------
// 유형 × 본문 길이로 층화하고, seed를 고정해 같은 case 목록이면 같은 20건이 나온다.
const SUBSET_SEED = 73;
// callback 본문 길이 3구간 경계. 3분위수(3605 / 5054)를 보고 한 번 정해 고정한다 (데이터가 늘어도 구간이 움직이지 않게)
const LENGTH_BOUNDS = [3600, 5050];
const LENGTH_LABELS = [
  `~${LENGTH_BOUNDS[0]}자`,
  `${LENGTH_BOUNDS[0] + 1}~${LENGTH_BOUNDS[1]}자`,
  `${LENGTH_BOUNDS[1] + 1}자~`,
];
// 층별 목표 건수. reference는 4통 전부 넣는다
const SUBSET_PLAN = [
  { name: "callback · 짧음", want: 3 },
  { name: "callback · 중간", want: 3 },
  { name: "callback · 긺", want: 3 },
  { name: "no_source · parse_failed", want: 4 },
  { name: "no_source · not_participated", want: 3 },
  { name: "reference", want: Infinity },
];
// 같은 멤버가 한 그룹(callback / no_source)에서 이 건수를 넘어 뽑히지 않게 한다
const MEMBER_CAP = 2;

// 이슈 #72/#73에 적힌 2026-10-23 DB 조회 기준선
const BASELINE = { rows: 217, normal: 168, failed: 48, callback: 142 };

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const lengthBucket = (chars: number) =>
  chars <= LENGTH_BOUNDS[0] ? 0 : chars <= LENGTH_BOUNDS[1] ? 1 : 2;

interface Stratum {
  name: string;
  want: number | null;
  ids: string[];
  note?: string;
}

function buildSubset(cases: EvalCase[]) {
  const callbacks = cases.filter((c) => c.type === "callback");
  const pools: EvalCase[][] = [
    ...[0, 1, 2].map((b) =>
      callbacks.filter((c) => lengthBucket(c.source!.chars) === b),
    ),
    cases.filter((c) => c.reason === "parse_failed"),
    cases.filter((c) => c.reason === "not_participated"),
    cases.filter((c) => c.type === "reference"),
  ];
  // 멤버 상한은 callback 3층이 함께, no_source 2층이 함께 센다
  const capGroups = [0, 0, 0, 1, 1, 2];
  const used = [
    new Map<string, number>(),
    new Map<string, number>(),
    new Map<string, number>(),
  ];

  const strata: Stratum[] = [];
  pools.forEach((pool, k) => {
    const plan = SUBSET_PLAN[k];
    const want = Math.min(plan.want, pool.length);
    // 층마다 PRNG를 따로 둬서 다른 층의 소비량이 이 층의 결과를 바꾸지 않게 한다
    const rand = mulberry32(SUBSET_SEED * 1000 + k);
    const order = shuffle(
      [...pool].sort((a, b) => a.id.localeCompare(b.id)),
      rand,
    );
    const cap = capGroups[k] === 2 ? Infinity : MEMBER_CAP;
    const taken: EvalCase[] = [];
    for (const c of order) {
      if (taken.length >= want) break;
      if ((used[capGroups[k]].get(c.memberId) ?? 0) >= cap) continue;
      taken.push(c);
      used[capGroups[k]].set(
        c.memberId,
        (used[capGroups[k]].get(c.memberId) ?? 0) + 1,
      );
    }
    let note: string | undefined;
    if (taken.length < want) {
      // 상한 때문에 못 채우면 상한을 무시하고 채운다. 조용히 넘기지 않고 남긴다
      for (const c of order) {
        if (taken.length >= want) break;
        if (!taken.includes(c)) taken.push(c);
      }
      note = "멤버 상한(2건)을 넘겨 채움";
    }
    if (plan.want !== Infinity && pool.length < plan.want)
      note = `후보가 ${pool.length}건뿐이라 목표 ${plan.want}건을 채우지 못함`;
    strata.push({
      name: plan.name,
      want: plan.want === Infinity ? null : plan.want,
      ids: taken.map((c) => c.id).sort(),
      note,
    });
  });
  const ids = strata.flatMap((s) => s.ids).sort();
  return { seed: SUBSET_SEED, lengthBounds: LENGTH_BOUNDS, strata, ids };
}

// --- 요약 · manifest -------------------------------------------------------
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function gitCommit(): Promise<string> {
  try {
    const out = await new Deno.Command("git", {
      args: ["rev-parse", "--short", "HEAD"],
      cwd: ROOT,
    }).output();
    return new TextDecoder().decode(out.stdout).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

const percentile = (sorted: number[], p: number) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
    : 0;

// 기준선과 같은 정의(중복 제거·제외 전): 직전 회차에 본문 정상 글이 있고 이번 회차에도 글이 있는 (멤버, 회차) 쌍
function baselineStyleCallbacks(retros: Retro[]): number {
  const sessions = [...new Set(retros.map((r) => r.session))].sort();
  const prevOf = new Map(sessions.map((s, i) => [s, sessions[i - 1]]));
  const wrote = new Set(retros.map((r) => `${r.member_id}:${r.session}`));
  const normalAt = new Set(
    retros
      .filter((r) => r.state === "normal")
      .map((r) => `${r.member_id}:${r.session}`),
  );
  let n = 0;
  for (const key of wrote) {
    const [memberId, session] = [key.slice(0, 36), key.slice(37)];
    const prev = prevOf.get(session);
    if (prev && normalAt.has(`${memberId}:${prev}`)) n++;
  }
  return n;
}

function buildSummary(args: {
  retros: Retro[];
  kept: Retro[];
  dropped: Dropped[];
  excluded: Excluded[];
  cases: EvalCase[];
  subset: ReturnType<typeof buildSubset>;
}): string {
  const { retros, kept, dropped, excluded, cases, subset } = args;
  const byType = (f: (c: EvalCase) => boolean) => cases.filter(f).length;
  const callbacks = cases.filter((c) => c.type === "callback");
  const lens = callbacks.map((c) => c.source!.chars).sort((a, b) => a - b);
  const bucketCounts = [0, 1, 2].map(
    (b) => callbacks.filter((c) => lengthBucket(c.source!.chars) === b).length,
  );
  const rawNormal = retros.filter((r) => r.state === "normal").length;
  const rawFailed = retros.filter((r) => r.state === "failed").length;
  const rawAmbiguous = retros.length - rawNormal - rawFailed;
  const baselineCb = baselineStyleCallbacks(retros);
  const diff = (a: number, b: number) => (a - b > 0 ? `+${a - b}` : `${a - b}`);

  const L: string[] = [];
  L.push("# 평가셋 요약", "");
  L.push("## 기준선 대비", "");
  L.push("| 항목 | 기준선 | 이번 | 차이 |", "| --- | ---: | ---: | ---: |");
  const row = (name: string, base: number, now: number) =>
    L.push(`| ${name} | ${base} | ${now} | ${diff(now, base)} |`);
  row("회고 (멤버 × 회차, 원본 행)", BASELINE.rows, retros.length);
  row("본문 정상 (ok 또는 직접 작성 200자 초과)", BASELINE.normal, rawNormal);
  row("본문 없음 (failed)", BASELINE.failed, rawFailed);
  row(
    "콜백 사례 — 기준선과 같은 정의 (중복 제거 전)",
    BASELINE.callback,
    baselineCb,
  );
  row(
    "callback case — 중복 제거·제외 후",
    BASELINE.callback,
    byType((c) => c.type === "callback"),
  );
  L.push("");
  L.push(
    `판정이 애매해 본문 정상·없음 어디에도 안 들어간 원본 행: ${rawAmbiguous}건`,
    "",
  );

  L.push("## 유형별 건수", "");
  L.push("| 유형 | 건수 |", "| --- | ---: |");
  L.push(`| callback | ${byType((c) => c.type === "callback")} |`);
  L.push(
    `| no_source · parse_failed | ${byType((c) => c.reason === "parse_failed")} |`,
  );
  L.push(
    `| no_source · not_participated | ${byType((c) => c.reason === "not_participated")} |`,
  );
  L.push(`| reference | ${byType((c) => c.type === "reference")} |`);
  L.push(`| **합계** | **${cases.length}** |`, "");

  L.push("## callback 본문 길이 분포", "");
  L.push(
    `min ${lens[0]} · p25 ${percentile(lens, 0.25)} · p50 ${percentile(lens, 0.5)} · p75 ${percentile(lens, 0.75)} · max ${lens[lens.length - 1]} (글자 수)`,
    "",
  );
  L.push("| 구간 | 건수 |", "| --- | ---: |");
  LENGTH_LABELS.forEach((l, i) => L.push(`| ${l} | ${bucketCounts[i]} |`));
  L.push("");

  L.push("## 멤버별 건수", "");
  L.push(
    "| 멤버 | callback | parse_failed | not_participated | reference | 합계 |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  );
  const names = [...new Set(cases.map((c) => c.memberName))].sort();
  for (const n of names) {
    const mine = cases.filter((c) => c.memberName === n);
    const c = (f: (x: EvalCase) => boolean) => mine.filter(f).length;
    L.push(
      `| ${n} | ${c((x) => x.type === "callback")} | ${c((x) => x.reason === "parse_failed")} | ${c((x) => x.reason === "not_participated")} | ${c((x) => x.type === "reference")} | ${mine.length} |`,
    );
  }
  L.push("");

  L.push("## 중복 제거 · 제외", "");
  L.push(`원본 ${retros.length}행 → 중복 제거 후 ${kept.length}건`, "");
  for (const d of dropped)
    L.push(
      `- 중복 제거: ${d.memberName} ${d.session} (${d.reason}) → ${d.keptSession} 유지`,
    );
  for (const e of excluded)
    L.push(
      `- 제외: ${e.memberName} ${e.session} ← ${e.prevSession}: ${e.reason}`,
    );
  L.push("");

  L.push("## 개발용 서브셋", "");
  L.push(`seed ${subset.seed} · 총 ${subset.ids.length}건`, "");
  const byId = new Map(cases.map((c) => [c.id, c]));
  for (const s of subset.strata) {
    L.push(
      `**${s.name}** (${s.ids.length}/${s.want ?? "전부"})${s.note ? ` — ${s.note}` : ""}`,
    );
    for (const id of s.ids) {
      const c = byId.get(id)!;
      L.push(
        `- ${id} · ${c.memberName}${c.source ? ` · ${c.source.chars}자` : ""}`,
      );
    }
    L.push("");
  }
  return L.join("\n");
}

async function writeJson(path: string, data: unknown) {
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2) + "\n");
}

async function build() {
  const env = await loadEnv();
  if (!env.VITE_SUPABASE_URL) die(".env에 VITE_SUPABASE_URL이 없어요.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY)
    die("SUPABASE_SERVICE_ROLE_KEY가 .env에 없어요 (VITE_ 프리픽스 없이).");
  const sb = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: members, error: mErr } = await sb
    .from("checkin_members")
    .select("id, nickname");
  if (mErr) die(`멤버 조회 실패: ${mErr.message}`);
  const { data: rows, error: rErr } = await sb
    .from("checkin_retrospectives")
    .select(
      "id, title, session, member_id, content_type, parse_status, content_markdown, created_at",
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (rErr) die(`회고 조회 실패: ${rErr.message}`);
  if ((rows ?? []).length >= QUERY_ROW_LIMIT)
    die(
      `회고가 ${QUERY_ROW_LIMIT}건 이상이에요. 페이지네이션을 추가해야 해요.`,
    );

  const nick = new Map(
    (members ?? []).map((m) => [m.id as string, m.nickname as string]),
  );
  const retros = (rows as RetroRow[]).map(classify);
  const { kept, dropped, crossDropped } = dedupe(retros, nick);
  const built = buildCases(kept, crossDropped, nick);
  const { excluded, timeline } = built;
  const references = await buildReferences(kept, nick, built.cases, timeline);
  const cases = [...built.cases, ...references].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const subset = buildSubset(cases);
  const caseIds = cases.map((c) => c.id);
  const hashes = {
    caseIdsSha256: await sha256(caseIds.join("\n")),
    subsetIdsSha256: await sha256(subset.ids.join("\n")),
    casesSha256: await sha256(JSON.stringify(cases)),
  };
  return { retros, kept, dropped, excluded, timeline, cases, subset, hashes };
}

// 저장된 manifest와 지금 DB에서 다시 계산한 결과를 비교한다. 아무것도 쓰지 않는다
async function check(built: Awaited<ReturnType<typeof build>>) {
  let saved: {
    caseIds?: string[];
    caseIdsSha256: string;
    subsetIdsSha256: string;
    casesSha256: string;
  };
  try {
    saved = JSON.parse(await Deno.readTextFile(`${OUT_DIR}/manifest.json`));
  } catch {
    die(
      `${OUT_DIR}/manifest.json 이 없어요. 먼저 --check 없이 한 번 실행하세요.`,
    );
  }
  const ids = built.cases.map((c) => c.id);
  if (saved.caseIdsSha256 !== built.hashes.caseIdsSha256) {
    const before = new Set(saved.caseIds ?? []);
    const after = new Set(ids);
    console.error("\n✗ case id 목록이 달라졌어요.");
    for (const id of ids) if (!before.has(id)) console.error(`  + ${id}`);
    for (const id of before) if (!after.has(id)) console.error(`  - ${id}`);
    console.error("");
    Deno.exit(1);
  }
  if (saved.subsetIdsSha256 !== built.hashes.subsetIdsSha256)
    die(
      "case id는 같은데 개발용 서브셋이 달라졌어요. seed나 층 구성을 확인하세요.",
    );
  if (saved.casesSha256 !== built.hashes.casesSha256)
    console.warn(
      "\n! case id는 같지만 case 내용(본문·메일)이 바뀐 것이 있어요. 평가 결과를 비교할 때 유의하세요.\n",
    );
  console.log(
    `\n✓ 같은 평가셋입니다 (case ${ids.length}건, 서브셋 ${built.subset.ids.length}건)\n`,
  );
}

async function main() {
  const built = await build();
  if (Deno.args.includes("--check")) return await check(built);

  const { retros, kept, dropped, excluded, timeline, cases, subset, hashes } =
    built;
  const summary = buildSummary({
    retros,
    kept,
    dropped,
    excluded,
    cases,
    subset,
  });

  await Deno.mkdir(OUT_DIR, { recursive: true });
  await writeJson(`${OUT_DIR}/cases.json`, cases);
  await writeJson(`${OUT_DIR}/subset-dev.json`, subset);
  await writeJson(`${OUT_DIR}/build-log.json`, {
    rows: retros.length,
    afterDedupe: kept.length,
    timeline,
    dropped,
    excluded,
  });
  await writeJson(`${OUT_DIR}/manifest.json`, {
    generatedAt: new Date().toISOString(),
    gitCommit: await gitCommit(),
    counts: {
      cases: cases.length,
      subset: subset.ids.length,
    },
    ...hashes,
    // --check가 바뀐 id를 보여줄 수 있게 남긴다
    caseIds: cases.map((c) => c.id),
  });
  await Deno.writeTextFile(`${OUT_DIR}/summary.md`, summary + "\n");

  console.log(`\n✓ 평가셋 생성 → ${OUT_DIR}/\n`);
  console.log(summary);
  for (const r of cases.filter((c) => c.ruleDeviation))
    console.log(`⚠ ${r.id} (${r.memberName}): ${r.ruleDeviation}`);
  console.log("");
}

if (import.meta.main) await main();
