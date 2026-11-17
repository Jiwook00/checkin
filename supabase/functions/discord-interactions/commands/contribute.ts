// /기여 github:<아이디> (이슈 #133, ADR 0015)
//
// 누른 사람이 디스코드를 연결한 멤버면 GitHub 콜라보레이터 초대와 디스코드 `개발자` 역할을 한 번에 처리한다.
// 3초 안에 끝나는 검사(서버·아이디 형식·멤버 조회)는 바로 답하고, 외부 API 를 부르는 일은 deferred 응답 뒤에 이어서 한다.
// interaction token 은 후속 메시지 URL 에만 쓰고 로그·DB·응답에 남기지 않는다. 입력값은 검사를 통과한 것만 문구에 넣는다

import { requestDiscord } from "../../_shared/discord/webhook.ts";
import {
  GITHUB_REPO,
  type GithubResult,
  inviteCollaborator,
} from "../github.ts";
import {
  deferredEphemeral,
  ephemeral,
  type Interaction,
} from "../interaction.ts";
import { grantDeveloperRole, type RoleResult } from "../role.ts";
import type { CommandContext } from "./index.ts";

// Supabase Edge Runtime 전역. 응답을 돌려준 뒤에도 이 Promise 가 끝날 때까지 함수를 살려 둔다
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const API = "https://discord.com/api/v10";

// GitHub 아이디: 영숫자와 하이픈, 하이픈은 처음·끝·연속 불가, 39자 이하
const GITHUB_LOGIN_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

const ECHO_MAX = 40;
const INVITATIONS_URL = `https://github.com/${GITHUB_REPO}/invitations`;
const GUIDE_URL = `https://github.com/${GITHUB_REPO}/blob/main/.github/CONTRIBUTING.md`;

export async function handleContribute(
  interaction: Interaction,
  ctx: CommandContext,
): Promise<Response> {
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id;
  if (!guildId || !userId || guildId !== Deno.env.get("DISCORD_GUILD_ID")) {
    return ephemeral("체크인 디스코드 서버에서 실행해 주세요.");
  }

  const option = interaction.data?.options?.find((o) => o?.name === "github");
  const input = typeof option?.value === "string" ? option.value.trim() : "";
  if (!GITHUB_LOGIN_PATTERN.test(input)) {
    const shown = input.replaceAll("`", "'").slice(0, ECHO_MAX);
    return ephemeral(
      `\`${shown}\`은 GitHub 아이디 형식이 아니에요. 영문·숫자·하이픈으로 된 39자 이하 아이디를 입력해 주세요.`,
    );
  }

  const { data: member, error } = await ctx.admin
    .from("checkin_members")
    .select("id")
    .eq("discord_user_id", userId)
    .maybeSingle();
  if (error) {
    return ephemeral("지금은 확인할 수 없어요. 잠시 뒤에 다시 시도해 주세요.");
  }
  if (!member) {
    return ephemeral(
      "아직 체크인 멤버와 디스코드 계정이 연결되지 않았어요. 메인테이너에게 연결을 부탁해 주세요.",
    );
  }

  const work = finish(interaction, ctx, {
    memberId: String(member.id),
    guildId,
    userId,
    login: input,
  });
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  return deferredEphemeral();
}

interface Job {
  memberId: string;
  guildId: string;
  userId: string;
  login: string;
}

/** 후속 메시지까지 끝낸다. 어디서 예외가 나도 밖으로 던지지 않는다 */
async function finish(
  interaction: Interaction,
  ctx: CommandContext,
  job: Job,
): Promise<void> {
  // GitHub 와 역할은 서로 상관없이 따로 시도한다. 하나가 실패해도 나머지는 진행한다
  const github = await attempt<GithubResult>(
    () => inviteCollaborator(job.login),
    { status: "failed", error: "unexpected" },
  );
  const role = await attempt<RoleResult>(
    () =>
      grantDeveloperRole(
        job.guildId,
        job.userId,
        interaction.member?.roles ?? [],
      ),
    { status: "failed", error: "unexpected" },
  );

  // 기록이 실패해도 사용자 응답은 보낸다
  try {
    await ctx.admin.from("checkin_contributor_grants").insert({
      member_id: job.memberId,
      github_login: job.login,
      github_status: github.status,
      github_error: github.status === "failed" ? github.error : null,
      role_status: role.status,
      role_error: role.status === "failed" ? role.error : null,
    });
  } catch {
    // 코드만 남기는 원칙이라 여기서는 삼킨다
  }

  const content = buildMessage(job.login, github, role);
  if (!interaction.application_id || !interaction.token) return;
  try {
    await requestDiscord(
      "PATCH",
      `${API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
      {},
      JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    );
  } catch {
    // 보낼 수 없으면 할 수 있는 게 없다. 예외 메시지에는 URL(token)이 들어갈 수 있어 남기지 않는다
  }
}

async function attempt<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

function buildMessage(
  login: string,
  github: GithubResult,
  role: RoleResult,
): string {
  return [
    githubLine(login, github),
    roleLine(role),
    `기여 가이드: ${GUIDE_URL}`,
  ].join("\n");
}

function githubLine(login: string, github: GithubResult): string {
  switch (github.status) {
    case "invited":
      return `GitHub 초대를 보냈어요. 메일이나 ${INVITATIONS_URL} 에서 수락해 주세요.`;
    case "already_invited":
      return `이미 보낸 초대가 기다리고 있어요. ${INVITATIONS_URL} 에서 수락해 주세요.`;
    case "already_collaborator":
      return "이미 저장소 콜라보레이터예요.";
  }
  switch (github.error) {
    case "user_not_found":
      return `GitHub에서 \`${login}\` 계정을 찾지 못했어요. 아이디를 다시 확인해 주세요.`;
    case "invalid_user":
      return "이 계정은 초대할 수 없어요. (`invalid_user`)";
    default:
      return `지금은 GitHub 초대를 보낼 수 없어요. 메인테이너에게 알려 주세요. (\`${github.error}\`)`;
  }
}

function roleLine(role: RoleResult): string {
  switch (role.status) {
    case "granted":
      return "`개발자` 역할을 드렸어요. 이제 #개발 채널이 보여요.";
    case "already_had":
      return "이미 `개발자` 역할이 있어요.";
    default:
      return `\`개발자\` 역할을 드리지 못했어요. 메인테이너에게 알려 주세요. (\`${role.error}\`)`;
  }
}
