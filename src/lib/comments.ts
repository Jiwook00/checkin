import { supabase } from "./supabase";
import type { Comment } from "../types";

export async function fetchComments(
  retrospectiveId: string,
): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("checkin_comments")
    .select("*, checkin_members!member_id(nickname, avatar_url)")
    .eq("retrospective_id", retrospectiveId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as Comment[];
}

export async function addComment(
  retrospectiveId: string,
  memberId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.from("checkin_comments").insert({
    retrospective_id: retrospectiveId,
    member_id: memberId,
    body,
  });
  if (error) throw new Error(error.message);
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase
    .from("checkin_comments")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
