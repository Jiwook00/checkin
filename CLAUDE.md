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

| 커맨드                | 설명                                    |
| --------------------- | --------------------------------------- |
| `/issue-start <번호>` | 이슈 정보 로드 + 브랜치 생성            |
| `/issue-new`          | 현재 작업 기반으로 새 이슈 생성         |
| `/commit`             | 이슈 참조(`Closes #X`) 포함 커밋 가이드 |
| `/create-pr`          | PR 생성                                 |

## Key Constraints

- **Member-only app** — do not remove or weaken auth guards
- **No test framework** — do not add test files or test scripts without being asked
- **Supabase Edge Functions use Deno**, not Node.js — imports use URL syntax (`https://deno.land/...`), not npm packages
- Do not add `console.log` statements to production code
- UI language is **Korean** — keep user-facing strings in Korean
