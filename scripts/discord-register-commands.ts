// 디스코드 슬래시 커맨드를 길드에 등록한다 (이슈 #133, ADR 0015). 메인테이너가 손으로 돌린다
//
// 실행: deno run --allow-env --allow-net scripts/discord-register-commands.ts
// env : DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
//
// bulk overwrite 라서 정의 배열을 통째로 보낸다. 다시 돌려도 안전하고, 정의에서 빠진 커맨드는 서버에서도 지워진다.
// 커맨드를 추가하거나 바꾸면(supabase/functions/discord-interactions/commands/definitions.ts) 이 스크립트를 다시 돌려야 반영된다.
// 토큰은 출력하지 않는다. 등록된 커맨드 이름만 찍는다 (함수 코드가 아니라 스크립트라 console 출력을 쓴다)

import { COMMAND_DEFINITIONS } from "../supabase/functions/discord-interactions/commands/definitions.ts";

const applicationId = Deno.env.get("DISCORD_APPLICATION_ID");
const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
const guildId = Deno.env.get("DISCORD_GUILD_ID");

if (!applicationId || !botToken || !guildId) {
  console.error(
    "DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID 가 필요합니다",
  );
  Deno.exit(1);
}

let res: Response;
try {
  res = await fetch(
    `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(COMMAND_DEFINITIONS),
    },
  );
} catch {
  console.error("등록 실패: network_error");
  Deno.exit(1);
}

if (!res.ok) {
  console.error(`등록 실패: http_${res.status}`);
  Deno.exit(1);
}

const registered: { name: string }[] = await res.json();
console.log(`등록한 커맨드: ${registered.map((c) => c.name).join(", ")}`);
