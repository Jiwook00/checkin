// 갈피 개별 리마인더용 멤버별 데이터 export (읽기 전용)
//
//   node scripts/export-reminder-data.mjs <session>
//   예) node scripts/export-reminder-data.mjs 2026-08
//
// - <session>은 **회고 세션**이다. 모임 날짜(투표 세션)와 한 달 어긋나므로 주의.
//   (회고 세션 2026-07의 글들은 2026-08에 작성되고, 그 모임은 투표 세션 2026-08이다.)
// - service_role 키로 RLS를 우회해 서버사이드에서 읽는다.
// - 아무것도 쓰지 않는다. SELECT만.
// - 아직 아무도 안 쓴 세션이 정상 입력이다. 글이 0건이어도 죽지 않는다.
// - 결과: letters/<session>/reminder-data.json + 콘솔 요약
//
// 필요한 .env 키: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE = "https://monthly-checkin.vercel.app";
const EXCERPT_LIMIT = 4000;

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function loadEnv() {
  const env = {};
  let raw = "";
  try {
    raw = readFileSync(resolve(ROOT, ".env"), "utf8");
  } catch {
    die(".env 파일을 찾을 수 없어요. 프로젝트 루트에 있어야 해요.");
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// "2026-08" → "2026-09"
function nextMonth(session) {
  const [y, m] = session.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const session = process.argv[2];
if (!session || !/^\d{4}-\d{2}$/.test(session)) {
  die(
    "회고 세션을 인자로 주세요. 예) node scripts/export-reminder-data.mjs 2026-08",
  );
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die(".env에 VITE_SUPABASE_URL이 없어요.");
if (!key)
  die("SUPABASE_SERVICE_ROLE_KEY가 .env에 없어요 (VITE_ 프리픽스 없이).");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1) 전체 멤버 로스터
const { data: members, error: mErr } = await supabase
  .from("checkin_members")
  .select("id, nickname, email");
if (mErr) die(`멤버 조회 실패: ${mErr.message}`);

// 2) 전체 회고 이력 (세션 타임라인 + missedStreak 계산에 필요)
const { data: allRetros, error: rErr } = await supabase
  .from("checkin_retrospectives")
  .select("id, title, session, member_id, content_markdown, created_at")
  .order("created_at", { ascending: true });
if (rErr) die(`회고 조회 실패: ${rErr.message}`);

const retroIds = allRetros.map((r) => r.id);

// 3) 댓글 · 반응 (작성자 닉네임 포함)
const { data: allComments, error: cErr } = await supabase
  .from("checkin_comments")
  .select(
    "id, retrospective_id, member_id, body, created_at, checkin_members!member_id(nickname)",
  )
  .in("retrospective_id", retroIds)
  .order("created_at", { ascending: true });
if (cErr) die(`댓글 조회 실패: ${cErr.message}`);

const { data: allReactions, error: xErr } = await supabase
  .from("checkin_reactions")
  .select(
    "id, target_type, target_id, member_id, emoji, created_at, checkin_members!member_id(nickname)",
  )
  .order("created_at", { ascending: true });
if (xErr) die(`반응 조회 실패: ${xErr.message}`);

// 4) 모임 정보 — 회고 세션의 **다음 달**이 투표 세션이다.
const pollSession = nextMonth(session);
const { data: polls, error: pErr } = await supabase
  .from("checkin_vote_polls")
  .select(
    "session, status, confirmed_date, confirmed_time, type, location, meeting_url",
  )
  .eq("session", pollSession)
  .limit(1);
if (pErr) die(`투표 조회 실패: ${pErr.message}`);
const poll = polls?.[0] ?? null;

// 5) 이번 달 공통 질문 — checkin_session_questions의 approved 질문 (회고 세션 기준)
//    승인된 질문이 없으면 비워두고 경고한다. 질문은 관리자 화면(/admin/reminders ①)에서 승인한다
const { data: questionRows, error: qErr } = await supabase
  .from("checkin_session_questions")
  .select("question")
  .eq("session", session)
  .eq("status", "approved")
  .limit(1);
if (qErr) die(`공통 질문 조회 실패: ${qErr.message}`);
const commonQuestion = questionRows?.[0]?.question ?? null;
if (!commonQuestion) {
  console.warn(
    `! ${session}에 승인된 공통 질문이 없어요 — 관리자 화면(/admin/reminders ①)에서 먼저 승인하세요.`,
  );
}

// --- 세션 타임라인 (최신 → 과거). 대상 세션은 글이 0건이어도 포함시킨다. ----
const sessionTimeline = [
  ...new Set([session, ...allRetros.map((r) => r.session)]),
].sort((a, b) => b.localeCompare(a));

// --- 멤버별 조립 ---------------------------------------------------------
const dupWarnings = [];

/**
 * 한 멤버가 같은 세션에 글을 여러 개 올린 경우 대표글 하나를 고른다.
 * 반응·댓글이 붙은 쪽 = 사람들이 실제로 읽은 쪽이므로 그걸 대표로 삼는다.
 * 동점이면 나중에 쓴 글(다시 올린 완성본일 가능성)을 쓴다.
 */
function pickPrimary(retros) {
  if (retros.length === 1) return retros[0];
  const score = (r) =>
    allComments.filter((c) => c.retrospective_id === r.id).length +
    allReactions.filter(
      (x) => x.target_type === "retrospective" && x.target_id === r.id,
    ).length;
  const sorted = [...retros].sort(
    (a, b) =>
      score(b) - score(a) || a.created_at.localeCompare(b.created_at) * -1,
  );
  dupWarnings.push(
    `${retros[0].session} · ${retros.length}개 중복 → ${sorted[0].id} 채택 ` +
      `(반응+댓글 ${score(sorted[0])}건, 나머지 ${sorted
        .slice(1)
        .map((r) => `${r.id.slice(0, 8)}:${score(r)}건`)
        .join(", ")})`,
  );
  return sorted[0];
}

const outMembers = members.map((m) => {
  const mine = allRetros.filter((r) => r.member_id === m.id);
  const bySession = new Map();
  for (const s of new Set(mine.map((r) => r.session))) {
    bySession.set(s, pickPrimary(mine.filter((r) => r.session === s)));
  }

  const thisOne = bySession.get(session) ?? null;
  const wroteThisSession = Boolean(thisOne);

  // 대상 세션 이전으로 거슬러 올라가며 연속 미작성 수
  const past = sessionTimeline.filter((s) => s < session);
  let missedStreak = 0;
  for (const s of past) {
    if (bySession.has(s)) break;
    missedStreak += 1;
  }

  const lastWrittenSession = past.find((s) => bySession.has(s)) ?? null;
  const lastArticle = lastWrittenSession
    ? bySession.get(lastWrittenSession)
    : null;

  // 마지막 글에 달린 반응·댓글 (본인이 남긴 건 제외)
  const newReactions = [];
  if (lastArticle) {
    for (const c of allComments) {
      if (c.retrospective_id !== lastArticle.id) continue;
      if (c.member_id === m.id) continue;
      newReactions.push({
        kind: "comment",
        from: c.checkin_members?.nickname ?? "익명",
        body: c.body,
        articleUrl: `${SITE}/articles/${lastArticle.id}`,
        commentId: c.id,
        createdAt: c.created_at,
      });
    }
    // 내가 남긴 댓글 → 그 댓글이 달려 있는 글(남의 글일 수 있다)
    const myComments = new Map(
      allComments
        .filter((c) => c.member_id === m.id)
        .map((c) => [c.id, c.retrospective_id]),
    );
    for (const x of allReactions) {
      const onArticle =
        x.target_type === "retrospective" && x.target_id === lastArticle.id;
      const onMyComment =
        x.target_type === "comment" && myComments.has(x.target_id);
      if (!onArticle && !onMyComment) continue;
      if (x.member_id === m.id) continue;
      // 댓글에 달린 반응은 **그 댓글이 있는 글**로 링크해야 한다.
      // 내 옛 글로 보내면 엉뚱한 데로 떨어진다.
      const hostRetroId = onMyComment
        ? myComments.get(x.target_id)
        : lastArticle.id;
      newReactions.push({
        kind: "emoji",
        emoji: x.emoji,
        from: x.checkin_members?.nickname ?? "익명",
        targetType: x.target_type,
        articleUrl: `${SITE}/articles/${hostRetroId}`,
        commentId: onMyComment ? x.target_id : null,
        createdAt: x.created_at,
      });
    }
    newReactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const recent = sessionTimeline
    .slice(0, 6)
    .map((s) => `${s}:${bySession.has(s) ? "o" : "x"}`);

  let state;
  if (wroteThisSession) state = "A";
  else if (bySession.size === 0) state = "D";
  else if (missedStreak >= 2) state = "C";
  else state = "B";

  return {
    memberId: m.id,
    name: m.nickname,
    email: m.email,
    state,
    wroteThisSession,
    articleUrl: thisOne ? `${SITE}/articles/${thisOne.id}` : null,
    lastWrittenSession,
    missedStreak,
    recentSessions: recent,
    newReactions,
    lastArticleTitle: lastArticle?.title ?? null,
    lastArticleUrl: lastArticle ? `${SITE}/articles/${lastArticle.id}` : null,
    lastArticleExcerpt: lastArticle
      ? (lastArticle.content_markdown ?? "").slice(0, EXCERPT_LIMIT)
      : null,
  };
});

const out = {
  session,
  pollSession,
  generatedAt: new Date().toISOString(),
  site: SITE,
  meetingDate: poll?.confirmed_date ?? null,
  meetingTime: poll?.confirmed_time ?? null,
  meetingType: poll?.type ?? null,
  meetingPlace: poll?.location ?? null,
  meetingUrl: poll?.meeting_url ?? null,
  voteClosed: poll ? poll.status !== "open" : false,
  voteUrl: `${SITE}/vote`,
  commonQuestion,
  writtenCount: outMembers.filter((m) => m.wroteThisSession).length,
  totalMembers: outMembers.length,
  members: outMembers,
};

const outDir = resolve(ROOT, "letters", session);
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "reminder-data.json");
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

// --- 콘솔 요약 ----------------------------------------------------------
console.log(`\n✓ ${session} 리마인더 데이터 export 완료 → ${outPath}\n`);
console.log(
  `  모임(투표 세션 ${pollSession}): ${out.meetingDate ?? "미확정"} ${
    out.meetingTime ?? ""
  } ${out.meetingType ?? ""} · 투표 ${out.voteClosed ? "마감" : "진행 중"}`,
);
console.log(`  공통 질문: ${out.commonQuestion ?? "(승인된 질문 없음)"}`);
console.log(`  작성: ${out.writtenCount}/${out.totalMembers}명\n`);
for (const m of out.members) {
  console.log(
    `    [${m.state}] ${m.name.padEnd(5)} 미작성연속 ${m.missedStreak} · ` +
      `마지막 ${m.lastWrittenSession ?? "없음"} · 반응 ${m.newReactions.length}건`,
  );
}
if (dupWarnings.length) {
  console.log(`\n  ⚠ 같은 세션 중복 글 처리:`);
  for (const w of dupWarnings) console.log(`    · ${w}`);
}
console.log("");
