# Checkin

한 달에 한 번, 개발자들이 모여 근황을 나누는 월간 회고 모임을 위한 웹 앱.

회고 글을 한 곳에 모아 읽고, 모임과 관련된 모든 것을 통합 관리합니다.

## 주요 기능

- 회고 글 링크 등록 시 자동 파싱 및 스냅샷 저장 (노션, 티스토리, 일반 블로그)
- 월별 / 작성자별 필터링
- 인앱 마크다운 리더 뷰
- 멤버 전용 접근 (초대된 멤버만 이용 가능)
- 모임 날짜 및 장소 투표

## 기술 스택

| 영역            | 기술                                |
| --------------- | ----------------------------------- |
| 프론트엔드      | React + Vite + TypeScript           |
| 스타일링        | Tailwind CSS v4                     |
| 마크다운 렌더링 | react-markdown + remark-gfm         |
| 백엔드          | Supabase Edge Functions (Deno)      |
| DB              | Supabase PostgreSQL                 |
| 노션 파싱       | notion-client (비공식 API)          |
| 블로그 파싱     | deno-dom + Turndown                 |
| 배포            | Vercel (프론트) + Supabase (백엔드) |

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env에 Supabase URL과 anon key 입력

# 개발 서버 실행
npm run dev
```

### Supabase 설정

```bash
# DB 마이그레이션 실행
supabase db push

# Edge Function 배포
supabase functions deploy parse-content
```

## 릴리즈 프로세스

버저닝: **SemVer** (MAJOR.MINOR.PATCH), 현재 `v0.x.x` (개발 단계)

### 전체 흐름

```
develop에서 개발 (feat:/fix:/chore: 커밋)
  ↓
main에 PR 머지
  ↓ 자동 실행
  ├─ Vercel 배포 (자동)
  └─ release-please → "Release PR" 생성/업데이트
        (CHANGELOG.md + package.json 버전 bump)
  ↓
Release PR 검토 후 머지
  ↓
GitHub Release + Git 태그 자동 생성 (v0.2.0, v0.3.0 ...)
```

### 버전 자동 결정 규칙

커밋 타입에 따라 다음 버전이 자동으로 결정된다.

| 커밋 예시                              | 버전 변화                  |
| -------------------------------------- | -------------------------- |
| `fix: 노션 블록 파싱 오류 수정`        | 0.1.0 → **0.1.1**          |
| `feat: 회고 글 북마크 기능 추가`       | 0.1.0 → **0.2.0**          |
| `feat!: 회원 초대 방식 전면 개편`      | 0.1.0 → **0.2.0** ※        |
| `fix: ...` + `feat: ...` 동시에 쌓이면 | 높은 타입 기준 → **0.2.0** |

> ※ `v0.x.x` 구간에서는 `BREAKING CHANGE`도 MINOR만 올라감 (`bump-minor-pre-major` 설정).
> `v1.0.0` 이후부터 일반 SemVer 규칙 적용 (BREAKING CHANGE → MAJOR bump).

### 파괴적 변경 (Breaking Change) 표기

```bash
# 방법 1 — 느낌표 (간단)
feat!: 회원 초대 방식 전면 개편

# 방법 2 — footer (상세 설명)
feat(인증): 회원 초대 방식 전면 개편

BREAKING CHANGE: 기존 초대 링크가 만료되며 멤버를 재초대해야 합니다.
```

## 접근 제한

Checkin은 멤버 전용 앱이다. 초대된 멤버만 가입 및 이용할 수 있다.

## 기여하기

버그 수정, 기능 제안, 문서 개선 모두 환영합니다.
이슈 없이 바로 PR을 올려도 됩니다.

자세한 내용은 [기여 가이드](.github/CONTRIBUTING.md)를 참고해주세요.
