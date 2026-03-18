# 일정 투표 시스템 플로우

checkin 앱의 일정 탭(`VotePage`) 전체 흐름을 정리한 문서.

---

## 1. Poll 상태 다이어그램

Poll(`checkin_vote_polls`)이 어떤 상태를 가지고, 언제 전이하는지.

```mermaid
stateDiagram-v2
    [*] --> open : 관리자가 투표 생성<br>(기존 open/confirmed poll은 자동으로 closed 전환)

    open --> confirmed : 관리자가 마감하기<br>→ 날짜·시간 선택 → 확정
    open --> closed : 관리자가 삭제 (poll + 응답 모두 삭제)

    confirmed --> closed : 다음 투표 생성 시 자동 전환
    confirmed --> closed : 관리자가 삭제

    closed --> [*]

    note right of open
        멤버가 투표 가능
        관리자: 수정·삭제·현황보기·마감하기
    end note

    note right of confirmed
        투표 종료, 날짜 확정 표시
        관리자: 새 투표 생성 가능
    end note
```

> **`getActivePoll()` 우선순위**: open poll → (없으면) 가장 최근 confirmed poll.
> closed poll은 목록에 노출되지 않는다.

---

## 2. 전체 사용자 플로우 (관리자 / 멤버)

관리자와 일반 멤버의 행동 흐름을 swimlane으로 분리.

```mermaid
flowchart TD
    START([앱 진입 — 일정 탭])
    START --> CHECK_POLL{활성 poll 있음?}

    %% ── poll 없음 (EmptyState) ──────────────────────────────
    CHECK_POLL -- "없음" --> EMPTY[빈 화면<br>'일정 투표를 시작해보세요']
    EMPTY --> IS_ADMIN_1{관리자?}
    IS_ADMIN_1 -- "아니오" --> WAIT_FOR_ADMIN[관리자가 투표를<br>생성할 때까지 대기]
    IS_ADMIN_1 -- "예" --> CREATE_FLOW

    %% ── 투표 생성 플로우 (관리자 전용) ────────────────────────
    subgraph CREATE_FLOW[투표 생성 플로우]
        direction TB
        C1[온라인 / 오프라인 선택<br>PresetSelect]
        C2[날짜 범위 · 시간 설정<br>PollForm]
        C3[createPoll 호출<br>기존 open·confirmed → closed 자동 전환]
        C1 --> C2 --> C3
    end
    C3 --> POLL_OPEN

    %% ── open poll 화면 ─────────────────────────────────────
    CHECK_POLL -- "open" --> POLL_OPEN[투표 화면 표시<br>status = open]

    POLL_OPEN --> IS_ADMIN_2{관리자?}

    %% 멤버 흐름
    IS_ADMIN_2 -- "아니오" --> MEMBER_VOTE

    subgraph MEMBER_VOTE[멤버 투표]
        direction TB
        M1{참석 불가?}
        M2[날짜 선택<br>캘린더 클릭]
        M3{주말 날짜?}
        M4[시간대 선택<br>time_start ~ time_end]
        M5[평일은 시간 고정<br>time_weekday]
        M6{poll type = online?}
        M7[평일도 선택 가능]
        M8[주말만 선택 가능]
        M9[저장 버튼 활성화<br>모든 주말 날짜에 시간 선택 완료 시]
        M10[upsertVoteResponse 호출<br>DB에 selected_dates 저장]

        M1 -- "예" --> M10
        M1 -- "아니오" --> M6
        M6 -- "online" --> M7
        M6 -- "offline" --> M8
        M7 & M8 --> M2
        M2 --> M3
        M3 -- "주말" --> M4 --> M9
        M3 -- "평일" --> M5 --> M9
        M9 --> M10
    end

    %% 관리자 흐름
    IS_ADMIN_2 -- "예" --> ADMIN_ACTIONS

    subgraph ADMIN_ACTIONS[관리자 액션]
        direction TB
        A1[투표에 직접 참여 가능<br>멤버와 동일한 투표 UI]
        A2{선택한 액션}
        A3[수정<br>updatePollMeta / updatePollSchedule]
        A4[삭제<br>deletePoll → poll + responses 전부 삭제]
        A5[현황 보기 → 마감하기]

        A1 --> A2
        A2 --> A3
        A2 --> A4
        A2 --> A5
    end

    A4 --> EMPTY
    A3 --> POLL_OPEN

    %% 마감하기 플로우 (관리자 전용)
    A5 --> TALLY_POPUP

    subgraph TALLY_POPUP[득표 현황 팝업]
        direction TB
        T1[computeVoteTally 결과 표시<br>득표 수 내림차순 정렬]
        T2[날짜·시간 항목 클릭 → 선택]
        T3{항목 선택됨?}
        T4[마감 확정 버튼 활성화]

        T1 --> T2 --> T3
        T3 -- "예" --> T4
        T3 -- "아니오" --> T2
    end

    T4 --> CONFIRM_CALL[confirmPoll 호출<br>status = confirmed<br>confirmed_date · confirmed_time 저장]
    CONFIRM_CALL --> POLL_CONFIRMED

    %% ── confirmed poll 화면 ─────────────────────────────────
    CHECK_POLL -- "confirmed" --> POLL_CONFIRMED[확정 화면 표시<br>날짜 · 시간 · 장소 배지]

    POLL_CONFIRMED --> IS_ADMIN_3{관리자?}
    IS_ADMIN_3 -- "예" --> NEW_POLL_BTN[다음 회차 투표 생성 버튼]
    NEW_POLL_BTN --> CREATE_FLOW
    IS_ADMIN_3 -- "아니오" --> VIEW_CONFIRMED[확정된 날짜 확인]
```

