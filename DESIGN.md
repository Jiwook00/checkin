---
version: "0.2"
name: Checkin Design System
description: A warm, document-first interface for a small developer retrospective community. Heavily inspired by Anthropic's Claude.com design language — warm cream canvas, coral primary CTA, dark navy surfaces, Inter throughout. Adapted from a marketing site to a product app context — no hero bands or pricing grids, but the same warmth, color system, and surface rhythm carries into sidebar navigation, article cards, and session banners.

colors:
  primary: "#cc785c"
  primary-active: "#a9583e"
  primary-disabled: "#e6dfd8"
  ink: "#141413"
  body: "#3d3d3a"
  body-strong: "#252523"
  muted: "#6c6a64"
  muted-soft: "#8e8b82"
  hairline: "#e6dfd8"
  hairline-soft: "#ebe6df"
  canvas: "#faf9f5"
  surface-soft: "#f5f0e8"
  surface-card: "#efe9de"
  surface-dark: "#181715"
  surface-dark-elevated: "#252320"
  on-primary: "#ffffff"
  on-dark: "#faf9f5"
  on-dark-soft: "#a09d96"
  error: "#c64545"
  error-surface: "#fef2f2"
  success: "#5db872"

typography:
  display-sm:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.3px
    use: "SessionBanner 회고 제목 (월간 회고 타이틀)"
  title-lg:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
    use: "페이지 섹션 헤딩, 모달 제목"
  title-md:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
    use: "카드 제목, 아티클 타이틀"
  title-sm:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
    use: "서브섹션 라벨, 강조 항목"
  body-md:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
    use: "카드 미리보기, 본문 텍스트"
  body-sm:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
    use: "캡션, 날짜, 메타 정보"
  label:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
    use: "세션명, 소스타입 태그"
  nav:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
    use: "사이드바 네비게이션, 드로어 링크"
  button:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
    use: "모든 버튼 레이블"
  wordmark:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 15px
    fontWeight: 800
    letterSpacing: -0.3px
    use: "Checkin 워드마크"

rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  card: 20px
  section: 48px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    height: 38px
    hover: "{colors.primary-active}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.body-sm}"
    hover-textColor: "{colors.ink}"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    typography: "{typography.body-sm}"
  article-card:
    backgroundColor: "{colors.surface-card}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
    hover-backgroundColor: "{colors.canvas}"
    hover-border: "1px solid {colors.hairline}"
    hover-shadow: "0 1px 4px rgba(20,20,19,0.08)"
  session-banner:
    backgroundColor: "{colors.canvas}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  sidebar:
    backgroundColor: "{colors.canvas}"
    width: 176px
    padding: "28px 16px 20px"
  content-panel:
    backgroundColor: "{colors.surface-card}"
    border-left: "1px solid {colors.hairline}"
  mobile-header:
    backgroundColor: "{colors.canvas}"
    border-bottom: "1px solid {colors.hairline-soft}"
    height: 56px
  mobile-drawer:
    backgroundColor: "{colors.canvas}"
    width: 256px
    shadow: "0 8px 32px rgba(20,20,19,0.16)"
  login-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: 40px
    shadow: "0 1px 4px rgba(20,20,19,0.08)"
  article-reader:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  badge-session:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: 38px
    focus-border: "{colors.primary}"
  text-input-focused:
    border: "1px solid {colors.primary}"
    ring: "0 0 0 3px rgba(204,120,92,0.15)"
  error-banner:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.error}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  member-avatar:
    shape: "{rounded.full}"
    size-sm: 20px
    size-md: 36px
    size-lg: 64px
---

## Overview

Checkin은 소수 개발자 회고 모임을 위한 프라이빗 앱이다. 디자인 언어는 **Anthropic Claude.com을 강하게 참조**한다 — 따뜻한 크림 캔버스, 코랄 primary CTA, 다크 네이비 서피스, Inter 단일 폰트. 마케팅 사이트가 아닌 **프로덕트 앱** 컨텍스트이므로, hero band나 pricing grid는 없지만 동일한 따뜻함과 색상 시스템, 서피스 리듬이 사이드바, 아티클 카드, 세션 배너 전반에 흐른다.

**시스템의 세 가지 서피스 모드:**

