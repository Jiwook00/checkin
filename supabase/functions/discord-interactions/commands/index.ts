// 커맨드 이름 → 핸들러 (이슈 #133). 커맨드를 늘릴 때는 핸들러를 여기에 걸고 definitions.ts 에 정의를 더한 뒤
// 등록 스크립트를 다시 돌린다

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Interaction } from "../interaction.ts";
import { handleContribute } from "./contribute.ts";

export { COMMAND_DEFINITIONS } from "./definitions.ts";

export interface CommandContext {
  /** service role 클라이언트. 커맨드는 사용자 세션이 없어서 멤버 조회·기록을 이걸로 한다 */
  admin: SupabaseClient;
}

export type CommandHandler = (
  interaction: Interaction,
  ctx: CommandContext,
) => Promise<Response>;

export const COMMANDS: Record<string, CommandHandler> = {
  기여: handleContribute,
};
