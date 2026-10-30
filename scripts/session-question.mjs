// 회차별 공통 질문 관리 (checkin_session_questions)
//
//   node scripts/session-question.mjs list
//   node scripts/session-question.mjs propose <session> "<질문>"
//   node scripts/session-question.mjs approve <session>
//   예) node scripts/session-question.mjs propose 2026-10 "요즘 반복 재생 중인 노래는?"
//
// - <session>은 **회고 세션**이다 (checkin_retrospectives.session). 투표 세션이 아니다.
// - 회차당 질문은 하나다. propose는 proposed 질문만 덮어쓰고, 이미 approved인 회차는 거부한다.
// - 후보는 이 스크립트가 만들지 않는다. 스킬 대화에서 대니가 고른 한 문장을 propose로 넣고 approve로 승인한다.
// - service_role 키로 RLS를 우회해 쓴다. 앱(멤버)은 approved만 읽는다.
//
// 필요한 .env 키: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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

const [cmd, session, ...rest] = process.argv.slice(2);
const usage =
  '사용법: list | propose <session> "<질문>" | approve <session>  (session 예: 2026-10)';

if (!["list", "propose", "approve"].includes(cmd ?? "")) die(usage);
if (cmd !== "list" && !/^\d{4}-\d{2}$/.test(session ?? "")) {
  die(`회고 세션을 YYYY-MM 형식으로 주세요.\n${usage}`);
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die("VITE_SUPABASE_URL이 .env에 없어요.");
if (!key)
  die("SUPABASE_SERVICE_ROLE_KEY가 .env에 없어요 (VITE_ 프리픽스 없이).");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll() {
  const { data, error } = await supabase
    .from("checkin_session_questions")
    .select("session, question, status, created_at, approved_at")
    .order("session", { ascending: false });
  if (error) die(`조회 실패: ${error.message}`);
  return data ?? [];
}

// 공백·물음표 차이는 같은 질문으로 본다
const norm = (s) => s.replace(/[\s?？]/g, "");

if (cmd === "list") {
  const rows = await fetchAll();
  if (rows.length === 0) console.log("(질문 없음)");
  for (const r of rows) {
    const mark = r.status === "approved" ? "✓" : "…";
    console.log(`${mark} ${r.session}  [${r.status}]  ${r.question}`);
  }
  process.exit(0);
}

if (cmd === "propose") {
  const question = rest.join(" ").trim();
  if (!question) die(`질문 문장을 주세요.\n${usage}`);

  const rows = await fetchAll();
  const current = rows.find((r) => r.session === session);
  if (current?.status === "approved") {
    die(
      `${session}은 이미 승인된 질문이 있어요: "${current.question}"\n바꾸려면 DB에서 직접 고쳐 주세요.`,
    );
  }
  const dup = rows.find(
    (r) => r.session !== session && norm(r.question) === norm(question),
  );
  if (dup) {
    console.warn(`! ${dup.session}에서 이미 쓴 질문이에요 (${dup.status}).`);
  }

  const { error } = await supabase
    .from("checkin_session_questions")
    .upsert(
      { session, question, status: "proposed", approved_at: null },
      { onConflict: "session" },
    );
  if (error) die(`저장 실패: ${error.message}`);
  console.log(
    `… ${session}  [proposed]  ${question}${current ? "  (기존 후보를 덮어씀)" : ""}`,
  );
  console.log(
    `승인하려면: node scripts/session-question.mjs approve ${session}`,
  );
  process.exit(0);
}

// approve
const { data, error } = await supabase
  .from("checkin_session_questions")
  .update({ status: "approved", approved_at: new Date().toISOString() })
  .eq("session", session)
  .eq("status", "proposed")
  .select("session, question");
if (error) die(`승인 실패: ${error.message}`);
if (!data || data.length === 0) {
  die(
    `${session}에 승인할 후보(proposed)가 없어요. 이미 승인됐거나 propose가 먼저 필요해요.`,
  );
}
console.log(`✓ ${data[0].session}  [approved]  ${data[0].question}`);
console.log("앱 멤버에게 바로 노출돼요.");
