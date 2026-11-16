# 0013 - 확정한 일정의 디스코드 서버 이벤트는 DB 트리거가 동기화한다

- 상태: 승인됨
- 날짜: 2026-11-16
- 관련 이슈: #103 (에픽 #107)
- 관련 ADR: 0010(알림 경로), 0011(봇)

## 컨텍스트

일정을 확정하면 디스코드에 Scheduled Event를 만들어서 멤버가 "관심 있음"을 누르고 디스코드에서 시작 알림을 받게 하고 싶다. 이벤트는 poll 하나에 하나이고, 일정이 바뀌면 고치고, poll이 닫히거나 지워지면 지워야 한다. 디스코드 호출이 실패해도 확정은 성공해야 하고, 실패는 관리자가 알아야 한다.

코드에서 확인한 상태 전이는 다음과 같다.

- 확정: `confirmPoll`이 `status = confirmed`와 `confirmed_date`·`confirmed_time`을 저장한다
- 일정 변경: 확정 뒤 날짜·시간을 바꾸는 UI는 없다. SQL로만 바뀐다. 오프라인 `location`은 수정 모달에서 바뀐다
- 닫힘: `createPoll`이 기존 open/confirmed를 클라이언트에서 `closed`로 바꾼다
- 삭제: `deletePoll`이 행을 지운다. 다만 지금은 DELETE RLS 정책이 없어 실제로는 0행이다 (별도 이슈)
- 투표 생성·확정·수정은 멤버 누구나 할 수 있다 (`authenticated update polls`가 `USING (true)`)

## 결정

### 호출 경로: DB 트리거 → `discord-notify`

|             | 프론트 → 관리자 Edge Function                                | DB 트리거 → `discord-notify` (채택)                          |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 놓치는 변경 | `createPoll`의 closed 전환, SQL 수정, 확정 뒤 탭을 닫은 경우 | 없다. 행이 바뀌면 트리거가 돈다                              |
| 권한        | 확정한 사람이 관리자가 아니면 관리자 확인에서 거절된다       | 상관없다                                                     |
| 실패 표시   | 응답으로 바로 보인다                                         | 비동기라 결과를 poll에 저장하고 화면이 다시 읽는다           |
| 구성        | 새 함수·새 인증 경로                                         | ADR 0010의 `checkin_notify_discord()`·Vault·비밀 헤더 재사용 |

실패를 바로 보여 주는 장점보다, 상태 전이를 하나도 놓치지 않는 것이 이 기능의 핵심이라 트리거를 고른다.

### 함수는 "보내기"가 아니라 "맞추기"를 한다

`poll_event_sync`(ref_id = poll id)는 매번 최신 poll을 읽고 있어야 할 상태로 맞춘다.

- `confirmed`이고 시작이 미래 → 이벤트가 없으면 POST, 있으면 PATCH. PATCH가 Unknown Event(10070)면 새로 만든다
- 그 밖 → 이벤트가 있으면 DELETE. 이미 없으면 성공으로 본다
- 시작이 지났으면 건드리지 않는다 (디스코드가 과거 시작 시각을 받지 않는다)

pg_net 호출은 순서가 보장되지 않지만, 각 호출이 최신 상태를 읽으므로 마지막 호출이 맞춘다. 동시에 두 호출이 만들면 `discord_event_id IS NULL` 조건으로 먼저 저장한 쪽만 남고 진 쪽은 방금 만든 이벤트를 지운다. 만드는 사이 닫혔으면 만든 쪽이 다시 읽어 지운다.

poll 행이 지워지면 함수가 읽을 행이 없으므로 트리거가 `OLD.discord_event_id`를 실어 `poll_event_delete`를 보낸다.

트리거는 다음에 반응한다.

- poll UPDATE: `status`·`confirmed_date`·`confirmed_time`·`location`·`type`이 바뀌고, 확정과 관련 있을 때 (지금 confirmed, 방금까지 confirmed, 또는 이벤트가 있음)
- poll DELETE: 이벤트가 있을 때
- 회고 INSERT·DELETE: 그 회차 모임의 confirmed poll이 있을 때 (설명의 발표 순서 갱신)

### 상태는 poll에 두고 앱 롤은 못 바꾼다

`checkin_vote_polls`에 `discord_event_id`·`discord_event_error`·`discord_event_synced_at`을 둔다. `checkin_discord_deliveries`는 쓰지 않는다. 그 테이블의 `unique(event_type, ref_id)`는 "같은 알림은 한 번만"이라는 뜻인데, 동기화는 같은 poll에 여러 번 돈다.

UPDATE 정책이 열려 있어서 멤버가 클라이언트에서 `discord_event_id`를 바꾸면 봇이 다른 이벤트를 고치거나 지울 수 있다. `is_admin`과 같은 방식으로 `authenticated`·`anon`이 세 컬럼을 바꾸면 트리거가 막는다.

### 실패는 관리자에게만 확정 화면에서 보인다

확정 화면에 관리자 전용 한 줄을 둔다. 연결됨 / 실패(이유) / 없음과, 실패·없음이면 "다시 시도"가 있다. 다시 시도는 RPC `checkin_sync_discord_event(poll_id)`(SECURITY DEFINER, `is_checkin_admin()` 확인)가 같은 `poll_event_sync`를 큐에 넣는다. 화면은 `discord_event_synced_at`이 바뀔 때까지 잠깐 다시 읽는다. 이 기능 전에 확정한 poll도 이 버튼으로 이벤트를 만든다.

### 이벤트 내용

- 온라인: 음성 채널 이벤트(`entity_type 2`, `DISCORD_EVENT_VOICE_CHANNEL_ID`)
- 오프라인: 외부 이벤트(`entity_type 3`, `location`이 없으면 "장소 미정")
- 시작: `confirmed_date` + `confirmed_time`(없으면 `time_weekday`, `time_start`)을 `+09:00`으로. KST는 서머타임이 없다
- 종료: 시작 + 2시간. 외부 이벤트는 필수다. `time_end`는 투표 시간표의 끝이라 쓰지 않는다
- 이름 `{회고월}월 회고`, 설명은 웹앱 링크와 발표 순서. 회의 링크·비밀번호는 넣지 않는다
- 서버 id·음성 채널 id는 함수 시크릿 `DISCORD_GUILD_ID`·`DISCORD_EVENT_VOICE_CHANNEL_ID`. 비밀은 아니지만 웹훅과 같은 자리에 두고 재배포 없이 바꾼다

기존 `vote_confirmed` 웹훅 공지(#100)는 그대로 둔다. 공지는 채널 메시지, 이벤트는 이벤트 탭의 참여 표시와 시작 알림이라 겹치지 않는다.

## 결과

- 상태 전이가 어디서 일어나든(앱, SQL 편집기) 이벤트가 따라온다
- 확정 직후 화면은 결과를 몇 초 늦게 본다
- 디스코드 쪽에서 사람이 이벤트를 고친 내용은 다음 동기화 때 웹앱 기준으로 덮인다
- 음성 이벤트가 시작 시각에 저절로 시작되는지(시작 알림이 나가는지)는 실제 서버에서 확인한다. 안 되면 시작 시각에 상태를 바꾸는 작업을 따로 둔다
