// 확정한 일정의 디스코드 서버 이벤트 (이슈 #103, ADR 0013). poll 하나에 이벤트 하나
//
// - poll_event_sync   : ref_id = poll id. 최신 poll 을 읽고 "있어야 할 상태"로 맞춘다
//                       confirmed 이고 시작이 미래 → 만들거나(POST) 고친다(PATCH). 그 밖 → 지운다(DELETE)
// - poll_event_delete : poll 행이 지워졌을 때. 트리거가 이벤트 id 를 같이 보낸다
//
// 결과는 poll 의 discord_event_* 에 남기고(관리자 화면이 읽는다) checkin_discord_deliveries 는 쓰지 않는다.
// deliveries 는 "같은 알림은 한 번만"이지만 동기화는 여러 번 돈다.
// 온라인은 음성 채널 이벤트, 오프라인은 외부 이벤트(장소)로 만든다. 회의 링크·비밀번호는 넣지 않는다 (vote.ts 와 같은 이유)

import type { SupabaseClient } from "@supabase/supabase-js";
import { requestDiscord } from "../_shared/discord/webhook.ts";
import { fail, json } from "../_shared/http.ts";

export const POLL_EVENT_TYPES = [
  "poll_event_sync",
  "poll_event_delete",
] as const;
export type PollEventType = (typeof POLL_EVENT_TYPES)[number];

const API = "https://discord.com/api/v10";

// 모임 길이. 외부 이벤트는 종료 시간이 필수라서 정해 둔다. time_end 는 투표 시간표의 끝이지 모임의 끝이 아니다
const MEETING_HOURS = 2;

// Discord 상한
const NAME_MAX = 100;
const DESCRIPTION_MAX = 1000;
const LOCATION_MAX = 100;

// "Unknown Guild Scheduled Event" — 디스코드에서 누가 지웠거나 이미 끝나 사라진 이벤트
const UNKNOWN_EVENT = 10070;
const MISSING_PERMISSIONS = 50013;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

interface EventPollRow {
  id: string;
  type: "online" | "offline";
  status: "open" | "closed" | "confirmed";
  month: number;
  session: string;
  location: string | null;
  confirmed_date: string | null;
  confirmed_time: string | null;
  time_weekday: string | null;
  time_start: string;
  discord_event_id: string | null;
}

const EVENT_POLL_COLUMNS =
  "id, type, status, month, session, location, confirmed_date, confirmed_time, time_weekday, time_start, discord_event_id";

type DiscordCall =
  | { ok: true; data: Record<string, unknown> | null }
  | { ok: false; error: string; unknownEvent: boolean };

interface Config {
  headers: Record<string, string>;
  eventsUrl: string;
  voiceChannelId: string | null;
}

/** 봇 토큰·서버 id 는 함수 시크릿에 둔다. 음성 채널 id 는 온라인 이벤트에서만 필요하다 */
function readConfig(): Config | { error: string } {
  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token) return { error: "missing_bot_token" };
  const guildId = Deno.env.get("DISCORD_GUILD_ID");
  if (!guildId || !SNOWFLAKE_PATTERN.test(guildId)) {
    return { error: "missing_guild_id" };
  }
  const channelId = Deno.env.get("DISCORD_EVENT_VOICE_CHANNEL_ID");
  return {
    headers: { Authorization: `Bot ${token}` },
    eventsUrl: `${API}/guilds/${guildId}/scheduled-events`,
    voiceChannelId:
      channelId && SNOWFLAKE_PATTERN.test(channelId) ? channelId : null,
  };
}

async function callDiscord(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<DiscordCall> {
  const result = await requestDiscord(
    method,
    url,
    headers,
    body === undefined ? undefined : JSON.stringify(body),
  );
  if ("error" in result) {
    return { ok: false, error: result.error, unknownEvent: false };
  }
  const { res } = result;
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return { ok: true, data };
  const code = data?.code;
  if (code === UNKNOWN_EVENT || res.status === 404) {
    return { ok: false, error: "unknown_event", unknownEvent: true };
  }
  if (code === MISSING_PERMISSIONS) {
    return { ok: false, error: "missing_permissions", unknownEvent: false };
  }
  return { ok: false, error: `http_${res.status}`, unknownEvent: false };
}

/** "9:00", "22:00" → KST 시작 시각. 시는 두 자리가 아닐 수 있다(주말 집계) */
function startTime(poll: EventPollRow): Date | null {
  const date = poll.confirmed_date;
  const time = poll.confirmed_time ?? poll.time_weekday ?? poll.time_start;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match) return null;
  // KST 는 서머타임이 없어서 +09:00 고정이다
  const start = new Date(
    `${date}T${match[1].padStart(2, "0")}:${match[2]}:00+09:00`,
  );
  return Number.isNaN(start.getTime()) ? null : start;
}

