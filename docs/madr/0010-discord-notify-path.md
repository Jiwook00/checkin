# 0010 - 디스코드 알림은 DB → Edge Function 한 경로로 보낸다

- 상태: 승인됨
- 날짜: 2026-11-05
- 관련 이슈: #98 (에픽 #107), 후속 #99·#100
- 관련 커밋: e335aa2, 65f1184

## 컨텍스트

모임을 디스코드로 옮기면서 웹앱의 일(회고 업로드 #99, 투표 오픈·마감 임박·일정 확정 #100)을 채널에 알린다. 알림의 계기는 모두 DB에서 생긴다(회고 insert, poll 상태 변경, 마감 전 `pg_cron`). 웹훅 URL은 채널에 글을 쓸 수 있는 열쇠라서 코드, 마이그레이션, 로그, 프론트 어디에도 남기면 안 된다.

정할 것은 셋이다.

1. 알림을 어디서 보내는가
2. 웹훅 URL과 호출 인증을 어디에 두는가
3. 같은 알림이 두 번 나가는 것을 어떻게 막는가

## 결정

### 경로: DB → `pg_net` → Edge Function `discord-notify` → 웹훅

- DB 함수 `checkin_notify_discord(payload)`가 `pg_net`으로 `discord-notify`를 비동기 호출한다. 트리거와 `pg_cron`이 이 함수를 부른다.
- 메시지 형식(embed)은 TypeScript(`_shared/discord/`)에서 만든다. SQL에서 JSON을 조립하지 않는다.
- 요청은 완성된 메시지가 아니라 **이벤트**(`{ type, ref_id?, ... }`)다. 어느 채널에 어떤 형식으로 보낼지는 함수가 `type`으로 정한다. 타입은 후속 이슈가 하나씩 더한다.
- DB 함수는 Vault 값이 없거나 호출이 실패해도 경고만 남기고 `null`을 돌려준다. 트리거에서 불렀을 때 원래 트랜잭션(회고 저장)을 깨지 않는다.

### 웹훅 URL과 인증

| 값                                                    | 위치                                       |
| ----------------------------------------------------- | ------------------------------------------ |
| 웹훅 URL (`DISCORD_WEBHOOK_ANNOUNCE`, `..._RETRO`)    | Edge Function 시크릿에만                   |
| 호출 비밀 (`DISCORD_NOTIFY_SECRET`)                   | Edge Function 시크릿 + Vault `discord_notify_secret` |
| 함수 URL                                              | Vault `discord_notify_url`                 |

- 함수는 다른 함수와 같이 `verify_jwt = false`이고, `x-notify-secret` 헤더가 유일한 관문이다. 비밀이 설정돼 있지 않으면 모든 요청을 거절한다. 비교는 양쪽을 SHA-256으로 같은 길이로 만든 뒤 XOR로 한다.
- service role 키를 DB에 두지 않으려고 JWT 대신 공유 비밀을 쓴다.
- `checkin_notify_discord`는 `anon`·`authenticated`가 실행할 수 없다.
- Deno `fetch` 실패 메시지에는 요청 URL이 들어간다. 예외 메시지는 저장·응답·로그에 쓰지 않고 `error`에는 `network_error`, `http_<status>` 같은 코드만 남긴다.
- 모든 요청에 `allowed_mentions: { parse: [] }`를 붙여, 회고 제목에 `@everyone`이 있어도 울리지 않는다.

### 중복 방지: 발송 기록 테이블

- `checkin_discord_deliveries`의 `unique (event_type, ref_id)`가 "같은 알림은 한 번만"을 보장한다.
- 함수는 보내기 **전에** `pending` 행을 먼저 insert해서 자리를 잡고, 끝나면 `sent`/`failed`로 바꾼다. 동시에 들어온 요청 둘 중 하나만 보낸다.
- `ref_id`가 null이면(test) Postgres가 중복을 허용하므로 매번 보낸다.
- `failed`는 자동 재시도하지 않는다. 사람이 행을 보고 판단한다.

## 대안

- **`pg_net`이 Discord를 직접 호출한다.** 함수가 하나 줄지만 웹훅 URL이 Vault로 들어가고 embed 형식을 SQL로 만들어야 한다. 타입이 늘수록 SQL이 커진다.
- **프론트가 호출한다.** 브라우저를 닫거나 네트워크가 끊기면 알림이 가지 않고, 호출 비밀이 브라우저에 노출된다. `pg_cron` 공지는 어차피 프론트가 못 한다.

## 알려진 한계

- `pending`에서 함수가 죽으면 그 행이 남아 같은 알림이 다시 나가지 않는다. 지금은 사람이 행을 지운다.
- 발송 실패는 SQL로만 본다. 관리자 화면에서 보여 주는 것은 필요해지면 #99·#100에서 한다.
- 웹훅은 단방향이다. DM, 서버 이벤트, 슬래시 커맨드는 봇(#101~)이 맡는다.