---

## 3. Poll 타입별 투표 규칙

|                | offline                                    | online                            |
| -------------- | ------------------------------------------ | --------------------------------- |
| 선택 가능 날짜 | **주말만**                                 | 모든 날짜                         |
| 평일 시간      | 해당 없음                                  | `time_weekday`로 고정 (선택 불가) |
| 주말 시간      | `time_start`~`time_end` 범위에서 복수 선택 | 동일                              |

---

## 4. 집계 로직 두 종류

VotePage에는 목적이 다른 두 가지 집계가 존재한다. 혼동 주의.

```mermaid
flowchart LR
    DATA[(checkin_vote_responses)]

    DATA --> CAL[buildCalendarVotes<br>캘린더 셀 색상·인원 표시]
    DATA --> TALLY[computeVoteTally<br>득표 현황 팝업]

    CAL --> CAL_OUT["날짜 → 응답자 수<br>예: {4: 5, 5: 3}"]
    TALLY --> TALLY_OUT["TallyItem[]<br>주말: 날짜×시간 단위<br>평일: 날짜 단위<br>득표 수 내림차순 정렬"]
```

> **왜 숫자가 다른가?**
> 캘린더의 "4일 5명"은 "4일을 하루라도 선택한 사람" 수.
> 득표 현황의 "4일 20:00 4명"은 "4일 20시를 선택한 사람" 수.
> 동일 날짜라도 시간대마다 선택자가 다르므로 두 값이 다른 것은 정상 동작.

---

## 5. 데이터 흐름 (컴포넌트)

```mermaid
flowchart TD
    APP[App.tsx]
    VP[VotePage.tsx]
    DB[(Supabase DB)]

    APP -- "getActivePoll()<br>open 우선, 없으면 최근 confirmed" --> DB
    DB -- "VotePoll | null" --> APP
    APP -- "poll props로 전달" --> VP

    VP -- "getVoteResponses(pollId)" --> DB
    VP -- "getTotalMemberCount()" --> DB
    DB -- "VoteResponse[]" --> VP
    DB -- "count" --> VP

    VP -- "upsertVoteResponse()" --> DB
    VP -- "confirmPoll() / createPoll()<br>/ deletePoll() / updatePoll*()" --> DB
    DB -- "최신 VotePoll" --> VP
    VP -- "onPollChange(poll)" --> APP
```

> `App.tsx`는 `activePoll`만 fetch. `responses`와 `totalMembers`는 VotePage 내부에서 직접 fetch.
> Poll을 변경하는 모든 작업(생성·확정·삭제·수정) 후에는 `onPollChange()`로 App 상태를 동기화한다.
