// DB 이벤트를 디스코드 채널로 보낸다 (이슈 #98). 호출하는 쪽은 DB(pg_net)다. 브라우저는 부르지 않는다
//
// 요청 `POST { type, ... }` + 헤더 `x-notify-secret`. 어느 채널에 어떤 형식으로 보낼지는 type 이 정하고 여기서 만든다.
// 지금은 type "test" 만 있다. 회고 업로드(#99)·투표 공지(#100)가 타입을 하나씩 더한다.
// 같은 (type, ref_id)는 한 번만 보낸다. 보내기 전에 pending 행으로 자리를 잡아서 동시 요청이 둘 다 보내지 못하게 한다.
// verify_jwt=false 라서 비밀 헤더가 유일한 관문이다. 비밀이 설정돼 있지 않으면 모든 요청을 거절한다

import { createClient } from "@supabase/supabase-js";
import {
  type DiscordChannel,
  EMBED_COLOR,
  sendWebhook,
  type WebhookPayload,
} from "../_shared/discord/webhook.ts";
import { fail, json } from "../_shared/http.ts";

interface DiscordEvent {
  type: string;
  channel: DiscordChannel;
  /** 중복 방지 기준. null 이면 매번 보낸다 (test) */
  refId: string | null;
  payload: WebhookPayload;
}

const CHANNELS: DiscordChannel[] = ["announce", "retro"];

function buildEvent(body: Record<string, unknown>): DiscordEvent | Response {
  switch (body.type) {
    case "test": {
      const channel = body.channel as DiscordChannel;
      if (!CHANNELS.includes(channel)) {
        return fail(400, "INVALID_CHANNEL", "channel은 announce 또는 retro");
      }
      return {
        type: "test",
        channel,
        refId: null,
        payload: {
          embeds: [
            {
              title: "갈피 연결 테스트",
              description: "이 메시지가 보이면 웹앱과 디스코드가 이어졌어요.",
              color: EMBED_COLOR,
            },
          ],
        },
      };
    }
    default:
      return fail(400, "UNKNOWN_EVENT", "알 수 없는 type");
  }
}

// 두 값을 SHA-256으로 같은 길이로 만든 뒤 XOR로 비교해서 길이·내용이 시간으로 새지 않게 한다
async function hasValidSecret(req: Request): Promise<boolean> {
  const expected = Deno.env.get("DISCORD_NOTIFY_SECRET");
  const given = req.headers.get("x-notify-secret");
  if (!expected || !given) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [expected, given].map(async (value) =>
      new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))),
    ),
  );
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "POST만 받습니다");
  }
  if (!(await hasValidSecret(req))) {
    return fail(401, "UNAUTHENTICATED", "인증이 필요합니다");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "INVALID_BODY", "JSON 본문이 필요합니다");
  }

  const event = buildEvent(body);
  if (event instanceof Response) return event;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: row, error: insertError } = await admin
    .from("checkin_discord_deliveries")
    .insert({
      event_type: event.type,
      ref_id: event.refId,
      channel: event.channel,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) {
    // unique (event_type, ref_id) 위반 = 이미 보냈거나 보내는 중
    if (insertError.code === "23505") {
      return json(200, { ok: true, skipped: "duplicate" });
    }
    return fail(500, "DB_ERROR", "발송 기록을 남기지 못했습니다");
  }

  const result = await sendWebhook(event.channel, event.payload);

  await admin
    .from("checkin_discord_deliveries")
    .update({
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
      discord_message_id: result.ok ? result.messageId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (!result.ok) return fail(502, "DISCORD_FAILED", result.error);
  return json(200, { ok: true, message_id: result.messageId });
});
