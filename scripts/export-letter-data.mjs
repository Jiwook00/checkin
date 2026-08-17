// 갈피 레터용 월별 데이터 export (읽기 전용)
//
//   node scripts/export-letter-data.mjs <session>
//   예) node scripts/export-letter-data.mjs 2026-07
//
// - service_role 키로 RLS를 우회해 서버사이드에서 읽는다. (프론트 anon 키로는 authenticated 정책에 막힘)
// - 아무것도 쓰지 않는다. SELECT만.
// - 결과: letters/<session>/data.json + 콘솔 요약
//
// 필요한 .env 키: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (둘 다 .gitignore된 .env)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE = "https://monthly-checkin.vercel.app";

// --- .env 수동 파싱 (dotenv 의존성 없이) ---------------------------------
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

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// --- main ---------------------------------------------------------------
const session = process.argv[2];
if (!session) {
  die(
    "세션(달)을 인자로 주세요. 예) node scripts/export-letter-data.mjs 2026-07",
  );
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die(".env에 VITE_SUPABASE_URL이 없어요.");
if (!key) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY가 .env에 없어요.\n" +
      "  Supabase 대시보드 → Settings → API → service_role 키를 복사해\n" +
      "  .env에 SUPABASE_SERVICE_ROLE_KEY=... 로 추가하세요 (VITE_ 프리픽스 없이).",
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1) 이 세션의 회고 글
const { data: retros, error: rErr } = await supabase
  .from("checkin_retrospectives")
  .select(
    "id, title, source_url, source_type, content_type, content_markdown, session, member_id, created_at, checkin_members!member_id(nickname)",
  )
  .eq("session", session)
  .order("created_at", { ascending: true });

if (rErr) die(`회고 조회 실패: ${rErr.message}`);

if (!retros || retros.length === 0) {
  // 세션 문자열이 안 맞는 경우가 흔하므로, 실제 존재하는 세션 목록을 보여준다.
  const { data: all } = await supabase
    .from("checkin_retrospectives")
    .select("session")
    .order("created_at", { ascending: false })
    .limit(200);
  const sessions = [...new Set((all ?? []).map((r) => r.session))];
  die(
    `세션 "${session}"에 회고가 없어요.\n  존재하는 세션들: ${
      sessions.length ? sessions.join(", ") : "(없음)"
    }`,
  );
}

const retroIds = retros.map((r) => r.id);

// 2) 이 회고들에 달린 댓글 (댓글 작성자 닉네임 포함)
const { data: comments, error: cErr } = await supabase
  .from("checkin_comments")
  .select(
    "id, retrospective_id, member_id, body, created_at, checkin_members!member_id(nickname)",
  )
  .in("retrospective_id", retroIds)
  .order("created_at", { ascending: true });

if (cErr) die(`댓글 조회 실패: ${cErr.message}`);

// 3) 전체 멤버 로스터 (누가 안 썼는지 파악 + 수신자 목록용)
const { data: members, error: mErr } = await supabase
  .from("checkin_members")
  .select("id, nickname, email");

if (mErr) die(`멤버 조회 실패: ${mErr.message}`);

// --- 정규화 -------------------------------------------------------------
const out = {
  session,
  generatedAt: new Date().toISOString(),
  site: SITE,
  retrospectives: retros.map((r) => ({
    id: r.id,
    title: r.title,
    nickname: r.checkin_members?.nickname ?? "익명",
    memberId: r.member_id,
    contentType: r.content_type,
    sourceUrl: r.source_url,
    createdAt: r.created_at,
    articleUrl: `${SITE}/articles/${r.id}`,
    contentMarkdown: r.content_markdown,
  })),
  comments: (comments ?? []).map((c) => ({
    id: c.id,
    retrospectiveId: c.retrospective_id,
    nickname: c.checkin_members?.nickname ?? "익명",
    body: c.body,
    createdAt: c.created_at,
  })),
  members: (members ?? []).map((m) => ({
    id: m.id,
    nickname: m.nickname,
    email: m.email,
  })),
};

const outDir = resolve(ROOT, "letters", session);
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "data.json");
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

// --- 콘솔 요약 ----------------------------------------------------------
const wroteIds = new Set(out.retrospectives.map((r) => r.memberId));
const didNotWrite = out.members
  .filter((m) => !wroteIds.has(m.id))
  .map((m) => m.nickname);

console.log(`\n✓ ${session} 데이터 export 완료 → ${outPath}\n`);
console.log(`  회고 글: ${out.retrospectives.length}개`);
for (const r of out.retrospectives)
  console.log(`    · ${r.nickname} — ${r.title}`);
console.log(`  댓글: ${out.comments.length}개`);
console.log(`  전체 멤버: ${out.members.length}명`);
if (didNotWrite.length)
  console.log(`  이번 달 미작성: ${didNotWrite.join(", ")}`);
console.log("");