/** poll session 이 "2026-11" 이면 다루는 회고는 "2026-10" 이다 */
function retroSession(pollSession: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(pollSession);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, "0")}`;
}

/** 발표 순서는 App.tsx 의 회차 내 정렬과 같다: presentation_order 높은 순, 없으면 등록 순 */
async function presentationOrder(
  admin: SupabaseClient,
  session: string,
): Promise<string[] | null> {
  const { data: retros, error } = await admin
    .from("checkin_retrospectives")
    .select("member_id, presentation_order, created_at")
    .eq("session", session);
  if (error) return null;
  if (!retros || retros.length === 0) return [];

  const memberIds = [...new Set(retros.map((r) => r.member_id as string))];
  const { data: members, error: memberError } = await admin
    .from("checkin_members")
    .select("id, nickname")
    .in("id", memberIds);
  if (memberError) return null;
  const nickname = new Map(
    (members ?? []).map((m) => [m.id as string, m.nickname as string | null]),
  );

  const sorted = [...retros].sort((a, b) => {
    const ao = a.presentation_order as number | null;
    const bo = b.presentation_order as number | null;
    if (ao !== null && bo !== null) return bo - ao;
    if (ao !== null) return -1;
    if (bo !== null) return 1;
    return (
      new Date(a.created_at as string).getTime() -
      new Date(b.created_at as string).getTime()
    );
  });
  return sorted.map((r) => nickname.get(r.member_id as string) ?? "멤버");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function eventBody(
  poll: EventPollRow,
  start: Date,
  order: string[],
  siteUrl: string,
  voiceChannelId: string | null,
): Record<string, unknown> {
  const retroMonth = poll.month === 1 ? 12 : poll.month - 1;
  const end = new Date(start.getTime() + MEETING_HOURS * 60 * 60 * 1000);

  const lines = [`회고 보러 가기: ${siteUrl}`, "", "발표 순서"];
  if (order.length === 0) {
    lines.push("아직 올라온 회고가 없어요.");
  } else {
    order.forEach((name, i) => lines.push(`${i + 1}. ${name}`));
  }

  const online = poll.type === "online";
  return {
    name: truncate(`${retroMonth}월 회고`, NAME_MAX),
    description: truncate(lines.join("\n"), DESCRIPTION_MAX),
    privacy_level: 2, // GUILD_ONLY
    scheduled_start_time: start.toISOString(),
    scheduled_end_time: end.toISOString(),
    entity_type: online ? 2 : 3, // VOICE : EXTERNAL
    channel_id: online ? voiceChannelId : null,
    entity_metadata: online
      ? null
      : {
          location: truncate(
            poll.location?.trim() || "장소 미정",
            LOCATION_MAX,
          ),
        },
  };
}

async function recordResult(
  admin: SupabaseClient,
  pollId: string,
  fields: {
    discord_event_id?: string | null;
    discord_event_error: string | null;
  },
) {
  await admin
    .from("checkin_vote_polls")
    .update({ ...fields, discord_event_synced_at: new Date().toISOString() })
    .eq("id", pollId);
}

async function readPoll(
  admin: SupabaseClient,
  pollId: string,
): Promise<{ poll: EventPollRow | null } | { error: true }> {
  const { data, error } = await admin
    .from("checkin_vote_polls")
    .select(EVENT_POLL_COLUMNS)
    .eq("id", pollId)
    .maybeSingle<EventPollRow>();
  return error ? { error: true } : { poll: data };
}

/** 이벤트를 지우고 poll 에서 id 를 비운다. 그 사이 다른 호출이 id 를 바꿨으면 건드리지 않는다 */
async function removeEvent(
  admin: SupabaseClient,
  config: Config,
  pollId: string,
  eventId: string,
): Promise<Response> {
  const res = await callDiscord(
    "DELETE",
    `${config.eventsUrl}/${eventId}`,
    config.headers,
  );
  if (!res.ok && !res.unknownEvent) {
    await recordResult(admin, pollId, { discord_event_error: res.error });
    return fail(502, "DISCORD_FAILED", res.error);
  }
  await admin
    .from("checkin_vote_polls")
    .update({
      discord_event_id: null,
      discord_event_error: null,
      discord_event_synced_at: new Date().toISOString(),
    })
    .eq("id", pollId)
    .eq("discord_event_id", eventId);
  return json(200, { ok: true, deleted: eventId });
}

async function syncPollEvent(
  admin: SupabaseClient,
  pollId: string,
  siteUrl: string,
): Promise<Response> {
  const read = await readPoll(admin, pollId);
  if ("error" in read)
    return fail(500, "DB_ERROR", "투표를 조회하지 못했습니다");
  const poll = read.poll;
  // 행이 지워졌으면 삭제 트리거(poll_event_delete)가 맡는다
  if (!poll) return json(200, { ok: true, skipped: "not_found" });

  const config = readConfig();
  const wanted = poll.status === "confirmed" && !!poll.confirmed_date;

  if (!wanted) {
    if (!poll.discord_event_id)
      return json(200, { ok: true, skipped: "no_event" });
    if ("error" in config) {
      await recordResult(admin, poll.id, { discord_event_error: config.error });
      return fail(500, "CONFIG", config.error);
    }
    return removeEvent(admin, config, poll.id, poll.discord_event_id);
  }

  const start = startTime(poll);
  if (!start) {
    await recordResult(admin, poll.id, { discord_event_error: "invalid_time" });
    return fail(422, "INVALID_TIME", "확정 일시를 읽지 못했습니다");
  }
  // 이미 시작한(또는 지난) 일정은 디스코드가 시간을 받지 않는다. 있는 이벤트도 건드리지 않는다
  if (start.getTime() <= Date.now()) {
    if (!poll.discord_event_id) {
      await recordResult(admin, poll.id, { discord_event_error: "past" });
    }
    return json(200, { ok: true, skipped: "past" });
  }

  if ("error" in config) {
    await recordResult(admin, poll.id, { discord_event_error: config.error });
    return fail(500, "CONFIG", config.error);
  }
  if (poll.type === "online" && !config.voiceChannelId) {
    await recordResult(admin, poll.id, {
      discord_event_error: "missing_channel_id",
    });
    return fail(500, "CONFIG", "missing_channel_id");
  }

  const session = retroSession(poll.session);
  const order = session ? await presentationOrder(admin, session) : [];
  if (order === null)
    return fail(500, "DB_ERROR", "회고를 조회하지 못했습니다");
  const body = eventBody(poll, start, order, siteUrl, config.voiceChannelId);

  if (poll.discord_event_id) {
    const patched = await callDiscord(
      "PATCH",
      `${config.eventsUrl}/${poll.discord_event_id}`,
      config.headers,
      body,
    );
    if (patched.ok) {
      await recordResult(admin, poll.id, { discord_event_error: null });
      return json(200, { ok: true, updated: poll.discord_event_id });
    }
    if (!patched.unknownEvent) {
      await recordResult(admin, poll.id, {
        discord_event_error: patched.error,
      });
      return fail(502, "DISCORD_FAILED", patched.error);
    }
    // 디스코드에서 사라졌으면 id 를 비우고 새로 만든다
    await admin
      .from("checkin_vote_polls")
      .update({ discord_event_id: null })
      .eq("id", poll.id)
      .eq("discord_event_id", poll.discord_event_id);
  }

  const created = await callDiscord(
    "POST",
    config.eventsUrl,
    config.headers,
    body,
  );
  const eventId = created.ok ? created.data?.id : null;
  if (!created.ok || typeof eventId !== "string") {
    const error = created.ok ? "invalid_response" : created.error;
    await recordResult(admin, poll.id, { discord_event_error: error });
    return fail(502, "DISCORD_FAILED", error);
  }

  // 동시에 들어온 다른 동기화가 먼저 저장했으면 방금 만든 이벤트는 지운다 → poll 하나에 이벤트 하나
  const { data: claimed } = await admin
    .from("checkin_vote_polls")
    .update({
      discord_event_id: eventId,
      discord_event_error: null,
      discord_event_synced_at: new Date().toISOString(),
    })
    .eq("id", poll.id)
    .is("discord_event_id", null)
    .select("id");
  if (!claimed || claimed.length === 0) {
    await callDiscord(
      "DELETE",
      `${config.eventsUrl}/${eventId}`,
      config.headers,
    );
    return json(200, { ok: true, skipped: "lost_race" });
  }

  // 만드는 사이 닫혔으면 그때의 동기화는 id 가 없어 아무것도 못 했다. 여기서 정리한다
  const after = await readPoll(admin, poll.id);
  if ("poll" in after && after.poll && after.poll.status !== "confirmed") {
    return removeEvent(admin, config, poll.id, eventId);
  }
  return json(200, { ok: true, created: eventId });
}

async function deletePollEvent(
  body: Record<string, unknown>,
): Promise<Response> {
  const eventId = body.event_id;
  if (typeof eventId !== "string" || !SNOWFLAKE_PATTERN.test(eventId)) {
    return fail(400, "INVALID_EVENT", "event_id는 디스코드 이벤트 id");
  }
  const config = readConfig();
  if ("error" in config) return fail(500, "CONFIG", config.error);
  const res = await callDiscord(
    "DELETE",
    `${config.eventsUrl}/${eventId}`,
    config.headers,
  );
  if (!res.ok && !res.unknownEvent)
    return fail(502, "DISCORD_FAILED", res.error);
  return json(200, { ok: true, deleted: eventId });
}

export function handlePollEvent(
  type: PollEventType,
  body: Record<string, unknown>,
  admin: SupabaseClient,
  siteUrl: string,
): Promise<Response> {
  if (type === "poll_event_delete") return deletePollEvent(body);
  const refId = body.ref_id;
  if (typeof refId !== "string" || !UUID_PATTERN.test(refId)) {
    return Promise.resolve(fail(400, "INVALID_REF", "ref_id는 투표 id(UUID)"));
  }
  return syncPollEvent(admin, refId, siteUrl);
}
