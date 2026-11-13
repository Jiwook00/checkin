// DB 이벤트를 디스코드 채널로 보낸다 (이슈 #98). 호출하는 쪽은 DB(pg_net)다. 브라우저는 부르지 않는다
//
// 요청 `POST { type, ... }` + 헤더 `x-notify-secret`. 어느 채널에 어떤 형식으로 보낼지는 type 이 정하고 여기서 만든다.
// type 은 "test"(연결 확인), "retro_uploaded"(#99, ref_id = 회고 id), 투표 공지 3종(#100, ref_id = poll id, vote.ts)이 있다.
// 제목·작성자 같은 내용은 DB가 보내지 않고 여기서 service role 로 조회한다.
// 같은 (type, ref_id)는 한 번만 보낸다. 보내기 전에 pending 행으로 자리를 잡아서 동시 요청이 둘 다 보내지 못하게 한다.
// verify_jwt=false 라서 비밀 헤더가 유일한 관문이다. 비밀이 설정돼 있지 않으면 모든 요청을 거절한다

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type DiscordChannel,
  EMBED_COLOR,
  sendWebhook,
  type WebhookPayload,
} from "../_shared/discord/webhook.ts";
import { fail, json } from "../_shared/http.ts";
import {
  countRemaining,
  POLL_COLUMNS,
  type PollRow,
  VOTE_EVENT_TYPES,
  type VoteEventType,
  voteConfirmedPayload,
  voteDeadlineSoonPayload,
  voteOpenedPayload,
} from "./vote.ts";

interface DiscordEvent {
  type: string;
  channel: DiscordChannel;
  /** 중복 방지 기준. null 이면 매번 보낸다 (test) */
  refId: string | null;
  payload: WebhookPayload;
}

const CHANNELS: DiscordChannel[] = ["announce", "retro"];

// generate-reminders/input.ts 의 SITE 와 같은 값. 리마인더 코어는 평가 캐시 때문에 건드리지 않아서 따로 둔다
const SITE_URL = "https://monthly-checkin.vercel.app";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 디스코드 embed title 상한
const TITLE_MAX = 256;

interface RetroRow {
  id: string;
  title: string;
  session: string;
  created_at: string;
  member_id: string;
}

interface MemberRow {
  nickname: string | null;
  avatar_url: string | null;
}

function retroUploadedPayload(
  retro: RetroRow,
  member: MemberRow | null,
): WebhookPayload {
  const match = /^(\d{4})-(\d{2})$/.exec(retro.session);
  const footer = match
    ? `${match[1]}년 ${Number(match[2])}월 회고`
    : retro.session;
  const title =
    retro.title.length > TITLE_MAX
      ? `${retro.title.slice(0, TITLE_MAX - 1)}…`
      : retro.title;
  const avatar = member?.avatar_url;

  return {
    embeds: [
      {
        author: {
          name: member?.nickname ?? "멤버",
          ...(avatar?.startsWith("https://") ? { icon_url: avatar } : {}),
        },
        title,
        url: `${SITE_URL}/articles/${retro.id}`,
        color: EMBED_COLOR,
        timestamp: retro.created_at,
        footer: { text: footer },
      },
    ],
  };
}

/** 투표 공지 세 종류. 상태가 시점과 맞지 않으면(삭제됨, 이미 확정됨, 남은 사람 없음) 기록 없이 건너뛴다 */
async function buildVoteEvent(
  type: VoteEventType,
  refId: unknown,
  admin: SupabaseClient,
): Promise<DiscordEvent | Response> {
  if (typeof refId !== "string" || !UUID_PATTERN.test(refId)) {
    return fail(400, "INVALID_REF", "ref_id는 투표 id(UUID)");
  }
  const { data: poll, error } = await admin
    .from("checkin_vote_polls")
    .select(POLL_COLUMNS)
    .eq("id", refId)
    .maybeSingle<PollRow>();
  if (error) return fail(500, "DB_ERROR", "투표를 조회하지 못했습니다");
  if (!poll) return fail(404, "NOT_FOUND", "투표를 찾을 수 없습니다");

  const skip = (reason: string) => json(200, { ok: true, skipped: reason });
  const base = { type, channel: "announce" as const, refId: poll.id };

  switch (type) {
    case "vote_opened":
      if (poll.status !== "open") return skip("not_open");
      return { ...base, payload: voteOpenedPayload(poll, SITE_URL) };
    case "vote_deadline_soon": {
      const deadline = poll.vote_deadline;
      if (poll.status !== "open" || !deadline) return skip("not_open");
      const remaining = await countRemaining(admin, poll.id);
      if (remaining === null) {
        return fail(500, "DB_ERROR", "응답 현황을 조회하지 못했습니다");
      }
      if (remaining === 0) return skip("no_remaining");
      return {
        ...base,
        payload: voteDeadlineSoonPayload(
          { ...poll, vote_deadline: deadline },
          remaining,
          SITE_URL,
        ),
      };
    }
    case "vote_confirmed": {
      const date = poll.confirmed_date;
      if (poll.status !== "confirmed" || !date) return skip("not_confirmed");
      return {
        ...base,
        payload: voteConfirmedPayload(
          { ...poll, confirmed_date: date },
          SITE_URL,
        ),
      };
    }
  }
}

async function buildEvent(
  body: Record<string, unknown>,
  admin: SupabaseClient,
): Promise<DiscordEvent | Response> {
  if (VOTE_EVENT_TYPES.includes(body.type as VoteEventType)) {
    return buildVoteEvent(body.type as VoteEventType, body.ref_id, admin);
  }
  switch (body.type) {
    case "retro_uploaded": {
      const refId = body.ref_id;
      if (typeof refId !== "string" || !UUID_PATTERN.test(refId)) {
        return fail(400, "INVALID_REF", "ref_id는 회고 id(UUID)");
      }
      const { data: retro, error: retroError } = await admin
        .from("checkin_retrospectives")
        .select("id, title, session, created_at, member_id")
        .eq("id", refId)
        .maybeSingle<RetroRow>();
      if (retroError)
        return fail(500, "DB_ERROR", "회고를 조회하지 못했습니다");
      if (!retro) return fail(404, "NOT_FOUND", "회고를 찾을 수 없습니다");

      const { data: member, error: memberError } = await admin
        .from("checkin_members")
        .select("nickname, avatar_url")
        .eq("id", retro.member_id)
        .maybeSingle<MemberRow>();
      if (memberError)
        return fail(500, "DB_ERROR", "작성자를 조회하지 못했습니다");

      return {
        type: "retro_uploaded",
        channel: "retro",
        refId: retro.id,
        payload: retroUploadedPayload(retro, member),
      };
    }
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
    [expected, given].map(
      async (value) =>
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", encoder.encode(value)),
        ),
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const event = await buildEvent(body, admin);
  if (event instanceof Response) return event;

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
