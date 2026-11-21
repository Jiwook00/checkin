# AGENTS.md

This file provides guidance to Codex when working with this repository.

## Commands

```bash
npm run dev       # Start development server (Vite) — .env의 운영 Supabase에 붙는다
npm run dev:local # 로컬 Supabase(`supabase start`)에 붙는 개발 서버. 로그인 화면에 시드 계정 버튼이 뜬다
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

No test framework is configured. Do not run or reference `npm test`.

For Supabase Edge Functions (Deno runtime in `supabase/functions/`):

```bash
supabase functions serve parse-content  # Local function dev
supabase functions deploy parse-content # Deploy
```

## Architecture

**Frontend** (`src/`)

- `src/App.tsx` — Root component, routing setup
- `src/components/` — React components (PascalCase filenames)
- `src/lib/supabase.ts` — Supabase client singleton
- `src/types/index.ts` — Shared TypeScript types

**Backend** (`supabase/`)

- `supabase/functions/parse-content/` — Edge Function (Deno) for parsing Notion/blog URLs into markdown
- `supabase/functions/generate-reminders/`, `suggest-questions/` — 관리자 전용 리마인더 초안 생성·공통 질문 제안 (ADR 0007)
- `supabase/functions/discord-notify/` — DB 이벤트를 디스코드 채널로 보낸다 (ADR 0010). 웹훅 URL은 함수 시크릿에만 있고, DB는 `checkin_notify_discord()`로 부른다. 확정한 일정의 서버 이벤트도 여기서 동기화한다 (ADR 0013, `event.ts`)
- `supabase/functions/discord-interactions/` — 디스코드 봇 HTTP Interactions 진입점 (ADR 0011). JWT 검증 없이 Ed25519 서명이 유일한 관문이라 `--no-verify-jwt`로 배포한다. 슬래시 커맨드(type 2)는 `data.name`으로 `commands/`의 핸들러에 분기한다 (`/기여`, ADR 0015). 커맨드를 추가·변경하면 `scripts/discord-register-commands.ts`를 다시 돌려 길드에 등록한다
- `supabase/functions/_shared/reminder/` — 리마인더 생성 코어. 평가 하네스(`scripts/eval/`)와 Edge Function이 함께 import한다. 프롬프트·요청 객체를 바꾸면 하네스 호출 캐시와 평가 기준선이 끊긴다
- `supabase/migrations/` — SQL migration files

**Database** (Supabase)

- 모든 테이블은 `checkin_` 프리픽스를 사용 (예: `checkin_retrospectives`, `checkin_members`)
- `checkin_members` — 앱 유저 프로필, `auth.users`와 1:1 대응, 첫 로그인 시 upsert
- `checkin_allowed_members` — 접근 제어용 이메일 화이트리스트

**Auth**

- Supabase Google OAuth 사용
- 로그인 흐름: Google OAuth → `checkin_allowed_members` 화이트리스트 확인 → `checkin_members` upsert
- 유저 관리는 `auth.users`가 아닌 `checkin_members`에서 수행
- 관리자: `checkin_members.is_admin` + SQL 함수 `is_checkin_admin()`. 앱·RLS·Edge Function이 같은 값을 본다. 앱에서 `is_admin`을 바꾸는 것은 트리거가 막는다 (`/admin/reminders`)

**Deployment**: Frontend → Vercel, Backend → Supabase

## Design System

UI 작업 시 [`DESIGN.md`](DESIGN.md)를 참고한다. 컬러 토큰, 타이포그래피 스케일, 스페이싱, 반경, 컴포넌트 상태가 정의되어 있다.

- 컬러는 반드시 토큰 이름(`--primary`, `--ink`, `--surface-card` 등)으로 사용 — 하드코딩 금지
- 실물 프리뷰는 [`design-preview.html`](design-preview.html)에서 확인

## Code Style

- **Prettier**: double quotes, semicolons required (see [.prettierrc](.prettierrc))
- **TypeScript**: strict mode enabled
- **Tailwind CSS v4** for styling — use utility classes, avoid inline styles
- Component files: PascalCase (`ArticleCard.tsx`)
- Utility/lib files: camelCase or kebab-case (`url-utils.ts`)

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: 새로운 기능
fix: 버그 수정
chore: 빌드, 설정, 패키지 변경
docs: 문서 수정
refactor: 리팩토링
```

Breaking changes use `!` suffix (e.g., `feat!: ...`). Versioning is managed by `release-please` — do not manually edit `CHANGELOG.md` or bump version in `package.json`.

## Codex 스킬

`.agents/skills/`의 스킬은 아래 이름으로 호출한다.

