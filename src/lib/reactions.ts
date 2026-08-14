import { supabase } from "./supabase";
import type { Reaction, ReactionGroup, ReactionTargetType } from "../types";

// 글 + 그 글의 댓글들에 달린 반응을 한 번에 가져온다.
// target_id는 UUID라 테이블 간 값이 겹치지 않아 target_id in (...) 만으로 안전.
export async function fetchReactions(targetIds: string[]): Promise<Reaction[]> {
  if (targetIds.length === 0) return [];
  const { data, error } = await supabase
    .from("checkin_reactions")
    .select("*, checkin_members!member_id(nickname)")
    .in("target_id", targetIds)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as Reaction[];
}

// 특정 대상의 반응을 이모지별로 묶는다 (렌더 타임 집계, 최초 등장 순서 유지).
export function groupReactions(
  reactions: Reaction[],
  targetType: ReactionTargetType,
  targetId: string,
  currentMemberId: string,
): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  for (const r of reactions) {
    if (r.target_type !== targetType || r.target_id !== targetId) continue;
    const g = map.get(r.emoji) ?? {
      emoji: r.emoji,
      count: 0,
      mine: false,
      memberNames: [],
    };
    g.count += 1;
    if (r.member_id === currentMemberId) g.mine = true;
    if (r.checkin_members?.nickname)
      g.memberNames.push(r.checkin_members.nickname);
    map.set(r.emoji, g);
  }
  return [...map.values()];
}

// toggle: 내가 그 이모지를 이미 눌렀으면 삭제, 아니면 추가.
export async function toggleReaction(
  targetType: ReactionTargetType,
  targetId: string,
  emoji: string,
  memberId: string,
  mine: boolean,
): Promise<void> {
  if (mine) {
    const { error } = await supabase.from("checkin_reactions").delete().match({
      target_type: targetType,
      target_id: targetId,
      member_id: memberId,
      emoji,
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("checkin_reactions").insert({
      target_type: targetType,
      target_id: targetId,
      member_id: memberId,
      emoji,
    });
    if (error) throw new Error(error.message);
  }
}
