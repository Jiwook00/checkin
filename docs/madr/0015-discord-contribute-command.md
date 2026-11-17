# 0015 - 디스코드 /기여 커맨드로 GitHub 초대와 개발자 역할을 셀프 서비스로 준다

- 상태: 승인됨
- 날짜: 2026-11-17
- 관련 이슈: #133 (에픽 #107), 선행 #101·#102, 관련 #106
- 관련 ADR: 0011 (봇 Interactions·권한), 0012 (계정 연결), 0010 (발송 기록 패턴)

## 컨텍스트

기여하려는 멤버가 생길 때마다 메인테이너가 GitHub 콜라보레이터 초대와 디스코드 `개발자` 역할 부여를 손으로 했다. 읽기 권한으로 시작하면 라벨·에픽 연결·push가 막힌다. `#개발` 채널은 `개발자` 역할에게만 보인다.

정할 것은 넷이다.

1. 커맨드를 어떤 구조로 받는가
2. GitHub 초대에 어떤 토큰을 쓰는가
3. 누구에게 열어 주는가
4. 다시 실행하거나 일부가 실패했을 때 어떻게 되는가

## 결정

### 커맨드 처리 구조

- `discord-interactions`가 type 2(APPLICATION_COMMAND)를 받아 `data.name`으로 `COMMANDS`의 핸들러에 넘긴다. 모르는 커맨드는 ephemeral 안내로 답한다. 커맨드는 `commands/`에 하나씩 둔다.
- 서명 검증은 ADR 0011 그대로다. 커맨드가 늘어도 관문은 하나다.
- 3초 안에 끝나는 검사(서버 확인, GitHub 아이디 형식, 멤버 조회)는 바로 ephemeral로 답한다. 외부 API를 부르는 일은 deferred 응답(type 5, flags 64)을 먼저 보내고 `EdgeRuntime.waitUntil`로 이어서 한 뒤, 후속 메시지(`PATCH .../messages/@original`)로 결과를 알린다. deferred에 flags를 줘야 후속 메시지도 본인에게만 보인다.
- 정의(`commands/definitions.ts`)는 순수 데이터라 등록 스크립트(`scripts/discord-register-commands.ts`)가 함수 의존성 없이 import한다. 스크립트는 길드 커맨드를 bulk overwrite로 등록한다. 다시 돌려도 안전하고 정의에서 빠진 커맨드는 지워진다. **커맨드를 추가하거나 바꾸면 이 스크립트를 다시 돌린다.**
- **interaction token은 비밀로 다룬다.** 15분 동안 그 메시지를 고칠 수 있는 열쇠라서 후속 메시지 URL에만 쓰고 로그·DB·응답에 남기지 않는다. GitHub 토큰·봇 토큰·응답 본문·예외 메시지도 같다. 코드(`user_not_found`, `http_403` …)만 남긴다.

### GitHub 인증은 fine-grained PAT

- 저장소 `Jiwook00/checkin` 하나만, Repository permissions → Administration: Read and write (Metadata read는 자동). 만료 90일. 시크릿 `GITHUB_INVITE_TOKEN`.
- 콜라보레이터 초대 API가 요구하는 권한이 Administration이라 범위를 더 줄일 수 없다. 대신 저장소를 하나로 한정하고 만료를 둔다.

### 디스코드를 연결한 멤버 누구나 쓴다

- `checkin_members.discord_user_id`로 누른 사람을 찾고(ADR 0012), 연결되지 않았으면 안내하고 끝낸다.
- 초대돼도 main은 승인 없이 들어가지 못한다. 실제 관문은 main 보호 규칙이다. 관리자 전용으로 하면 이 커맨드를 만든 이유(메인테이너가 손으로 하는 일 줄이기)가 없어진다.
- 누가 어떤 GitHub 아이디를 초대했는지는 기록에 남는다.

### 멱등성: 상태를 먼저 확인하고 필요할 때만 쓴다