| 호출 | 용도 |
| --- | --- |
| `$source-command-issue-start <번호>` | GitHub 이슈를 확인하고 작업 브랜치를 생성한다. |
| `$source-command-issue-new` | 현재 작업 내용을 바탕으로 GitHub 이슈를 만든다. |
| `$source-command-checkpoint-init` | 이슈별 작업 계획과 진행 파일을 만든다. |
| `$source-command-checkpoint-update` | 최근 커밋을 이슈 진행 파일에 기록한다. |
| `$source-command-commit` | 변경을 검토하고 이슈를 참조하는 커밋을 만든다. |
| `$source-command-pr-new` | 현재 브랜치의 변경으로 풀 리퀘스트를 만든다. |
| `$source-command-design-preview` | UI 변경 전에 /dev/* 경로에 디자인 시안을 만든다. |
| `$galpi-reminder` | 회고 리마인더 톤과 체크리스트 확인 |

## Data Flow

**새 컴포넌트를 만들기 전에 반드시 `App.tsx`를 먼저 확인하라.**

- `App.tsx`는 전역 데이터의 유일한 fetch 지점 — `activePoll`, `authState`, `articles` 등
- 이미 App에서 fetch한 데이터는 **props로 전달**받는다. 컴포넌트 안에서 중복 fetch 금지
- 컴포넌트 내부 fetch는 그 컴포넌트 route에서만 필요한 데이터(예: 해당 페이지의 responses)에 한정

**상태(state) 설계 원칙**

- 파생 가능한 값은 state로 만들지 말고 렌더 타임에 계산 (`useMemo` 또는 인라인)
- 하나의 사용자 액션이 여러 `setState`를 동시에 호출해야 한다면 `useReducer` 고려
- 공유 타입/상수는 `src/types/index.ts` 또는 해당 lib 파일에 단일 정의 — 컴포넌트 파일 내 중복 선언 금지

## 일정 투표 시스템 (VotePage)

**관련 파일**: `src/components/VotePage.tsx`, `src/lib/vote.ts`, `src/types/index.ts`
**전체 플로우 다이어그램**: [`docs/vote-flow.md`](docs/vote-flow.md)

### selected_dates 구조 — 주의

`VoteResponse.selected_dates: { date: number, hours: number[] }[]`

- `date`: 일(day) 숫자. 월 정보 없음 — poll의 `year`/`month`로 맥락 파악
- `hours`: 선택한 시(hour) 배열. 평일은 고정 1개, 주말은 복수 가능

### 집계 로직 두 종류 — 혼동 주의

|            | `buildCalendarVotes`     | `computeVoteTally`                   |
| ---------- | ------------------------ | ------------------------------------ |
| 용도       | 캘린더 셀 색상/인원 표시 | 득표 현황 팝업                       |
| 단위       | **날짜별**               | **주말: 날짜×시간별** / 평일: 날짜별 |
| count 의미 | 그 날짜를 선택한 인원 수 | 그 날짜+시간대를 선택한 인원 수      |

→ 캘린더의 "4일 5명"과 현황 팝업의 "4일 20:00 4명"이 다른 것은 정상.

### 데이터 흐름

- `App.tsx`가 `activePoll` fetch → props로 VotePage에 전달
- `responses`, `totalMembers`는 VotePage 내부에서 직접 fetch

## Key Constraints

- **Member-only app** — do not remove or weaken auth guards
- **No test framework** — do not add test files or test scripts without being asked
- **Supabase Edge Functions use Deno**, not Node.js — imports use URL syntax (`https://deno.land/...`), not npm packages
- Do not add `console.log` statements to production code
- UI language is **Korean** — keep user-facing strings in Korean
- **UI 대규모 변경 시** (새 페이지, 레이아웃 교체 등) `$source-command-design-preview` 스킬로 실물 프리뷰 먼저 생성 후 확정
- **운영 반영은 메인테이너만** — 사용자가 저장소 오너(`Jiwook00`)가 아니면 운영 DB 마이그레이션 적용(`supabase db push`, Supabase MCP `apply_migration`), Edge Function 배포, 시크릿 등록을 하지 않는다. 파일만 만들고 PR 본문에 "운영 반영 필요"를 적는다 ([CONTRIBUTING](.github/CONTRIBUTING.md#메인테이너만-하는-일))
- **DB·앱 테스트는 로컬 Supabase에서** — `supabase start` → `npm run dev:local`. 마이그레이션을 추가하면 `supabase db reset`으로 처음부터 적용되는지 확인한다. 가짜 데이터는 `supabase/seed.sql`(실제 멤버 데이터 금지). `npm run dev`는 운영 DB에 붙어서 글·댓글·투표가 실제 멤버에게 보이고 디스코드 알림이 나간다
- **마이그레이션 파일 버전 = 운영 버전** — Supabase MCP `apply_migration`은 파일 이름의 타임스탬프가 아니라 적용한 시각으로 버전을 기록한다. MCP로 적용했다면 `list_migrations`로 운영 버전을 확인하고 파일 이름 앞부분을 그 값으로 바꾼다. 안 맞으면 `supabase db push`가 이미 적용한 마이그레이션을 다시 적용하려 한다
- 로컬 전용 로그인(`src/lib/local-dev.ts`)은 `import.meta.env.DEV`이고 URL이 로컬일 때만 켜진다. 이 조건을 넓히지 않는다
