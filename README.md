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

## 접근 제한

Checkin은 멤버 전용 앱이다. 초대된 멤버만 가입 및 이용할 수 있다.
