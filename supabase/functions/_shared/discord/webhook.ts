// 디스코드 웹훅 발송 (#98). discord-notify 함수가 쓴다
//
// 웹훅 URL은 채널에 글을 쓸 수 있는 열쇠라서 함수 시크릿에만 둔다. Deno fetch 실패 메시지에는 요청 URL이 들어가므로
// 예외 메시지는 저장·응답·로그 어디에도 쓰지 않고 error 에는 코드만 돌려준다

export type DiscordChannel = "announce" | "retro";

const WEBHOOK_ENV: Record<DiscordChannel, string> = {
  announce: "DISCORD_WEBHOOK_ANNOUNCE",
  retro: "DISCORD_WEBHOOK_RETRO",
};

const WEBHOOK_PREFIXES = [
  "https://discord.com/api/webhooks/",
  "https://discordapp.com/api/webhooks/",
];

// DESIGN.md 의 brand-accent (#3b82f6). 디스코드는 CSS 토큰을 못 읽어서 정수 상수로 둔다 (--primary 는 검정이라 다크 테마에서 안 보인다)
export const EMBED_COLOR = 0x3b82f6;

// 한 번 기다려서 재시도하는 429 대기의 상한 (초). 넘으면 실패로 돌려준다
const MAX_RETRY_WAIT_SECONDS = 5;

export interface DiscordEmbed {
  author?: { name: string; url?: string; icon_url?: string };
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: { text: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface WebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/** 채널로 보낸다. `error`는 missing_webhook / invalid_webhook / network_error / http_<status> 중 하나 */
export async function sendWebhook(
  channel: DiscordChannel,
  payload: WebhookPayload,
): Promise<SendResult> {
  const raw = Deno.env.get(WEBHOOK_ENV[channel]);
  if (!raw) return { ok: false, error: "missing_webhook" };
  if (!WEBHOOK_PREFIXES.some((prefix) => raw.startsWith(prefix))) {
    return { ok: false, error: "invalid_webhook" };
  }

  // 응답으로 메시지 id를 받으려면 wait=true 가 필요하다
  const url = new URL(raw);
  url.searchParams.set("wait", "true");

  // 제목에 @everyone 이 들어가도 울리지 않게 멘션은 항상 막는다
  const body = JSON.stringify({ ...payload, allowed_mentions: { parse: [] } });

  const result = await postDiscord(url, {}, body);
  if ("error" in result) return { ok: false, error: result.error };
  const { res } = result;
  if (!res.ok) return { ok: false, error: `http_${res.status}` };
  const data = await res.json().catch(() => null);
  return { ok: true, messageId: String(data?.id ?? "") };
}

/** Discord에 JSON을 POST한다. `requestDiscord`의 POST 판 (#98, #105 DM) */
export function postDiscord(
  url: string | URL,
  headers: Record<string, string>,
  body: string,
): Promise<{ res: Response } | { error: string }> {
  return requestDiscord("POST", url, headers, body);
}

/**
 * Discord REST를 부른다. 429는 한 번만 기다려 재시도한다. 서버 이벤트(#103)가 PATCH·DELETE를, 역할 부여(#133)가 PUT을 쓴다.
 * 429 외의 응답은 그대로 돌려주고, 판정은 부른 쪽이 한다. `error`는 network_error / http_429
 */
export async function requestDiscord(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string | URL,
  headers: Record<string, string>,
  body?: string,
): Promise<{ res: Response } | { error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers:
          body === undefined
            ? headers
            : { ...headers, "Content-Type": "application/json" },
        body,
      });
    } catch {
      return { error: "network_error" };
    }

    if (res.status === 429 && attempt === 0) {
      const retryAfter = await readRetryAfter(res);
      if (retryAfter > MAX_RETRY_WAIT_SECONDS) return { error: "http_429" };
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    return { res };
  }
  return { error: "http_429" };
}

async function readRetryAfter(res: Response): Promise<number> {
  const data = await res.json().catch(() => null);
  const seconds = Number(data?.retry_after);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 1;
}
