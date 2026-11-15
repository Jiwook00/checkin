// 회고 댓글 DM 알림 (이슈 #105). ref_id = 댓글 id 라서 댓글 하나에 DM은 한 번만 나간다
//
// 글 작성자에게 보낸다. 연달아 달린 댓글도 묶지 않고 댓글마다 보낸다.
// 본인 댓글, 디스코드 미연결, 알림 끔(notify_comment_dm), 그 사이 삭제된 댓글·글은 기록 없이 건너뛴다.
// 본문은 앞 BODY_MAX 자만 넣는다. 받는 사람은 웹앱에서 원래 그 댓글을 읽을 수 있는 글 작성자 한 명이다

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMBED_COLOR,
  type WebhookPayload,
} from "../_shared/discord/webhook.ts";

const BODY_MAX = 200;
// 디스코드 embed title 상한
const TITLE_MAX = 256;

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

export type CommentDmResult =
  | { kind: "dm"; discordUserId: string; payload: WebhookPayload }
  | { kind: "skip"; reason: string }
  | { kind: "error"; message: string };

function truncate(text: string, max: number): string {
  const chars = Array.from(text.trim());
  return chars.length > max
    ? `${chars.slice(0, max - 1).join("")}…`
    : chars.join("");
}

export function commentDmPayload(
  comment: CommentRow,
  retro: RetroRow,
  commenter: MemberRow | null,
  siteUrl: string,
): WebhookPayload {
  const nickname = commenter?.nickname ?? "멤버";
  const avatar = commenter?.avatar_url;
  return {
    embeds: [
      {
        author: {
          name: `${nickname}님이 댓글을 남겼어요`,
          ...(avatar?.startsWith("https://") ? { icon_url: avatar } : {}),
        },
        title: truncate(retro.title, TITLE_MAX),
        url: `${siteUrl}/articles/${retro.id}`,
        description: truncate(comment.body, BODY_MAX),
        color: EMBED_COLOR,
        timestamp: comment.created_at,
        footer: { text: "댓글 알림 · 프로필에서 끌 수 있어요" },
      },
    ],
  };
}

/** commentId 는 호출 전에 UUID 형식을 확인한다 */
export async function buildCommentDm(
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

  if (retro.member_id === comment.member_id) {
    return { kind: "skip", reason: "own_comment" };
  }

  const { data: members, error: memberError } = await admin
    .from("checkin_members")
    .select("id, nickname, avatar_url, discord_user_id, notify_comment_dm")
    .in("id", [retro.member_id, comment.member_id])
    .returns<MemberRow[]>();
  if (memberError)
    return { kind: "error", message: "멤버를 조회하지 못했습니다" };

  const author = members?.find((m) => m.id === retro.member_id);
  const commenter = members?.find((m) => m.id === comment.member_id) ?? null;
  if (!author?.discord_user_id) return { kind: "skip", reason: "not_linked" };
  if (!author.notify_comment_dm) return { kind: "skip", reason: "opted_out" };

  return {
    kind: "dm",
    discordUserId: author.discord_user_id,
    payload: commentDmPayload(comment, retro, commenter, siteUrl),
  };
}
