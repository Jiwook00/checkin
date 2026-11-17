// 디스코드 봇 HTTP Interactions 진입점 (이슈 #101). 호출하는 쪽은 Discord다. Gateway(상시 접속)는 쓰지 않는다
//
// verify_jwt=false 라서 Ed25519 서명이 유일한 관문이다. 서명이 없거나 틀리거나 시각이 ±5분 밖이면 401.
// 서명은 받은 바이트 그대로 검증하고, 통과한 뒤에만 JSON으로 읽는다.
// 공개키(DISCORD_PUBLIC_KEY)가 없거나 형식이 틀리면 모든 요청을 거절한다.
// body와 헤더는 로그·응답에 남기지 않는다.
// PING(type 1)은 바로 답하고, 슬래시 커맨드(type 2)는 data.name 으로 commands/ 의 핸들러에 넘긴다 (#133 /기여).
// 모르는 커맨드는 ephemeral 안내로 답한다. 커맨드를 늘리면 등록 스크립트(scripts/discord-register-commands.ts)를 다시 돌린다

import { createClient } from "@supabase/supabase-js";
import { fail, json } from "../_shared/http.ts";
import { COMMANDS } from "./commands/index.ts";
import {
  ephemeral,
  INTERACTION_APPLICATION_COMMAND,
  INTERACTION_PING,
  type Interaction,
} from "./interaction.ts";
import { importPublicKey, verifyDiscordRequest } from "./verify.ts";

const RESPONSE_PONG = 1;

// isolate 안에서 한 번만 import한다
const publicKey = importPublicKey(Deno.env.get("DISCORD_PUBLIC_KEY") ?? "");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "POST만 받습니다");
  }

  const key = await publicKey;
  if (!key) return fail(500, "MISCONFIGURED", "서버 설정이 필요합니다");

  const rawBody = new Uint8Array(await req.arrayBuffer());
  const verified = await verifyDiscordRequest(
    key,
    req.headers.get("x-signature-ed25519"),
    req.headers.get("x-signature-timestamp"),
    rawBody,
    Math.floor(Date.now() / 1000),
  );
  if (!verified)
    return fail(401, "UNAUTHENTICATED", "서명이 올바르지 않습니다");

  let interaction: Interaction;
  try {
    interaction = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return fail(400, "INVALID_BODY", "JSON 본문이 필요합니다");
  }

  if (interaction?.type === INTERACTION_PING) {
    return json(200, { type: RESPONSE_PONG });
  }
  if (interaction?.type === INTERACTION_APPLICATION_COMMAND) {
    const name = interaction.data?.name;
    if (typeof name !== "string" || !Object.hasOwn(COMMANDS, name)) {
      return ephemeral("모르는 커맨드예요.");
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return COMMANDS[name](interaction, { admin });
  }
  return fail(400, "UNKNOWN_INTERACTION", "지원하지 않는 interaction");
});
