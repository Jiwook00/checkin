// 디스코드 `개발자` 역할 부여 (이슈 #133, ADR 0015)
//
// 이미 역할이 있는지는 interaction 이 실어 준 member.roles 로 판단해서 API 를 부르지 않는다.
// 봇 토큰(DISCORD_BOT_TOKEN)은 함수 시크릿에만 둔다. 토큰·응답 본문·예외 메시지는 남기지 않고 코드만 돌려준다.
// 봇은 자기 역할보다 아래 역할만 줄 수 있다. 서버 설정에서 봇 역할을 개발자 바로 위에 둬야 한다

import { requestDiscord } from "../_shared/discord/webhook.ts";

const API = "https://discord.com/api/v10";

// "Missing Permissions" — Manage Roles 가 없거나 봇 역할이 대상 역할보다 아래
const MISSING_PERMISSIONS = 50013;

export type RoleError =
  | "missing_bot_token"
  | "missing_role_config"
  | "missing_permissions"
  | "network_error"
  | "unexpected"
  | `http_${number}`;

export type RoleResult =
  | { status: "granted" | "already_had" }
  | { status: "failed"; error: RoleError };

export async function grantDeveloperRole(
  guildId: string,
  userId: string,
  currentRoles: string[],
): Promise<RoleResult> {
  const roleId = Deno.env.get("DISCORD_DEVELOPER_ROLE_ID");
  if (!roleId) return { status: "failed", error: "missing_role_config" };
  if (currentRoles.includes(roleId)) return { status: "already_had" };

  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token) return { status: "failed", error: "missing_bot_token" };

  const result = await requestDiscord(
    "PUT",
    `${API}/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      Authorization: `Bot ${token}`,
      "X-Audit-Log-Reason": encodeURIComponent("/기여"),
    },
  );
  if ("error" in result) {
    return {
      status: "failed",
      error: result.error === "http_429" ? "http_429" : "network_error",
    };
  }
  const { res } = result;
  if (res.status === 204) return { status: "granted" };
  if (res.status === 403) {
    const data = await res.json().catch(() => null);
    return {
      status: "failed",
      error:
        data?.code === MISSING_PERMISSIONS ? "missing_permissions" : "http_403",
    };
  }
  return { status: "failed", error: `http_${res.status}` };
}
