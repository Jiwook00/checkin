// 리마인더 평가셋 추출 (Deno 2.x, #73)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/eval-dataset.ts
//
// - DB에서 SELECT만 한다. 아무것도 쓰지 않는다 (.env의 VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요)
// - 결과: local/eval/dataset/cases.json (case 목록, id 순 정렬, 시각 정보 없음 → 같은 DB면 같은 파일)
//         local/eval/dataset/build-log.json (중복 제거·제외 내역)
//   local/은 git 제외다. 회고 원문이 들어가므로 이 밖으로 내보내지 않는다
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

async function writeJson(path: string, data: unknown) {
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2) + "\n");
}

async function main() {
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

  await Deno.mkdir(OUT_DIR, { recursive: true });
  await writeJson(`${OUT_DIR}/cases.json`, cases);
  await writeJson(`${OUT_DIR}/build-log.json`, {
    rows: retros.length,
    afterDedupe: kept.length,
    timeline,
    dropped,
    excluded,
  });

  const count = (f: (c: EvalCase) => boolean) => cases.filter(f).length;
  console.log(`\n✓ 평가셋 생성 → ${OUT_DIR}/cases.json\n`);
  console.log(
    `  회고 ${retros.length}행 → 중복 제거 후 ${kept.length}건 (제거 ${dropped.length}), 회차 ${timeline.length}개`,
  );
  console.log(`  case ${cases.length}건`);
  console.log(`    callback   ${count((c) => c.type === "callback")}`);
  console.log(
    `    no_source  ${count((c) => c.type === "no_source")} (parse_failed ${count((c) => c.reason === "parse_failed")}, not_participated ${count((c) => c.reason === "not_participated")})`,
  );
  console.log(`    reference  ${count((c) => c.type === "reference")}`);
  console.log(`    제외       ${excluded.length}`);
  for (const r of references)
    console.log(
      `  · reference ${r.memberName}: 기대 콜백 ${r.expectCallback ? "있음" : "없음"}, 메일 콜백 ${r.reference?.sections.callback ? "있음" : "없음"}${r.ruleDeviation ? ` ⚠ ${r.ruleDeviation}` : ""}`,
    );
  for (const d of dropped)
    console.log(
      `  · 중복 제거 ${d.memberName} ${d.session} (${d.reason}) → ${d.keptSession} 유지`,
    );
  for (const e of excluded)
    console.log(
      `  · 제외 ${e.memberName} ${e.session} ← ${e.prevSession}: ${e.reason}`,
    );
  console.log("");
}

if (import.meta.main) await main();
