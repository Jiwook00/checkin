// 봇 DM 발송 (#105). discord-notify 함수가 쓴다. 봇은 HTTP Interactions만 쓰고 REST로 보낸다 (ADR 0011)
//
// 봇 토큰(DISCORD_BOT_TOKEN)은 함수 시크릿에만 둔다. 웹훅과 같이 예외 메시지는 남기지 않고 error 에는 코드만 돌려준다.
// 봇은 같은 서버에 있는 사람에게만 DM을 보낼 수 있고, 받는 사람이 서버 DM을 꺼 두면 Discord가 50007로 거절한다

import {
  postDiscord,
  type SendResult,
  type WebhookPayload,
} from "./webhook.ts";

const API = "https://discord.com/api/v10";

// "Cannot send messages to this user" — 서버 DM 꺼짐, 서버를 나감, 봇 차단
const CANNOT_MESSAGE_USER = 50007;

/** DM으로 보낸다. `error`는 missing_bot_token / dm_closed / network_error / http_<status> 중 하나 */
export async function sendDm(
  discordUserId: string,
  payload: WebhookPayload,
): Promise<SendResult> {
  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token) return { ok: false, error: "missing_bot_token" };
  const headers = { Authorization: `Bot ${token}` };

  // 같은 사람에게는 늘 같은 DM 채널이 돌아온다
  const opened = await postDiscord(
    `${API}/users/@me/channels`,
    headers,
    JSON.stringify({ recipient_id: discordUserId }),
  );
  if ("error" in opened) return { ok: false, error: opened.error };
  if (!opened.res.ok) return { ok: false, error: await errorCode(opened.res) };
  const channel = await opened.res.json().catch(() => null);
  if (typeof channel?.id !== "string") {
    return { ok: false, error: "invalid_response" };
  }

  // 댓글 본문에 @everyone·멘션이 있어도 울리지 않게 막는다
  const sent = await postDiscord(
    `${API}/channels/${channel.id}/messages`,
    headers,
    JSON.stringify({ ...payload, allowed_mentions: { parse: [] } }),
  );
  if ("error" in sent) return { ok: false, error: sent.error };
  if (!sent.res.ok) return { ok: false, error: await errorCode(sent.res) };
  const message = await sent.res.json().catch(() => null);
  return { ok: true, messageId: String(message?.id ?? "") };
}

async function errorCode(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.code === CANNOT_MESSAGE_USER
    ? "dm_closed"
    : `http_${res.status}`;
}
