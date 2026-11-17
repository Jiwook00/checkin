// 슬래시 커맨드 정의 (이슈 #133). 서버에 등록하는 모양이라 import 없이 순수 데이터만 둔다
//
// 등록 스크립트(scripts/discord-register-commands.ts)가 이 배열을 통째로 보낸다.
// 커맨드를 추가하거나 바꾸면 그 스크립트를 다시 돌려야 Discord에 반영된다

const OPTION_TYPE_STRING = 3;
const COMMAND_TYPE_CHAT_INPUT = 1;
// 서버(길드) 채널에서만 쓰게 한다. DM(1)·봇 DM(2)에서는 보이지 않는다
const CONTEXT_GUILD = 0;

export const GITHUB_LOGIN_MAX = 39;

export const COMMAND_DEFINITIONS = [
  {
    name: "기여",
    description: "체크인 저장소 콜라보레이터 초대와 개발자 역할을 받아요",
    type: COMMAND_TYPE_CHAT_INPUT,
    contexts: [CONTEXT_GUILD],
    options: [
      {
        type: OPTION_TYPE_STRING,
        name: "github",
        description: "GitHub 아이디",
        required: true,
        min_length: 1,
        max_length: GITHUB_LOGIN_MAX,
      },
    ],
  },
];
