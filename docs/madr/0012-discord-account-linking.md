# 0012 - 멤버의 디스코드 id는 관리자가 SQL 편집기로 넣는다

- 상태: 승인됨
- 날짜: 2026-11-15
- 관련 이슈: #102 (에픽 #107), 후속 #104·#105·#106
- 관련 커밋: 714ba13

## 컨텍스트

봇(ADR 0011)이 DM을 보내려면 받는 멤버의 디스코드 id를 알아야 한다(#104 리마인더, #105 댓글 알림). 슬래시 커맨드(#106)를 쓴 사람이 어느 멤버인지 알려면 반대 방향의 매핑이 필요하다. 지금 `checkin_members`는 Google 로그인 계정에만 묶여 있다.

봇이 서버 멤버 목록을 읽어서 짝지을 수도 없다. 멤버 목록 API에는 Server Members Intent가 필요한데 ADR 0011에서 privileged intent를 모두 껐다. 켜더라도 디스코드 계정과 체크인 멤버를 잇는 정보가 없다.

정할 것은 셋이다.

1. 연결을 누가 어떻게 하는가
2. 디스코드 id를 어디에 두는가
3. 누가 그 값을 바꿀 수 있는가

## 결정

### 관리자가 SQL 편집기에서 넣는다

멤버는 6명이고 모두 우리 서버에 있다. 관리자가 서버 멤버 목록에서 id를 복사해 넣는다. 앱에는 연결 화면도 Edge Function도 없다.

1. 디스코드 사용자 설정 → 고급 → 개발자 모드를 켠다
2. 서버에서 멤버를 우클릭 → 사용자 ID 복사
3. Supabase SQL 편집기에서 넣는다

```sql
update checkin_members set discord_user_id = '<디스코드 사용자 id>' where nickname = '<닉네임>';
-- 해제
update checkin_members set discord_user_id = null where nickname = '<닉네임>';
```

멤버가 할 일은 없다. 다만 DM을 받으려면 서버의 DM 허용 설정(서버 이름 → 개인정보 보호 설정 → 다이렉트 메시지)이 켜져 있어야 한다. 기본값은 켜짐이다. 꺼져 있으면 DM이 Discord 오류 50007로 실패하니, #104·#105는 실패를 기록하고 넘어간다.

### 앱 컬럼 `checkin_members.discord_user_id`

- `TEXT`, nullable, `UNIQUE`, `CHECK (~ '^[0-9]{17,20}$')`.
- 한 디스코드 계정은 한 멤버에만 연결된다. UNIQUE가 만드는 인덱스로 #106이 디스코드 id로 멤버를 바로 찾는다.
- 형식 CHECK는 SQL 편집기에서 붙여 넣다가 생기는 오타를 거른다.
- 연결되지 않은 멤버는 `NULL`이다. #104는 메일로 대신 보내고, #105는 건너뛴다.
- 읽는 쪽(#104·#105·#106)은 모두 Edge Function의 service role이다.

### 앱 롤은 본인 row라도 바꾸지 못한다

`checkin_members`의 "Allow own update"에는 `USING`만 있고 `WITH CHECK`가 없다. 컬럼만 추가하면 멤버가 자기 row에 다른 사람의 디스코드 id를 넣을 수 있다. 그러면 그 사람에게 갈 DM을 가로채고, 커맨드에서 그 사람으로 보인다.

그래서 트리거 `checkin_members_guard_discord`가 `authenticated`·`anon` 롤이 이 값을 넣거나 바꾸는 것을 `42501`로 막는다. `is_admin` 트리거(ADR 0007, `20261030000000`)와 같은 패턴이다. service role과 SQL 편집기(`postgres`)는 막지 않는다.

이슈의 "본인과 관리자만 바꿀 수 있다"보다 강하다. 셀프 연결·해제를 쓸 화면이 없으니 열어 둘 이유가 없다. "DM을 그만 받고 싶다"는 #105의 알림 끄기로 푼다.

## 대안

- **Supabase Auth `linkIdentity`로 Discord provider 연결.** 소유 증명과 state 처리를 Supabase가 맡는다. 하지만 provider를 켜면 링크만이 아니라 Discord 로그인도 열린다. 같은 검증된 이메일은 자동으로 링크되고, manual linking은 프로젝트 전체 설정이다. id가 `auth.identities`에 있어 앱 컬럼으로 옮기는 동기화가 따로 필요하다. 링크 하나 때문에 로그인 경로를 넓히는 것은 과하다.
- **Edge Function으로 직접 하는 Discord OAuth `identify`.** 로그인 경로를 건드리지 않으면서 셀프서비스와 소유 증명이 된다. 대신 client secret 시크릿, prod·로컬 redirect URI, state 비교, code 교환 함수가 필요하고, 멤버가 한 명씩 직접 눌러야 한다. 6명 고정 멤버에게는 관리자 입력보다 모두에게 무겁다.
- **슬래시 커맨드 `/연결 <코드>`.** 웹에서 일회용 코드를 받고 디스코드에서 입력하면, 서명된 interaction의 user id를 쓴다. secret도 redirect URI도 필요 없다. 하지만 커맨드 등록(#106)을 앞당겨야 하고 코드 저장소가 필요하다.

멤버가 자주 바뀌거나 관리자 손을 거치지 않게 하고 싶어지면 OAuth `identify`나 슬래시 커맨드로 옮긴다. 컬럼과 트리거는 그대로 쓰고, 쓰는 쪽(service role)만 늘어난다.

## 알려진 한계

- 본인 소유를 증명하지 않는다. 관리자가 실제 서버 멤버 목록에서 복사하니 위험은 작다. 남는 위험은 사람을 잘못 짚는 실수다.
- 멤버가 디스코드 계정을 바꾸거나 새 멤버가 오면 관리자가 직접 갱신해야 한다.
- 원격 DB의 SELECT 정책은 `Allow authenticated read (USING true)`라서 로그인한 멤버끼리 서로의 `discord_user_id`가 보인다. 디스코드 id는 같은 서버에서 누구나 복사할 수 있는 값이라 허용한다.
