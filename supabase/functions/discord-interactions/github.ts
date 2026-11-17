// GitHub 콜라보레이터 초대 (이슈 #133, ADR 0015)
//
// 상태를 먼저 확인하고 필요할 때만 초대한다. 다시 실행해도 초대가 중복되지 않고, 이미 있는 콜라보레이터의 권한은 건드리지 않는다.
// 토큰(GITHUB_INVITE_TOKEN)은 함수 시크릿에만 둔다. 토큰·응답 본문·예외 메시지는 저장·응답·로그 어디에도 쓰지 않고 코드만 돌려준다

export const GITHUB_REPO = "Jiwook00/checkin";

const API = "https://api.github.com";

export type GithubError =
  | "missing_token"
  | "user_not_found"
  | "token_invalid"
  | "forbidden"
  | "invalid_user"
  | "network_error"
  | "unexpected"
  | `http_${number}`;

export type GithubResult =
  | { status: "invited" | "already_invited" | "already_collaborator" }
  | { status: "failed"; error: GithubError };

type Call = { status: number; body: unknown } | { error: "network_error" };

async function call(
  token: string,
  method: "GET" | "PUT",
  path: string,
  body?: Record<string, unknown>,
): Promise<Call> {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "checkin-bot",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    // 204·본문 없는 응답은 null. 본문은 판정에만 쓰고 밖으로 내보내지 않는다
    const parsed = await res.json().catch(() => null);
    return { status: res.status, body: parsed };
  } catch {
    return { error: "network_error" };
  }
}

function failure(status: number): GithubResult {
  if (status === 401) return { status: "failed", error: "token_invalid" };
  if (status === 403) return { status: "failed", error: "forbidden" };
  return { status: "failed", error: `http_${status}` };
}

/** 이미 초대를 보내고 기다리는 중인지. invitee.login 은 대소문자를 구분하지 않고 비교한다 */
function hasPendingInvitation(body: unknown, login: string): boolean {
  if (!Array.isArray(body)) return false;
  const target = login.toLowerCase();
  return body.some(
    (invitation) =>
      typeof invitation?.invitee?.login === "string" &&
      invitation.invitee.login.toLowerCase() === target,
  );
}

/** `login`은 형식 검사를 통과한 값이어야 한다 (경로에 그대로 들어간다) */
export async function inviteCollaborator(login: string): Promise<GithubResult> {
  const token = Deno.env.get("GITHUB_INVITE_TOKEN");
  if (!token) return { status: "failed", error: "missing_token" };

  const collaborator = `/repos/${GITHUB_REPO}/collaborators/${login}`;

  // 404 는 "콜라보레이터 아님"과 "계정 없음"이 같다. 계정 존재 여부는 아래 PUT 의 404 로 판정한다
  const current = await call(token, "GET", collaborator);
  if ("error" in current) return { status: "failed", error: current.error };
  if (current.status === 204) return { status: "already_collaborator" };
  if (current.status !== 404) return failure(current.status);

  const invitations = await call(
    token,
    "GET",
    `/repos/${GITHUB_REPO}/invitations?per_page=100`,
  );
  if ("error" in invitations) {
    return { status: "failed", error: invitations.error };
  }
  if (invitations.status !== 200) return failure(invitations.status);
  if (hasPendingInvitation(invitations.body, login)) {
    return { status: "already_invited" };
  }

  // 개인 저장소에서는 permission 이 무시되고 쓰기 권한이 된다. 그래도 의도를 적어 둔다
  const invited = await call(token, "PUT", collaborator, {
    permission: "push",
  });
  if ("error" in invited) return { status: "failed", error: invited.error };
  if (invited.status === 201) return { status: "invited" };
  if (invited.status === 204) return { status: "already_collaborator" };
  if (invited.status === 404) {
    return { status: "failed", error: "user_not_found" };
  }
  if (invited.status === 422) {
    return { status: "failed", error: "invalid_user" };
  }
  return failure(invited.status);
}
