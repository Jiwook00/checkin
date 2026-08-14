import { useEffect, useMemo, useState } from "react";
import type { Comment, Reaction, ReactionTargetType } from "../types";
import { addComment, deleteComment, fetchComments } from "../lib/comments";
import {
  fetchReactions,
  groupReactions,
  toggleReaction,
} from "../lib/reactions";
import { memberColorClass } from "../lib/vote";
import ReactionBar from "./ReactionBar";

interface CommentSectionProps {
  retrospectiveId: string;
  currentMemberId: string;
  onCommentCountChange?: (count: number) => void;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diff < hour) return "방금 전";
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < day * 7) return `${Math.floor(diff / day)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

function Avatar({
  url,
  name,
  memberId,
}: {
  url: string | null;
  name: string;
  memberId: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ${memberColorClass(
        memberId,
      )}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default function CommentSection({
  retrospectiveId,
  currentMemberId,
  onCommentCountChange,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const cs = await fetchComments(retrospectiveId);
    setComments(cs);
    onCommentCountChange?.(cs.length);
    setReactions(
      await fetchReactions([retrospectiveId, ...cs.map((c) => c.id)]),
    );
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retrospectiveId]);

  const handleToggle = async (
    targetType: ReactionTargetType,
    targetId: string,
    emoji: string,
  ) => {
    const mine = reactions.some(
      (r) =>
        r.target_type === targetType &&
        r.target_id === targetId &&
        r.emoji === emoji &&
        r.member_id === currentMemberId,
    );
    await toggleReaction(targetType, targetId, emoji, currentMemberId, mine);
    setReactions(
      await fetchReactions([retrospectiveId, ...comments.map((c) => c.id)]),
    );
  };

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      await addComment(retrospectiveId, currentMemberId, body);
      setDraft("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteComment(id);
    await load();
  };

  const postGroups = useMemo(
    () =>
      groupReactions(
        reactions,
        "retrospective",
        retrospectiveId,
        currentMemberId,
      ),
    [reactions, retrospectiveId, currentMemberId],
  );

  return (
    <section id="comments" className="mx-auto max-w-3xl px-6 pb-20">
      {/* 글 반응 */}
      <div className="border-t border-hairline pt-6">
        <ReactionBar
          groups={postGroups}
          onToggle={(e) => handleToggle("retrospective", retrospectiveId, e)}
        />
      </div>

      {/* 댓글 */}
      <div className="mt-10">
        <h2 className="mb-5 text-sm font-bold text-ink">
          댓글 <span className="font-medium text-muted">{comments.length}</span>
        </h2>

        {comments.length === 0 ? (
          <p className="mb-2 text-sm text-muted-soft">첫 댓글을 남겨보세요.</p>
        ) : (
          <ul className="space-y-6">
            {comments.map((c) => {
              const name = c.checkin_members?.nickname ?? "알 수 없음";
              const groups = groupReactions(
                reactions,
                "comment",
                c.id,
                currentMemberId,
              );
              return (
                <li key={c.id} className="group flex gap-3">
                  <Avatar
                    url={c.checkin_members?.avatar_url ?? null}
                    name={name}
                    memberId={c.member_id}
                  />
                  <div className="flex-1">
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className="text-[13.5px] font-bold text-ink">
                        {name}
                      </span>
                      <span className="text-xs text-muted-soft">
                        {formatRelative(c.created_at)}
                      </span>
                      {c.member_id === currentMemberId && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="ml-auto text-xs text-muted-soft opacity-0 transition hover:text-error group-hover:opacity-100"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <p className="mb-2 whitespace-pre-wrap text-sm text-body">
                      {c.body}
                    </p>
                    <ReactionBar
                      size="sm"
                      groups={groups}
                      onToggle={(e) => handleToggle("comment", c.id, e)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 작성창 */}
        <div className="mt-6 rounded-[8px] border border-hairline bg-canvas p-3 transition-colors focus-within:border-ink">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="한마디 남기…"
            rows={2}
            className="w-full resize-none text-sm text-ink outline-none placeholder:text-muted-soft"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!draft.trim() || submitting}
              className="h-8 rounded-[8px] bg-primary px-4 text-[13px] font-semibold text-on-primary transition-colors hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted"
            >
              남기기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
