// 회고 댓글 DM 알림 (이슈 #105, #120)
//
// 받는 사람은 글 작성자와 그 글에 먼저 댓글을 단 사람들(참여자)이다. 댓글 쓴 본인은 빼고, 한 사람에게 한 통만 보낸다.
// 작성자이면서 참여자면 작성자로 보낸다. 연달아 달린 댓글도 묶지 않고 댓글마다 보낸다.
// 디스코드 미연결, 알림 끔(notify_comment_dm), 그 사이 삭제된 댓글·글은 기록 없이 건너뛴다.
// 본문은 앞 BODY_MAX 자만 넣는다. 받는 사람은 모두 웹앱에서 원래 그 댓글을 읽을 수 있는 멤버다

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMBED_COLOR,
  type WebhookPayload,
} from "../_shared/discord/webhook.ts";

const BODY_MAX = 200;
// 본문 아래 링크로 붙는 글 제목의 길이 상한
const TITLE_MAX = 100;

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  member_id: string;
  retrospective_id: string;
}

interface RetroRow {
  id: string;
  title: string;
  member_id: string;
}

interface MemberRow {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  discord_user_id: string | null;
  notify_comment_dm: boolean;
}

/** 왜 받는가. author = 내 글에 달린 댓글, participant = 내가 댓글 단 글에 달린 새 댓글 */
export type CommentDmReason = "author" | "participant";

export interface CommentDm {
  memberId: string;
  discordUserId: string;
  payload: WebhookPayload;
}

export type CommentDmResult =
  | { kind: "dm"; dms: CommentDm[] }
  | { kind: "skip"; reason: string }
  | { kind: "error"; message: string };

function truncate(text: string, max: number): string {
  const chars = Array.from(text.trim());
  return chars.length > max
    ? `${chars.slice(0, max - 1).join("")}…`
    : chars.join("");
}

// 제목이 마스킹 링크 [제목](url) 안에 들어가므로 링크·서식을 깨는 문자를 이스케이프한다
function escapeMarkdown(text: string): string {
  return text.replace(/([\\[\]()*_~`|>])/g, "\\$1");
}

const HEADLINE: Record<CommentDmReason, string> = {
  author: "님이 댓글을 남겼어요",
  participant: "님이 댓글 단 글에 새 댓글을 남겼어요",
};

export function commentDmPayload(
  comment: CommentRow,
  retro: RetroRow,
  commenter: MemberRow | null,
  reason: CommentDmReason,
  siteUrl: string,
): WebhookPayload {
  const nickname = commenter?.nickname ?? "멤버";
  const avatar = commenter?.avatar_url;
  const retroUrl = `${siteUrl}/articles/${retro.id}`;
  const retroLink = `[${escapeMarkdown(truncate(retro.title, TITLE_MAX))}](${retroUrl})`;
  // 누가 → 어떤 댓글 → 어느 글 순서. embed title 은 본문 위에 그려지므로 쓰지 않고 글 제목은 본문 아래 링크로 둔다
  return {
    embeds: [
      {
        author: {
          name: `${nickname}${HEADLINE[reason]}`,
          url: retroUrl,
          ...(avatar?.startsWith("https://") ? { icon_url: avatar } : {}),
        },
        description: `${truncate(comment.body, BODY_MAX)}\n\n${retroLink}`,
        color: EMBED_COLOR,
        timestamp: comment.created_at,
        footer: { text: "댓글 알림 · 프로필에서 끌 수 있어요" },
      },
    ],
  };
}

/** commentId 는 호출 전에 UUID 형식을 확인한다 */
export async function buildCommentDms(
  commentId: string,
  admin: SupabaseClient,
  siteUrl: string,
): Promise<CommentDmResult> {
  const { data: comment, error: commentError } = await admin
    .from("checkin_comments")
    .select("id, body, created_at, member_id, retrospective_id")
    .eq("id", commentId)
    .maybeSingle<CommentRow>();
  if (commentError)
    return { kind: "error", message: "댓글을 조회하지 못했습니다" };
  if (!comment) return { kind: "skip", reason: "comment_deleted" };

  const { data: retro, error: retroError } = await admin
    .from("checkin_retrospectives")
    .select("id, title, member_id")
    .eq("id", comment.retrospective_id)
    .maybeSingle<RetroRow>();
  if (retroError)
    return { kind: "error", message: "회고를 조회하지 못했습니다" };
  if (!retro) return { kind: "skip", reason: "retro_deleted" };

  // 이 댓글보다 먼저 달린 댓글의 작성자. 나중에 다시 불려도 같은 사람들이 나오도록 시각으로 자른다
  const { data: earlier, error: earlierError } = await admin
    .from("checkin_comments")
    .select("member_id")
    .eq("retrospective_id", retro.id)
    .lt("created_at", comment.created_at)
    .returns<{ member_id: string }[]>();
  if (earlierError)
    return { kind: "error", message: "참여자를 조회하지 못했습니다" };

  // 작성자를 먼저 넣어서, 작성자이면서 참여자인 사람은 작성자로 남게 한다
  const reasons = new Map<string, CommentDmReason>([
    [retro.member_id, "author"],
  ]);
  for (const { member_id } of earlier ?? []) {
    if (!reasons.has(member_id)) reasons.set(member_id, "participant");
  }
  reasons.delete(comment.member_id);
  if (reasons.size === 0) return { kind: "skip", reason: "own_comment" };

  const { data: members, error: memberError } = await admin
    .from("checkin_members")
    .select("id, nickname, avatar_url, discord_user_id, notify_comment_dm")
    .in("id", [...reasons.keys(), comment.member_id])
    .returns<MemberRow[]>();
  if (memberError)
    return { kind: "error", message: "멤버를 조회하지 못했습니다" };

  const commenter = members?.find((m) => m.id === comment.member_id) ?? null;
  const dms: CommentDm[] = [];
  for (const [memberId, reason] of reasons) {
    const member = members?.find((m) => m.id === memberId);
    if (!member?.discord_user_id || !member.notify_comment_dm) continue;
    dms.push({
      memberId,
      discordUserId: member.discord_user_id,
      payload: commentDmPayload(comment, retro, commenter, reason, siteUrl),
    });
  }
  if (dms.length === 0) return { kind: "skip", reason: "no_recipients" };

  return { kind: "dm", dms };
}
