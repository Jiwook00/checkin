# Changelog

## [1.1.0](https://github.com/Jiwook00/checkin/compare/checkin-v1.0.0...checkin-v1.1.0) (2026-04-04)


### Features

* 사진첩 Pinterest 스타일 상세 뷰 구현 ([2664e23](https://github.com/Jiwook00/checkin/commit/2664e233a3319a7bfdd328c1d715706f9890b2b9))


### Bug Fixes

* notion api 응답 구조 변경에 따른 블록 파싱 수정 ([a34a98e](https://github.com/Jiwook00/checkin/commit/a34a98e4c96297e7f01c9a29dd0f0cc4763d6655))
* 메인 세션 필터를 지난 3개월치만 표시하도록 수정 ([cb16385](https://github.com/Jiwook00/checkin/commit/cb16385df0526caa7554e058397c4f3d23e4b2df))

## [1.0.0](https://github.com/Jiwook00/checkin/compare/checkin-v0.4.0...checkin-v1.0.0) (2026-04-01)

### Features

- 아카이브 페이지 구현 ([f072099](https://github.com/Jiwook00/checkin/commit/f0720992e2e37b0c8d9b217cf62b195458280b64))
- 프로필 사진 업로드 시 크롭 편집 기능 추가 ([13262f0](https://github.com/Jiwook00/checkin/commit/13262f0d1a869629b4dbb8f7bf01097d6143679c))
- 프로필 이미지를 글 목록·일정 투표 화면에 적용 ([b1c5804](https://github.com/Jiwook00/checkin/commit/b1c5804dad43790affb8ae0466d28180b4ef1270))
- 프로필 페이지 구현 (아바타 업로드, 활동 통계) ([e7b800f](https://github.com/Jiwook00/checkin/commit/e7b800f6e796177df35594f2a787687378494697))

### Bug Fixes

- Edge Function SSRF 방지 및 Storage 삭제 RLS 소유권 검증 강화 ([ce4d84a](https://github.com/Jiwook00/checkin/commit/ce4d84a0b70a241b757175a8550a22a29c2274bd)), closes [#13](https://github.com/Jiwook00/checkin/issues/13)
- ErrorBoundary 추가 및 AddArticleModal 저장 상태 누락 경로 수정 ([6c40a5c](https://github.com/Jiwook00/checkin/commit/6c40a5c78f23232d699057d135a4451853ac12d6))
- SSRF 방지 및 Storage 삭제 RLS 소유권 검증 강화 ([#13](https://github.com/Jiwook00/checkin/issues/13)) ([dfd9836](https://github.com/Jiwook00/checkin/commit/dfd9836fbf47bf71de3fc3f1f54424b26933ac8b))
- 모바일 삭제 2단계 확인 추가 및 이미지 lazy loading 적용 ([fb914b6](https://github.com/Jiwook00/checkin/commit/fb914b62ee0ad2a8ba3aeadf26a682dcfc8c25d2))
- 접근성 개선 (SessionFilter radio role, ⋮ 버튼 aria-label) ([7a4ff0c](https://github.com/Jiwook00/checkin/commit/7a4ff0c34084754407cfbe7b3530835dd0fae84b))

### Performance Improvements

- computeVoteTally useMemo 적용 및 Lottie JSON lazy-load ([9821583](https://github.com/Jiwook00/checkin/commit/9821583d750cfaa748c83f8f39f47064b2dfe818))

### Miscellaneous Chores

- release 1.0.0 ([33c9677](https://github.com/Jiwook00/checkin/commit/33c9677dcb58ea2d5aa5b69208e6e70bcbcfa44b))

## [0.4.0](https://github.com/Jiwook00/checkin/compare/checkin-v0.3.0...checkin-v0.4.0) (2026-03-23)

### Features

- AddArticleModal 주사위를 lottie-react 애니메이션으로 교체 ([0fd2b4e](https://github.com/Jiwook00/checkin/commit/0fd2b4e53116e914628b3a3d42925777018f1619))
- 글 추가 시 이미지 업로드를 별도 Edge Function으로 분리 ([c959c89](https://github.com/Jiwook00/checkin/commit/c959c89c9d5d92c88e1cc46fd0460b23f73d6805))
- 득표 현황 팝업에 투표자 스택 아바타 표시 ([03c0415](https://github.com/Jiwook00/checkin/commit/03c04152da8e79b890aba99e3bf1396ffa4e72ba))
- 득표 현황 팝업에 투표자 스택 아바타 표시 ([52fc051](https://github.com/Jiwook00/checkin/commit/52fc05161f5b71f95086f7671ca969f1e9cd7ef9))
- 로고 클릭 시 메인 페이지로 이동 ([fc15926](https://github.com/Jiwook00/checkin/commit/fc15926e4d3d8f385e40d4f43dbf030bd8a8b781))
- 주사위 게임으로 발표 순서 랜덤 배정 ([d0c8327](https://github.com/Jiwook00/checkin/commit/d0c8327792d4716353a66b345a4a7b336f9e5f37))
- 주사위 게임으로 발표 순서 랜덤 배정 ([fb0f224](https://github.com/Jiwook00/checkin/commit/fb0f2248beb2e063060ee7f073d43feca453477e)), closes [#10](https://github.com/Jiwook00/checkin/issues/10)
- 투표 확정 화면에 참여자 아바타 그리드 표시 ([d029f14](https://github.com/Jiwook00/checkin/commit/d029f147f401618c85a1e47693c18cec1a96be7e))
- 투표 확정 화면에 참여자 아바타 그리드 표시 ([a19d06d](https://github.com/Jiwook00/checkin/commit/a19d06de8b1c50d2cc2b76300ec6b84819c4d83a))

### Bug Fixes

- DiceLottie dev 프리뷰 JSON import 경로 수정 ([6878f3d](https://github.com/Jiwook00/checkin/commit/6878f3d9a7375885c8ace560cf0abe47f95f9e31))
- 득표 현황 집계를 날짜×시간 단위로 수정 ([62c3057](https://github.com/Jiwook00/checkin/commit/62c3057058ab523ba29a717fe52bab59ffb6be58))
- 득표 현황 집계를 날짜×시간 단위로 수정 ([76a83f1](https://github.com/Jiwook00/checkin/commit/76a83f17a4f945b407e6cf3f757f836f2743b040))
- 메인 화면 세션 필터를 오늘 포함 최근 4개월로 수정 ([977214d](https://github.com/Jiwook00/checkin/commit/977214d3a566186fa04c70443f6676a6c409e3b1))
- 일정 탭 진입 시 바텀시트가 즉시 표시되는 버그 수정 ([bcba42f](https://github.com/Jiwook00/checkin/commit/bcba42f2b68f65411dc181883779c46d6d2b5a96))

## [0.3.0](https://github.com/Jiwook00/checkin/compare/checkin-v0.2.0...checkin-v0.3.0) (2026-03-17)

### Features

- VotePage 모바일 반응형 레이아웃 구현 (바텀시트 패턴) ([735c7e0](https://github.com/Jiwook00/checkin/commit/735c7e0b4c271ad30edd256323cdb694644ead2b)), closes [#39](https://github.com/Jiwook00/checkin/issues/39)
- 모바일 반응형 UI 대응 — 메인 피드 및 일정 투표 페이지 ([c078858](https://github.com/Jiwook00/checkin/commit/c078858c06da01b9b50283feb053502ef5bdcf4b))
- 모바일 반응형 레이아웃 및 네비게이션 구현 ([de3f48c](https://github.com/Jiwook00/checkin/commit/de3f48caac9a8be2918891799733cf7e9f0c0201)), closes [#39](https://github.com/Jiwook00/checkin/issues/39)
- 업데이트 페이지 추가 및 버전 표시 ([0e2bc4b](https://github.com/Jiwook00/checkin/commit/0e2bc4b5f40e24e5448c3fc1927223998cd75251))
- 업데이트 페이지 추가 및 버전 표시 ([4d5b6f8](https://github.com/Jiwook00/checkin/commit/4d5b6f89c28781473d0b05b48b8c4100894e2240))
- 일정 탭 상단에 공지 배너 표시 ([588f9df](https://github.com/Jiwook00/checkin/commit/588f9df92424f884800771fd7332f7916e44d6b0))

## [0.2.0](https://github.com/Jiwook00/checkin/compare/checkin-v0.1.0...checkin-v0.2.0) (2026-03-17)

### Features

- dev 프리뷰 라우트 및 인덱스 페이지를 issue-22 내용으로 갱신 ([2b4d5b4](https://github.com/Jiwook00/checkin/commit/2b4d5b4e03e9114e0c69b3bba88f6806b66f3ad3))
- Google OAuth 로그인 및 멤버 접근 제어 구현 ([4430f4b](https://github.com/Jiwook00/checkin/commit/4430f4bb217fb04b98c22bfd6732bff30af0d94f))
- Google OAuth 로그인 및 멤버 접근 제어 구현 ([437b2f0](https://github.com/Jiwook00/checkin/commit/437b2f02e58f1c2027de2200dec5d7050e39081d)), closes [#8](https://github.com/Jiwook00/checkin/issues/8)
- image-processor.ts 구현 - 이미지 Supabase Storage 업로드 ([18680bd](https://github.com/Jiwook00/checkin/commit/18680bd9d901fce9b1e35cfc34708c2cd75d898a))
- parse-content에 이미지 처리 통합 ([#4](https://github.com/Jiwook00/checkin/issues/4)) ([8911e56](https://github.com/Jiwook00/checkin/commit/8911e56a320f0ddd5cff18d07dcf1543c7f3145d))
- retrospectives RLS 정책을 인증 멤버 전용으로 교체 ([5cb3261](https://github.com/Jiwook00/checkin/commit/5cb326105c48d5cfc864826222e732a1b7e5f323))
- retrospectives RLS 정책을 인증 멤버 전용으로 교체 ([268a808](https://github.com/Jiwook00/checkin/commit/268a80824420e1241222f525d857f79ac19bb565)), closes [#9](https://github.com/Jiwook00/checkin/issues/9)
- retrospectives에 member_id FK 추가 및 본인 글 수정/삭제 기능 구현 ([b6c99bf](https://github.com/Jiwook00/checkin/commit/b6c99bf7708cd7e2b73436659fd670f2ae016951))
- SessionBanner UI 개편 및 confirmed_time/meeting 필드 추가 ([f2324b4](https://github.com/Jiwook00/checkin/commit/f2324b408d39b3a4302ec9c2e30307a21c6bdc5e))
- SessionBanner UI 개편 및 confirmed_time/meeting 필드 추가 ([c65b5d8](https://github.com/Jiwook00/checkin/commit/c65b5d86841840e2a88c8c7a6191fe6637ca8153))
- UI/UX 개편 — 사이드바 레이아웃, 클라이언트 라우팅, 세션 배너 ([f36a40e](https://github.com/Jiwook00/checkin/commit/f36a40e2b31214974a4c592265aae673d4162251))
- vote overhaul API 연동 및 DB 스키마 반영 ([2545e40](https://github.com/Jiwook00/checkin/commit/2545e403056ca14e599e17971dfb6c8382b09edc)), closes [#22](https://github.com/Jiwook00/checkin/issues/22)
- VoteFlowMock 전체 플로우 인메모리 테스트 추가 ([82831cf](https://github.com/Jiwook00/checkin/commit/82831cf9e0c8d0359b6c4f24e54137800099c6bd))
- VotePage 일정 만들기·마감 플로우 UI 구현 ([a04ca61](https://github.com/Jiwook00/checkin/commit/a04ca616e6f1eb17022e8b1b36df96e7a171a557)), closes [#22](https://github.com/Jiwook00/checkin/issues/22)
- 공지 배너 기능 추가 ([5442a83](https://github.com/Jiwook00/checkin/commit/5442a835fba6fb596a0f59450a8cd112c4da1471))
- 공지 배너 기능 추가 ([19ffab4](https://github.com/Jiwook00/checkin/commit/19ffab4d200308970381ed649084fd2a8796fa0b)), closes [#31](https://github.com/Jiwook00/checkin/issues/31)
- 글 삭제 시 연관 스토리지 이미지 함께 삭제 ([85548ad](https://github.com/Jiwook00/checkin/commit/85548ad54dac8772b35f87937a09ab9d9b815441))
- 글 추가 모달 작성자·세션 자동 입력 ([8233b4c](https://github.com/Jiwook00/checkin/commit/8233b4cae4bc9b906881dbb84da7fe0fbcf465c2))
- 메인 화면에 세션 배너 및 날짜 투표 섹션 추가 ([ef18ffa](https://github.com/Jiwook00/checkin/commit/ef18ffa113eb657c737e7355aba666b5e351b479)), closes [#7](https://github.com/Jiwook00/checkin/issues/7)
- 모임 일정 조율 기능 추가 ([846b41d](https://github.com/Jiwook00/checkin/commit/846b41d19a9f6fb76651e6c37e9f3edcc9574499))
- 사이드바 레이아웃 및 클라이언트 라우팅 적용 ([ad6a256](https://github.com/Jiwook00/checkin/commit/ad6a2565063b698ba0a22ce16e80812594753776)), closes [#7](https://github.com/Jiwook00/checkin/issues/7)
- 새 투표 생성 시 기존 poll closed 처리 ([3b736e7](https://github.com/Jiwook00/checkin/commit/3b736e75f0ca7a86a20a62cb5bf00509c02412bd)), closes [#32](https://github.com/Jiwook00/checkin/issues/32)
- 일정 CRUD — 등록·수정·삭제 기능 추가 ([8acf49c](https://github.com/Jiwook00/checkin/commit/8acf49cf18fae53c43058570cc5b5596eee8a828)), closes [#32](https://github.com/Jiwook00/checkin/issues/32)
- 일정 마감 → 현황 보기 플로우 개편 ([ce14d53](https://github.com/Jiwook00/checkin/commit/ce14d535aae23c6ed1aa0d1bff2cd299a221aafc)), closes [#30](https://github.com/Jiwook00/checkin/issues/30)
- 일정 조율 투표 전면 개편 (새 스키마 + 생성·마감·확정 플로우) ([200e964](https://github.com/Jiwook00/checkin/commit/200e964c157a0ac096249ce499136070206d37bb))
- 일정 조율 투표 페이지 구현 ([16e8cf1](https://github.com/Jiwook00/checkin/commit/16e8cf182ecfe5ac454c0c6bc60819a853ec8263)), closes [#11](https://github.com/Jiwook00/checkin/issues/11)
- 투표 불참 기능 추가 ([b389561](https://github.com/Jiwook00/checkin/commit/b3895615239bde863d8aa9ee41b8e5a784ebc56b)), closes [#30](https://github.com/Jiwook00/checkin/issues/30)
- 투표 일정 CRUD 기능 추가 ([#32](https://github.com/Jiwook00/checkin/issues/32)) ([eae8a6a](https://github.com/Jiwook00/checkin/commit/eae8a6a6b0a97f612a1fe465a63d864dcf97a91b))
- 투표 현황 보기 플로우 개편 및 불참 기능 추가 ([ebb3f4a](https://github.com/Jiwook00/checkin/commit/ebb3f4af8af5dc7d153cb8edba279eebd771d811))
- 파싱 실패 시 원본 링크 저장 및 폴백 UI 추가 ([c1115b1](https://github.com/Jiwook00/checkin/commit/c1115b1bdbfd9b21a71ba0aa57b9f48a33f6c688))
- 헤더에 GitHub 저장소 링크 아이콘 추가 ([9bfd13d](https://github.com/Jiwook00/checkin/commit/9bfd13dc8a5f903463a92975e84020c6fab7842a))
- 회고 글 파싱 및 리더 뷰 MVP 구현 ([86e7c8c](https://github.com/Jiwook00/checkin/commit/86e7c8c7b2343577b83a1d9ab331607ab7ea26a2))
- 회의 비밀번호 클릭 시 클립보드 복사 기능 추가 ([25ce536](https://github.com/Jiwook00/checkin/commit/25ce536769495d16b813e2de2696fe9c94f7af05))

### Bug Fixes

- parse-content 엣지 함수 401 인증 오류 수정 ([4477462](https://github.com/Jiwook00/checkin/commit/44774627fc514cd29ce26b22a8acfd876cacb4c6))
- TurndownService Deno 호환성 수정 ([0ec560d](https://github.com/Jiwook00/checkin/commit/0ec560d72d0499c3461f45ec39fdc7632e3c741b))
- vercel.json 추가로 SPA 비루트 경로 새로고침 404 수정 ([ddac48e](https://github.com/Jiwook00/checkin/commit/ddac48e6ff4ea7ba2cada5cb753cd27908293e64)), closes [#25](https://github.com/Jiwook00/checkin/issues/25)
- **vote:** 달력 인원 카운트 본인 포함 및 저장하기 버튼 토글 버그 수정 ([82b055f](https://github.com/Jiwook00/checkin/commit/82b055fbe90cb4aa9ca58ff28efd05d089047d90)), closes [#25](https://github.com/Jiwook00/checkin/issues/25)
- 글 추가 모달 작성자 필드 수정 불가 처리 ([342674f](https://github.com/Jiwook00/checkin/commit/342674f6723cdcc257f70e178b2c3c46990b4cfd))
- 글 추가 모달 작성자·세션 자동 입력 및 인증 오류 수정 ([a98bf99](https://github.com/Jiwook00/checkin/commit/a98bf994ea906d8484dd741883cb1ce09b59d648))
- 노션 파싱 502 및 이미지 스토리지 저장 수정 ([2e7b97c](https://github.com/Jiwook00/checkin/commit/2e7b97cf5e42c064dbf46b5ce9df204730b41cca))
- 로그인 시 중복 auth 쿼리 제거 ([ec4f87a](https://github.com/Jiwook00/checkin/commit/ec4f87ab2f87367f11a53041c05980e8aa67e571))
- 파서 이미지 Supabase Storage 저장 및 노션 502 오류 수정 ([7726a2c](https://github.com/Jiwook00/checkin/commit/7726a2c994b40955038f9c267a7864e4a28550dd))
- 회고 상세 화면을 라우트로 전환해 사이드바 및 뒤로가기 복원 ([8f7d952](https://github.com/Jiwook00/checkin/commit/8f7d9529fa070cc59f00994db7a817b3267a86b7))

## Changelog

All notable changes to this project will be documented in this file.

See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.
