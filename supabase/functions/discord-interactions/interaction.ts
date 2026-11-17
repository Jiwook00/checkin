// Discord Interaction 최소 타입과 응답 헬퍼 (이슈 #133). 우리가 읽는 필드만 적는다
//
// 서명을 통과한 body 라도 필드가 있다고 믿지 않는다. 읽는 쪽에서 타입을 확인한다

import { json } from "../_shared/http.ts";

export const INTERACTION_PING = 1;
export const INTERACTION_APPLICATION_COMMAND = 2;

const RESPONSE_CHANNEL_MESSAGE = 4;
const RESPONSE_DEFERRED_CHANNEL_MESSAGE = 5;

// 응답 flags: 64 = ephemeral (누른 사람에게만 보인다)
const FLAG_EPHEMERAL = 64;

export interface CommandOption {
  name?: unknown;
  type?: unknown;
  value?: unknown;
}

export interface Interaction {
  type?: unknown;
  id?: string;
  application_id?: string;
  /** 후속 메시지를 고칠 수 있는 15분짜리 열쇠. 로그·DB·응답에 남기지 않는다 */
  token?: string;
  guild_id?: string;
  member?: { user?: { id?: string }; roles?: string[] };
  data?: { name?: string; options?: CommandOption[] };
}

/** 누른 사람에게만 보이는 즉시 응답. 멘션은 울리지 않게 막는다 */
export function ephemeral(content: string): Response {
  return json(200, {
    type: RESPONSE_CHANNEL_MESSAGE,
    data: { content, flags: FLAG_EPHEMERAL, allowed_mentions: { parse: [] } },
  });
}

/** "생각 중" 응답. 3초 제한을 넘기는 일은 이 뒤에 후속 메시지로 끝낸다. flags 를 여기서 줘야 후속 메시지도 ephemeral 이다 */
export function deferredEphemeral(): Response {
  return json(200, {
    type: RESPONSE_DEFERRED_CHANNEL_MESSAGE,
    data: { flags: FLAG_EPHEMERAL },
  });
}
