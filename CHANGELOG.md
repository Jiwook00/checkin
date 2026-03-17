# Changelog

## [0.1.1](https://github.com/Jiwook00/checkin/compare/retro-reader-temp-v0.1.0...retro-reader-temp-v0.1.1) (2026-03-17)


### Features

* dev 프리뷰 라우트 및 인덱스 페이지를 issue-22 내용으로 갱신 ([2b4d5b4](https://github.com/Jiwook00/checkin/commit/2b4d5b4e03e9114e0c69b3bba88f6806b66f3ad3))
* Google OAuth 로그인 및 멤버 접근 제어 구현 ([4430f4b](https://github.com/Jiwook00/checkin/commit/4430f4bb217fb04b98c22bfd6732bff30af0d94f))
* Google OAuth 로그인 및 멤버 접근 제어 구현 ([437b2f0](https://github.com/Jiwook00/checkin/commit/437b2f02e58f1c2027de2200dec5d7050e39081d)), closes [#8](https://github.com/Jiwook00/checkin/issues/8)
* image-processor.ts 구현 - 이미지 Supabase Storage 업로드 ([18680bd](https://github.com/Jiwook00/checkin/commit/18680bd9d901fce9b1e35cfc34708c2cd75d898a))
* parse-content에 이미지 처리 통합 ([#4](https://github.com/Jiwook00/checkin/issues/4)) ([8911e56](https://github.com/Jiwook00/checkin/commit/8911e56a320f0ddd5cff18d07dcf1543c7f3145d))
* retrospectives RLS 정책을 인증 멤버 전용으로 교체 ([5cb3261](https://github.com/Jiwook00/checkin/commit/5cb326105c48d5cfc864826222e732a1b7e5f323))
* retrospectives RLS 정책을 인증 멤버 전용으로 교체 ([268a808](https://github.com/Jiwook00/checkin/commit/268a80824420e1241222f525d857f79ac19bb565)), closes [#9](https://github.com/Jiwook00/checkin/issues/9)
* retrospectives에 member_id FK 추가 및 본인 글 수정/삭제 기능 구현 ([b6c99bf](https://github.com/Jiwook00/checkin/commit/b6c99bf7708cd7e2b73436659fd670f2ae016951))
* SessionBanner UI 개편 및 confirmed_time/meeting 필드 추가 ([f2324b4](https://github.com/Jiwook00/checkin/commit/f2324b408d39b3a4302ec9c2e30307a21c6bdc5e))
* SessionBanner UI 개편 및 confirmed_time/meeting 필드 추가 ([c65b5d8](https://github.com/Jiwook00/checkin/commit/c65b5d86841840e2a88c8c7a6191fe6637ca8153))
* UI/UX 개편 — 사이드바 레이아웃, 클라이언트 라우팅, 세션 배너 ([f36a40e](https://github.com/Jiwook00/checkin/commit/f36a40e2b31214974a4c592265aae673d4162251))
* vote overhaul API 연동 및 DB 스키마 반영 ([2545e40](https://github.com/Jiwook00/checkin/commit/2545e403056ca14e599e17971dfb6c8382b09edc)), closes [#22](https://github.com/Jiwook00/checkin/issues/22)
* VoteFlowMock 전체 플로우 인메모리 테스트 추가 ([82831cf](https://github.com/Jiwook00/checkin/commit/82831cf9e0c8d0359b6c4f24e54137800099c6bd))
* VotePage 일정 만들기·마감 플로우 UI 구현 ([a04ca61](https://github.com/Jiwook00/checkin/commit/a04ca616e6f1eb17022e8b1b36df96e7a171a557)), closes [#22](https://github.com/Jiwook00/checkin/issues/22)
* 공지 배너 기능 추가 ([5442a83](https://github.com/Jiwook00/checkin/commit/5442a835fba6fb596a0f59450a8cd112c4da1471))
* 공지 배너 기능 추가 ([19ffab4](https://github.com/Jiwook00/checkin/commit/19ffab4d200308970381ed649084fd2a8796fa0b)), closes [#31](https://github.com/Jiwook00/checkin/issues/31)
* 글 삭제 시 연관 스토리지 이미지 함께 삭제 ([85548ad](https://github.com/Jiwook00/checkin/commit/85548ad54dac8772b35f87937a09ab9d9b815441))
* 글 추가 모달 작성자·세션 자동 입력 ([8233b4c](https://github.com/Jiwook00/checkin/commit/8233b4cae4bc9b906881dbb84da7fe0fbcf465c2))
* 메인 화면에 세션 배너 및 날짜 투표 섹션 추가 ([ef18ffa](https://github.com/Jiwook00/checkin/commit/ef18ffa113eb657c737e7355aba666b5e351b479)), closes [#7](https://github.com/Jiwook00/checkin/issues/7)
* 모임 일정 조율 기능 추가 ([846b41d](https://github.com/Jiwook00/checkin/commit/846b41d19a9f6fb76651e6c37e9f3edcc9574499))
* 사이드바 레이아웃 및 클라이언트 라우팅 적용 ([ad6a256](https://github.com/Jiwook00/checkin/commit/ad6a2565063b698ba0a22ce16e80812594753776)), closes [#7](https://github.com/Jiwook00/checkin/issues/7)
* 새 투표 생성 시 기존 poll closed 처리 ([3b736e7](https://github.com/Jiwook00/checkin/commit/3b736e75f0ca7a86a20a62cb5bf00509c02412bd)), closes [#32](https://github.com/Jiwook00/checkin/issues/32)
* 일정 CRUD — 등록·수정·삭제 기능 추가 ([8acf49c](https://github.com/Jiwook00/checkin/commit/8acf49cf18fae53c43058570cc5b5596eee8a828)), closes [#32](https://github.com/Jiwook00/checkin/issues/32)
* 일정 마감 → 현황 보기 플로우 개편 ([ce14d53](https://github.com/Jiwook00/checkin/commit/ce14d535aae23c6ed1aa0d1bff2cd299a221aafc)), closes [#30](https://github.com/Jiwook00/checkin/issues/30)
* 일정 조율 투표 전면 개편 (새 스키마 + 생성·마감·확정 플로우) ([200e964](https://github.com/Jiwook00/checkin/commit/200e964c157a0ac096249ce499136070206d37bb))
* 일정 조율 투표 페이지 구현 ([16e8cf1](https://github.com/Jiwook00/checkin/commit/16e8cf182ecfe5ac454c0c6bc60819a853ec8263)), closes [#11](https://github.com/Jiwook00/checkin/issues/11)
* 투표 불참 기능 추가 ([b389561](https://github.com/Jiwook00/checkin/commit/b3895615239bde863d8aa9ee41b8e5a784ebc56b)), closes [#30](https://github.com/Jiwook00/checkin/issues/30)
* 투표 일정 CRUD 기능 추가 ([#32](https://github.com/Jiwook00/checkin/issues/32)) ([eae8a6a](https://github.com/Jiwook00/checkin/commit/eae8a6a6b0a97f612a1fe465a63d864dcf97a91b))
* 투표 현황 보기 플로우 개편 및 불참 기능 추가 ([ebb3f4a](https://github.com/Jiwook00/checkin/commit/ebb3f4af8af5dc7d153cb8edba279eebd771d811))
* 파싱 실패 시 원본 링크 저장 및 폴백 UI 추가 ([c1115b1](https://github.com/Jiwook00/checkin/commit/c1115b1bdbfd9b21a71ba0aa57b9f48a33f6c688))
* 헤더에 GitHub 저장소 링크 아이콘 추가 ([9bfd13d](https://github.com/Jiwook00/checkin/commit/9bfd13dc8a5f903463a92975e84020c6fab7842a))
* 회고 글 파싱 및 리더 뷰 MVP 구현 ([86e7c8c](https://github.com/Jiwook00/checkin/commit/86e7c8c7b2343577b83a1d9ab331607ab7ea26a2))
* 회의 비밀번호 클릭 시 클립보드 복사 기능 추가 ([25ce536](https://github.com/Jiwook00/checkin/commit/25ce536769495d16b813e2de2696fe9c94f7af05))


### Bug Fixes

* parse-content 엣지 함수 401 인증 오류 수정 ([4477462](https://github.com/Jiwook00/checkin/commit/44774627fc514cd29ce26b22a8acfd876cacb4c6))
* TurndownService Deno 호환성 수정 ([0ec560d](https://github.com/Jiwook00/checkin/commit/0ec560d72d0499c3461f45ec39fdc7632e3c741b))
* vercel.json 추가로 SPA 비루트 경로 새로고침 404 수정 ([ddac48e](https://github.com/Jiwook00/checkin/commit/ddac48e6ff4ea7ba2cada5cb753cd27908293e64)), closes [#25](https://github.com/Jiwook00/checkin/issues/25)
* **vote:** 달력 인원 카운트 본인 포함 및 저장하기 버튼 토글 버그 수정 ([82b055f](https://github.com/Jiwook00/checkin/commit/82b055fbe90cb4aa9ca58ff28efd05d089047d90)), closes [#25](https://github.com/Jiwook00/checkin/issues/25)
* 글 추가 모달 작성자 필드 수정 불가 처리 ([342674f](https://github.com/Jiwook00/checkin/commit/342674f6723cdcc257f70e178b2c3c46990b4cfd))
* 글 추가 모달 작성자·세션 자동 입력 및 인증 오류 수정 ([a98bf99](https://github.com/Jiwook00/checkin/commit/a98bf994ea906d8484dd741883cb1ce09b59d648))
* 노션 파싱 502 및 이미지 스토리지 저장 수정 ([2e7b97c](https://github.com/Jiwook00/checkin/commit/2e7b97cf5e42c064dbf46b5ce9df204730b41cca))
* 로그인 시 중복 auth 쿼리 제거 ([ec4f87a](https://github.com/Jiwook00/checkin/commit/ec4f87ab2f87367f11a53041c05980e8aa67e571))
* 파서 이미지 Supabase Storage 저장 및 노션 502 오류 수정 ([7726a2c](https://github.com/Jiwook00/checkin/commit/7726a2c994b40955038f9c267a7864e4a28550dd))
* 회고 상세 화면을 라우트로 전환해 사이드바 및 뒤로가기 복원 ([8f7d952](https://github.com/Jiwook00/checkin/commit/8f7d9529fa070cc59f00994db7a817b3267a86b7))

## Changelog

All notable changes to this project will be documented in this file.

See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.
