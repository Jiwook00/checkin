// fetch 정책(타임아웃·재시도·인코딩) 검증 (Deno 2.x)
//
//   deno run -A --no-lock --config supabase/functions/parse-content/deno.json \
//     scripts/fetch-policy-check.ts
//
// 로컬 Deno.serve 서버에 시나리오별 경로를 두고 runPipeline을 직접 호출한다.
// (index.ts를 거치지 않으므로 SSRF 검증에 막히지 않는다.) 하나라도 실패하면 exit 1.

import { runPipeline } from "../supabase/functions/parse-content/pipeline.ts";
import { fetchPolicy } from "../supabase/functions/parse-content/fetch-policy.ts";

// 확인이 빨리 끝나도록 대기 시간을 줄인다. 정책 로직 자체는 그대로다
fetchPolicy.timeoutMs = 300;
fetchPolicy.backoffBaseMs = 10;

const KOREAN = "안녕하세요 회고 글입니다. ";
// "안녕하세요 " 를 EUC-KR로 인코딩한 바이트 (아래에서 디코딩 결과로 다시 검증한다)
const EUCKR_HELLO = [
  0xbe, 0xc8, 0xb3, 0xe7, 0xc7, 0xcf, 0xbc, 0xbc, 0xbf, 0xe4,
];
const REPEAT = 30; // article 본문이 100자를 넘도록

function eucKrBody(withMeta: boolean): Uint8Array {
  const enc = new TextEncoder();
  const head = withMeta
    ? '<html><head><meta charset="euc-kr"><title>t</title></head><body><article>'
    : "<html><head><title>t</title></head><body><article>";
  const parts: Uint8Array[] = [enc.encode(head)];
  for (let i = 0; i < REPEAT; i++) {
    parts.push(new Uint8Array(EUCKR_HELLO), enc.encode(" "));
  }
  parts.push(enc.encode("</article></body></html>"));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const utf8Page = `<html><head><title>정상</title></head><body><article>${KOREAN.repeat(REPEAT)}</article></body></html>`;

let flakyCount = 0;
const controller = new AbortController();
const server = Deno.serve(
  { port: 0, signal: controller.signal, onListen: () => {} },
  async (req) => {
    const path = new URL(req.url).pathname;
    const html = { "content-type": "text/html; charset=utf-8" };
    switch (path) {
      case "/flaky":
        flakyCount++;
        return flakyCount <= 2
          ? new Response("unavailable", { status: 503 })
          : new Response(utf8Page, { headers: html });
      case "/gone":
        return new Response("not found", { status: 404 });
      case "/forbidden":
        return new Response("forbidden", { status: 403 });
      case "/slow":
        await new Promise((r) => setTimeout(r, 2000));
        return new Response(utf8Page, { headers: html });
      case "/retry-after":
        return new Response("busy", {
          status: 503,
          headers: { "retry-after": "30" },
        });
      case "/euckr-header":
        return new Response(eucKrBody(false), {
          headers: { "content-type": "text/html; charset=EUC-KR" },
        });
      case "/euckr-meta":
        return new Response(eucKrBody(true), {
          headers: { "content-type": "text/html" },
        });
      default:
        return new Response("?", { status: 500 });
    }
  },
);
const base = `http://localhost:${server.addr.port}`;

let failed = 0;
function check(name: string, ok: boolean, detail: string) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

// 인코딩 픽스처가 맞는지 먼저 확인 (바이트를 잘못 적었으면 이후 결과를 믿을 수 없다)
const fixture = new TextDecoder("euc-kr").decode(new Uint8Array(EUCKR_HELLO));
check("fixture", fixture === "안녕하세요", `디코딩 결과 "${fixture}"`);

{
  const r = await runPipeline(`${base}/flaky`, { fetch });
  check(
    "503 두 번 뒤 200",
    r.ok && r.fetch_attempts === 3,
    `ok=${r.ok} fetch_attempts=${r.fetch_attempts}`,
  );
}
{
  const r = await runPipeline(`${base}/gone`, { fetch });
  const e = !r.ok ? r.error : null;
  check(
    "404는 재시도 없이 user_action",
    e?.code === "HTTP_404" &&
      e.kind === "user_action" &&
      r.fetch_attempts === 1,
    `code=${e?.code} kind=${e?.kind} fetch_attempts=${r.fetch_attempts}`,
  );
}
{
  const r = await runPipeline(`${base}/forbidden`, { fetch });
  const e = !r.ok ? r.error : null;
  check(
    "403은 재시도 없이 unsupported",
    e?.code === "HTTP_403" &&
      e.kind === "unsupported" &&
      r.fetch_attempts === 1,
    `code=${e?.code} kind=${e?.kind} fetch_attempts=${r.fetch_attempts}`,
  );
}
{
  const r = await runPipeline(`${base}/slow`, { fetch });
  const e = !r.ok ? r.error : null;
  check(
    "응답 지연은 TIMEOUT, 최대 횟수까지 재시도",
    e?.code === "TIMEOUT" && r.fetch_attempts === 1 + fetchPolicy.maxRetries,
    `code=${e?.code} fetch_attempts=${r.fetch_attempts}`,
  );
}
{
  const r = await runPipeline(`${base}/retry-after`, { fetch });
  const e = !r.ok ? r.error : null;
  check(
    "Retry-After 30초는 기다리지 않고 중단",
    e?.code === "HTTP_5XX" && r.fetch_attempts === 1 && r.duration_ms < 1000,
    `code=${e?.code} fetch_attempts=${r.fetch_attempts} duration_ms=${r.duration_ms}`,
  );
}
for (const [name, path] of [
  ["EUC-KR (Content-Type 헤더)", "/euckr-header"],
  ["EUC-KR (meta charset)", "/euckr-meta"],
] as const) {
  const r = await runPipeline(`${base}${path}`, { fetch });
  check(
    name,
    r.ok && r.content_markdown.includes("안녕하세요"),
    r.ok ? `본문 앞부분 "${r.content_markdown.slice(0, 12)}"` : r.error.detail,
  );
}

controller.abort();
await server.finished;
console.log(failed === 0 ? "\n전체 통과" : `\n${failed}건 실패`);
Deno.exit(failed === 0 ? 0 : 1);