1. `GET .../collaborators/{login}` — 204면 이미 콜라보레이터(끝). 404면 다음.
2. `GET .../invitations` — 같은 아이디(대소문자 무시)가 있으면 이미 초대 중(끝).
3. `PUT .../collaborators/{login}` — 201 초대함, 204 이미 콜라보레이터, 404 계정 없음, 422 초대할 수 없는 계정(저장소 오너 본인 등).

첫 GET의 404는 "콜라보레이터 아님"과 "계정 없음"이 같아서, 계정 존재 여부는 PUT의 404로 판정한다. PUT만 부르면 이미 있는 콜라보레이터의 권한을 건드리거나 초대를 다시 보낼 수 있어서 먼저 확인한다.

역할은 interaction이 실어 주는 `member.roles`로 이미 있는지 판단해 API를 부르지 않는다. 없으면 `PUT /guilds/{guild}/members/{user}/roles/{role}`로 준다. GitHub와 역할은 서로 상관없이 따로 시도해서 하나가 실패해도 나머지는 진행한다.

### 기록: 새 테이블 `checkin_contributor_grants`

- 실행 1회 = 1행. 누가(`member_id`), 어떤 GitHub 아이디로, GitHub 결과·역할 결과와 에러 코드. 관리자만 읽고 쓰기는 service role 전용이다.
- 디스코드 id, interaction id·token, 토큰은 저장하지 않는다.
- 기록 insert가 실패해도 사용자 응답은 보낸다. 기록 실패로 사용자 결과를 바꾸지 않는다.

### 시크릿과 봇 권한

| 이름                        | 용도                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `GITHUB_INVITE_TOKEN`       | fine-grained PAT                                             |
| `DISCORD_GUILD_ID`          | 커맨드를 받을 서버. DM에서 부르면 거절, 등록 스크립트도 사용 |
| `DISCORD_DEVELOPER_ROLE_ID` | 줄 역할                                                      |
| `DISCORD_BOT_TOKEN`         | 기존. 이제 `discord-interactions`에도 필요                   |
| `DISCORD_APPLICATION_ID`    | 등록 스크립트만 (로컬 env). 함수는 interaction 값을 쓴다     |

봇 권한에 Manage Roles를 더한다(ADR 0011 표 갱신, 권한 값 `17592455529472`). 서버 설정 → 역할에서 봇 역할을 `개발자`보다 위로 올려야 한다. Discord는 봇 역할보다 아래 역할만 줄 수 있다.

## 대안

- **GitHub App.** 권한 범위와 토큰 수명이 더 좋지만 설치·토큰 교환·키 관리가 필요하다. 멤버 8명 규모에 과하다. PAT로 시작하고 불편하면 옮긴다.
- **`checkin_discord_deliveries` 재사용.** 그 테이블은 "같은 알림은 한 번만"을 위한 `unique (event_type, ref_id)`가 핵심인데, 여기서는 실행마다 한 행이 쌓여야 하고 멤버·GitHub 아이디·두 결과를 구조로 남겨야 한다.
- **관리자 전용 커맨드.** 안전하지만 메인테이너가 병목인 채로 남는다.
- **PUT만 호출.** 호출 한 번이라 단순하지만 초대 중복·권한 변경 가능성이 있고 "이미 초대 중"을 안내할 수 없다.

## 알려진 한계

- 연결된 멤버는 다른 사람의 GitHub 아이디도 초대할 수 있다. 기록으로 추적하고 모임 규모상 허용한다.
- PAT가 90일 뒤 만료되면 401(`token_invalid`)이 나고 안내 문구로 드러난다. 갱신은 메인테이너가 손으로 한다.
- 개인 저장소라 `permission` 값은 무시되고 콜라보레이터는 쓰기 권한을 받는다. main 보호 규칙이 실제 관문이다.
- GitHub 초대 레이트리밋(24시간 50건)은 이 규모에서 문제 없다.
- `invitations` 목록은 한 페이지(100건)만 본다. 그 이상 쌓일 일은 없다고 본다.
- interaction 재전송은 막지 않는다(ADR 0011). 멱등성 확인이 중복 초대를 막고, 기록에는 행이 더 쌓일 수 있다.
