# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
npm run dev       # Start development server (Vite)
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
- `supabase/migrations/` — SQL migration files

**Database** (Supabase)

- 모든 테이블은 `checkin_` 프리픽스를 사용 (예: `checkin_retrospectives`, `checkin_members`)
- `checkin_members` — 앱 유저 프로필, `auth.users`와 1:1 대응, 첫 로그인 시 upsert
- `checkin_allowed_members` — 접근 제어용 이메일 화이트리스트

**Auth**

- Supabase Google OAuth 사용
- 로그인 흐름: Google OAuth → `checkin_allowed_members` 화이트리스트 확인 → `checkin_members` upsert
- 유저 관리는 `auth.users`가 아닌 `checkin_members`에서 수행

**Deployment**: Frontend → Vercel, Backend → Supabase

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

## Claude 커맨드

`.claude/commands/`에 정의된 슬래시 커맨드:

| 커맨드                | 설명                                              |
| --------------------- | ------------------------------------------------- |
| `/issue-start <번호>` | 이슈 정보 로드 + 브랜치 생성                      |
| `/issue-new`          | 현재 작업 기반으로 새 이슈 생성                   |
| `/commit`             | 이슈 참조(`Closes #X`) 포함 커밋 가이드           |
| `/create-pr`          | PR 생성                                           |
| `/design-preview`     | UI 변경 전 다양한 스타일 프리뷰를 `/dev/*`에 생성 |

## Data Flow

**새 컴포넌트를 만들기 전에 반드시 `App.tsx`를 먼저 확인하라.**

- `App.tsx`는 전역 데이터의 유일한 fetch 지점 — `activePoll`, `authState`, `articles` 등
- 이미 App에서 fetch한 데이터는 **props로 전달**받는다. 컴포넌트 안에서 중복 fetch 금지
- 컴포넌트 내부 fetch는 그 컴포넌트 route에서만 필요한 데이터(예: 해당 페이지의 responses)에 한정

**상태(state) 설계 원칙**

- 파생 가능한 값은 state로 만들지 말고 렌더 타임에 계산 (`useMemo` 또는 인라인)
- 하나의 사용자 액션이 여러 `setState`를 동시에 호출해야 한다면 `useReducer` 고려
- 공유 타입/상수는 `src/types/index.ts` 또는 해당 lib 파일에 단일 정의 — 컴포넌트 파일 내 중복 선언 금지

## Key Constraints

- **Member-only app** — do not remove or weaken auth guards
- **No test framework** — do not add test files or test scripts without being asked
- **Supabase Edge Functions use Deno**, not Node.js — imports use URL syntax (`https://deno.land/...`), not npm packages
- Do not add `console.log` statements to production code
- UI language is **Korean** — keep user-facing strings in Korean
- **UI 대규모 변경 시** (새 페이지, 레이아웃 교체 등) `/design-preview` 커맨드로 실물 프리뷰 먼저 생성 후 확정