1. **크림 캔버스** (`{colors.canvas}` — #faf9f5) — 사이드바, 페이지 바닥, 카드 기본
2. **크림 카드** (`{colors.surface-card}` — #efe9de) — 콘텐츠 패널 배경, 아티클 카드 기본 상태
3. **다크 네이비** (`{colors.surface-dark}` — #181715) — 아티클 리더(마크다운 뷰어), 특별 강조 섹션

**핵심 성격:**

- 따뜻한 크림 캔버스 (`{colors.canvas}` — #faf9f5). 현재 코드의 `stone-50` / `bg-white` 혼용을 이 토큰으로 통일.
- 코랄 primary (`{colors.primary}` — #cc785c). 현재 `bg-stone-900` 버튼을 코랄로 교체 — "+ 글 추가", 폼 제출, 주요 CTA 전반.
- **Inter** 단일 폰트 패밀리. weight 400–800 범위에서 크기와 굵기로만 계층 구분.
- 카드 깊이는 `{colors.surface-card}` → hover: `{colors.canvas}` + 미세 shadow로 표현. 그림자는 희박하게.

## Colors

### Brand & Primary

- **Coral / Primary** (`{colors.primary}` — #cc785c): 모든 primary CTA 배경. "+ 글 추가", "로그인", 폼 제출 버튼. 코랄은 희박하게 — 개별 버튼에 집중, 페이지 전체에 뿌리지 않는다.
- **Coral Active** (`{colors.primary-active}` — #a9583e): hover / press 시 어두워지는 variant.
- **Coral Disabled** (`{colors.primary-disabled}` — #e6dfd8): 비활성 상태. 크림 톤의 탈채색.

### Surface

| 토큰                             | 헥스    | 사용처                                       |
| -------------------------------- | ------- | -------------------------------------------- |
| `{colors.canvas}`                | #faf9f5 | 사이드바, 페이지 바닥, 카드 hover 상태, 모달 |
| `{colors.surface-soft}`          | #f5f0e8 | 섹션 구분 밴드, 매우 연한 대비               |
| `{colors.surface-card}`          | #efe9de | 콘텐츠 패널 배경, 아티클 카드 기본 배경      |
| `{colors.surface-dark}`          | #181715 | 아티클 리더, 마크다운 뷰어, 코드 블록        |
| `{colors.surface-dark-elevated}` | #252320 | 다크 서피스 내 인라인 elevated 요소          |
| `{colors.hairline}`              | #e6dfd8 | 카드 테두리, 입력 필드 테두리, 패널 구분선   |
| `{colors.hairline-soft}`         | #ebe6df | 모바일 헤더 하단선, 내부 divider             |

`canvas`와 `surface-card`는 **한 스텝 차이**다. 사이드바(canvas) ↔ 콘텐츠 패널(surface-card) 구분이 이 두 색상으로만 이루어진다. 절대 순수 흰색(`#ffffff`) 사용 금지.

### Text

| 토큰                    | 헥스    | 사용처                           |
| ----------------------- | ------- | -------------------------------- |
| `{colors.ink}`          | #141413 | 헤딩, 카드 제목, 주요 라벨       |
| `{colors.body-strong}`  | #252523 | 강조 단락, 서브헤딩              |
| `{colors.body}`         | #3d3d3a | 기본 본문 텍스트                 |
| `{colors.muted}`        | #6c6a64 | 날짜, 세션명, 비활성 nav         |
| `{colors.muted-soft}`   | #8e8b82 | 캡션, 버전 넘버, 미리보기 텍스트 |
| `{colors.on-primary}`   | #ffffff | 코랄 버튼 위 텍스트              |
| `{colors.on-dark}`      | #faf9f5 | 다크 서피스 위 주요 텍스트       |
| `{colors.on-dark-soft}` | #a09d96 | 다크 서피스 위 보조 텍스트       |

### Semantic

| 토큰                     | 헥스    | 사용처                               |
| ------------------------ | ------- | ------------------------------------ |
| `{colors.error}`         | #c64545 | 삭제 확인 버튼, 폼 에러 텍스트       |
| `{colors.error-surface}` | #fef2f2 | 에러 배너 배경                       |
| `{colors.success}`       | #5db872 | 투표 확정 상태 표시, "복사됨" 피드백 |

## Typography

### Font Family

**Inter** 단일 폰트. UI 전체에 Inter weight 400–800을 사용하고, JetBrains Mono는 아티클 리더 코드 블록에만.

```css
/* index.css에 추가 */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");
```

크기와 weight 조합으로 계층을 만든다 — `display-sm`(28px/700)이 최상위, 아래로 내려갈수록 크기와 weight가 줄어든다.

### Hierarchy

| 토큰                      | 사이즈 | Weight | Line Height | Letter Spacing | 사용처                      |
| ------------------------- | ------ | ------ | ----------- | -------------- | --------------------------- |
| `{typography.display-sm}` | 28px   | 700    | 1.2         | -0.3px         | SessionBanner 회고 제목     |
| `{typography.title-lg}`   | 18px   | 600    | 1.4         | 0              | 페이지 섹션 헤딩, 모달 제목 |
| `{typography.title-md}`   | 16px   | 600    | 1.4         | 0              | 아티클 카드 제목            |
| `{typography.title-sm}`   | 14px   | 600    | 1.4         | 0              | 서브섹션 라벨               |
| `{typography.nav}`        | 14px   | 500    | 1.4         | 0              | 사이드바 nav, 드로어 링크   |
| `{typography.button}`     | 14px   | 500    | 1           | 0              | 버튼 레이블                 |
| `{typography.body-md}`    | 14px   | 400    | 1.6         | 0              | 카드 미리보기, 설명 텍스트  |
| `{typography.body-sm}`    | 13px   | 400    | 1.55        | 0              | 캡션, 날짜, 메타            |
| `{typography.label}`      | 12px   | 500    | 1.4         | 0              | 세션명 태그, 소스 타입      |
| `{typography.wordmark}`   | 15px   | 800    | —           | -0.3px         | "Checkin" 워드마크          |

## Layout

### Application Shell

```
Desktop (≥ 768px)
┌──────────────────────────────────────────────┐
│ Sidebar (176px)   │  Content Panel (flex-1)   │
│ bg: {canvas}      │  bg: {surface-card}        │
│                   │  border-l: {hairline}      │
└──────────────────────────────────────────────┘

Mobile (< 768px)
┌─────────────────────────────────┐
│ Fixed Header (56px)             │  bg: {canvas}, border-b: {hairline-soft}
├─────────────────────────────────┤
│ Content (pt-14)                 │  bg: {surface-card}
└─────────────────────────────────┘
  → 우측 Drawer (256px, bg: {canvas}, shadow)
```

현재 코드의 `bg-stone-50` / `bg-white` 혼용을 각각 `{colors.canvas}` / `{colors.surface-card}`로 정리한다.

### Spacing System

| 토큰                | 값   | 사용처                                            |
| ------------------- | ---- | ------------------------------------------------- |
| `{spacing.xxs}`     | 4px  | 아이콘-텍스트 간격                                |
| `{spacing.xs}`      | 8px  | 인라인 요소 간격                                  |
| `{spacing.sm}`      | 12px | 카드 내부 요소 간격                               |
| `{spacing.md}`      | 16px | 기본 요소 간격                                    |
| `{spacing.lg}`      | 24px | 카드 간격, 섹션 내 여백                           |
| `{spacing.xl}`      | 32px | 섹션 간격, 아티클 리더 패딩                       |
| `{spacing.xxl}`     | 48px | 페이지 섹션 간격                                  |
| `{spacing.card}`    | 20px | 카드 내부 패딩                                    |
| `{spacing.section}` | 48px | 주요 섹션 간 여백 (Claude의 96px보다 앱답게 절반) |

### Grid

- **ArticleList**: `grid grid-cols-1 md:grid-cols-2` — 모바일 1열, 데스크탑 2열
- **콘텐츠 최대 너비**: `max-w-3xl` (768px) — 회고 글 가독성 중심
- **ProfilePage, SettingsPage**: 단일 컬럼 `max-w-sm`

## Elevation & Depth

색상 블록 우선, 그림자는 희박하게 — Claude.com과 동일한 철학.

| 레벨         | 처리                                                             | 사용처                          |
| ------------ | ---------------------------------------------------------------- | ------------------------------- |
| Flat         | 배경만, border 없음                                              | 사이드바, 캔버스 자체           |
| Hairline     | `border: 1px solid {colors.hairline}`                            | 카드 기본, 입력 필드, 세션 배너 |
| Card         | `bg: {colors.surface-card}` + hairline border                    | 아티클 카드 기본 상태           |
| Elevated     | `bg: {colors.canvas}` + `shadow: 0 1px 4px rgba(20,20,19,0.08)`  | 카드 hover, 로그인 카드         |
| Dark surface | `bg: {colors.surface-dark}`                                      | 아티클 리더, 코드 블록          |
| Modal        | `bg: {colors.canvas}` + `shadow: 0 8px 32px rgba(20,20,19,0.16)` | 모바일 드로어, 모달             |

**카드 hover 방향성**: `surface-card` (약간 어두운 크림) → `canvas` (밝은 크림) + 미세 shadow. 카드가 "들어올려지는" 느낌.

## Shapes

### Border Radius Scale

| 토큰             | 값     | Tailwind       | 사용처                            |
| ---------------- | ------ | -------------- | --------------------------------- |
| `{rounded.sm}`   | 6px    | `rounded`      | 드롭다운 아이템, 작은 인라인 요소 |
| `{rounded.md}`   | 8px    | `rounded-lg`   | 버튼, 입력 필드, 에러 배너        |
| `{rounded.lg}`   | 12px   | `rounded-xl`   | 아티클 카드, 세션 배너, 모달      |
| `{rounded.xl}`   | 16px   | `rounded-2xl`  | 로그인 카드, 아티클 리더          |
| `{rounded.pill}` | 9999px | `rounded-full` | 세션 배지, 상태 태그              |
| `{rounded.full}` | 9999px | `rounded-full` | 아바타                            |

## Components

### Navigation

**Sidebar (desktop)** — `w-44 bg-{canvas} px-4 pt-7 pb-5`. "Checkin" 워드마크(`{typography.wordmark}`), nav 링크, 하단 사용자 정보.

nav 아이템 상태:

- Inactive: `color: {colors.muted}` / hover: `color: {colors.ink}` + `bg: {colors.surface-card}`
- Active: `font-weight: 600` + `color: {colors.ink}` + `bg: {colors.surface-card}`

**Mobile Header** — `h-14 bg-{canvas} border-b: {hairline-soft}`. 워드마크 + 햄버거 아이콘.

**Mobile Drawer** — 우측 슬라이드, `w-64 bg-{canvas} shadow-[0_8px_32px_...]`. "+ 글 추가" primary 버튼, nav 링크, 사용자 정보.

### Buttons

**`button-primary`** — 코랄 CTA. `bg: {colors.primary} text: {colors.on-primary}`. 타이포: `{typography.button}`. 패딩 10px × 18px, 높이 38px, `rounded-{md}` (8px). Hover: `{colors.primary-active}`.

**`button-secondary`** — 크림 배경 + hairline 테두리. `bg: {colors.canvas} border: {colors.hairline} text: {colors.ink}`. 동일 패딩/높이/라운딩.

**`button-ghost`** — 텍스트만, 배경 없음. `color: {colors.muted}` → hover: `{colors.ink}`. 로그아웃, 카드 수정 등 낮은 중요도 액션.

**`button-destructive`** — `color: {colors.error}`. 삭제 확인 버튼. 배경 없음.

### Cards

**`article-card`** — 회고 목록의 핵심 카드.

```
배경: {colors.surface-card}  →  hover: {colors.canvas}
테두리: {colors.hairline}
rounded: {rounded.lg} (12px)
padding: {spacing.card} (20px)
transition: background-color 150ms, box-shadow 150ms
hover-shadow: 0 1px 4px rgba(20,20,19,0.08)
```

내부 구조: `{typography.label}` 세션/소스타입 → `{typography.title-md}` 제목 → `{typography.body-md}` 미리보기 2줄 → 아바타 + 닉네임 + (owner) 수정/삭제.

**`session-banner`** — 메인 상단 회고 정보 카드.

```
배경: {colors.canvas}
테두리: {colors.hairline}
rounded: {rounded.lg} (12px)
padding: {spacing.card} (20px)
margin-bottom: {spacing.lg} (24px)
```

회고 제목은 `{typography.display-sm}` (세리프 28px) 적용.

**`article-reader`** — 마크다운 뷰어. Claude.com의 `code-window-card`에 해당.

```
배경: {colors.surface-dark}
텍스트: {colors.on-dark}
rounded: {rounded.xl} (16px)
padding: {spacing.xl} (32px)
```

코드 블록은 `{colors.surface-dark-elevated}` 내부 배경, JetBrains Mono 14px.

**`login-card`** — 중앙 정렬 인증 카드.

```
배경: {colors.canvas}
rounded: {rounded.xl} (16px)
padding: 40px
shadow: 0 1px 4px rgba(20,20,19,0.08)
max-width: 384px
```

### Inputs & Forms

**`text-input`** — `bg: {colors.canvas} border: {colors.hairline} rounded: {rounded.md}`. 패딩 10px × 14px, 높이 38px.

**`text-input-focused`** — border: `{colors.primary}` + 외부 ring: `0 0 0 3px rgba(204,120,92,0.15)`. 코랄 포커스 링.

**`error-banner`** — `bg: {colors.error-surface} text: {colors.error} rounded: {rounded.md}`. 패딩 12px × 16px.

### Badges / Tags

**`badge-session`** — 세션명, 소스타입 태그. `bg: {colors.surface-card} text: {colors.muted}`. `{typography.label}` (12px/500). `rounded-pill`. 패딩 3px × 10px.

### Avatar

**`member-avatar`** — `rounded-full`. 크기: 20px (카드 인라인), 36px (리스트), 64px (프로필). 아바타 없을 때 이니셜 폴백, 배경색은 멤버 ID 해시 기반.

## Do's and Don'ts

### Do

- 모든 배경은 `{colors.canvas}` 또는 `{colors.surface-card}` 중 하나. 순수 흰색(`#ffffff`) 금지.
- 코랄(`{colors.primary}`)은 primary CTA에만 — "+ 글 추가", "로그인", 폼 제출.
- 카드 hover는 `surface-card → canvas + 미세 shadow` 방향으로.
- 사이드바(canvas) ↔ 콘텐츠 패널(surface-card) 대비로 패널 경계 표현.
- Inter weight 800을 워드마크에만 사용.

### Don't

- `bg-white`, `bg-gray-*`, `bg-stone-*` 신규 사용 금지 — 모두 `{colors.canvas}` 또는 `{colors.surface-card}`로.
- 코랄 버튼을 여러 개 나란히 놓지 않는다. 한 화면에 primary CTA는 하나.
- `shadow-md` 이상 그림자 금지. hover 상태에 `shadow-sm` 수준까지만.
- `bg-stone-900` 검정 버튼 신규 사용 금지 — 코랄로 교체.
- 인라인 스타일(`style=`) 사용 금지.

## Responsive Behavior

### Breakpoints

| 이름    | 너비      | 주요 변경                                     |
| ------- | --------- | --------------------------------------------- |
| Mobile  | `< 768px` | 사이드바 숨김 → 고정 헤더(56px) + 우측 드로어 |
| Desktop | `≥ 768px` | 사이드바 표시, 콘텐츠 패널 `border-l`         |

### Mobile 특이사항

- 콘텐츠 패딩 상단: `pt-14` (56px 헤더 보정)
- 하단 여백: `pb-20` (모바일 safe area)
- 드로어 오버레이: `bg-black/30` (Claude는 40%, CHECKIN은 좀 더 연하게)
- 스크롤 시 헤더 숨김: translateY transition, 4px 이상 스크롤 방향 감지

### Touch Targets

- Primary 버튼: 38px 높이 — 최소 기준 충족
- 아이콘 버튼: `w-9 h-9` (36px) — 핵심 액션은 44px 목표
- 카드 전체 영역 탭 가능

## Migration: 현재 코드 → 이 시스템

현재 코드에서 우선순위별 정리 항목:

| 현재                          | 교체                                                      | 우선순위 |
| ----------------------------- | --------------------------------------------------------- | -------- |
| `bg-stone-50` (canvas 역할)   | `{colors.canvas}`                                         | 높음     |
| `bg-white` (콘텐츠 패널)      | `{colors.surface-card}`                                   | 높음     |
| `bg-stone-900` (primary 버튼) | `{colors.primary}` (코랄)                                 | 높음     |
| `border-stone-*`              | `{colors.hairline}` / `{colors.hairline-soft}`            | 중간     |
| `text-stone-*`                | `{colors.ink}` / `{colors.muted}` / `{colors.muted-soft}` | 중간     |
| `bg-gray-*` (LoginPage)       | `{colors.canvas}` / `{colors.surface-card}`               | 중간     |
| 시스템 폰트 기본값            | Inter (Google Fonts) 명시적 로드                          | 낮음     |
| SessionBanner 제목            | `{typography.display-sm}` (28px/700/Inter) 적용           | 낮음     |

## Known Gaps

- **VotePage는 fullBleed 레이아웃** — VoteCalendar, TallyPopup의 토큰이 이 문서에 미반영.
- **PhotoAlbumPage** — 사진 그리드 레이아웃 패턴 미정의.
- **다크 모드** — 미지원. `{colors.surface-dark}`는 아티클 리더 등 특정 컴포넌트에만 사용, 전체 다크 모드 아님.
- **포커스 스타일** — 현재 미정의. `text-input-focused`의 코랄 ring을 버튼 등에도 확장 필요.
- **애니메이션 타이밍** — `transition-all 150ms ease` 기준으로 통일 권장, 현재 미공식화.
