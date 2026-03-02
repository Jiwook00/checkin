UI 변경 전 여러 디자인 옵션을 `/dev/*` 경로에 프리뷰로 만들고 사용자가 직접 비교할 수 있도록 한다.

## 언제 사용하는가

- 새 페이지 레이아웃 설계
- 메인 UI 컴포넌트 대규모 변경
- 사이드바, 네비게이션, 카드 등 핵심 UI 패턴 교체

## Steps

1. **컨텍스트 파악**

   현재 이슈/요청을 분석해서:
   - 어떤 화면인지 (메인, 아카이브, 프로필 등)
   - 어떤 요소가 바뀌는지 (레이아웃 전체 vs 컴포넌트 일부)
   - 몇 개 옵션이 적절한지 결정 (보통 3~8개)

2. **dev 환경 확인**

   `src/dev/` 폴더와 `src/main.tsx`에 `/dev/*` 라우트가 이미 있는지 확인.
   없으면 먼저 설정:
   - `src/main.tsx`에 `<Route path="/dev/*" element={<DevRoutes />} />` 추가
   - `src/dev/DevRoutes.tsx`, `src/dev/shared.tsx` 생성

3. **프리뷰 파일 생성**

   `src/dev/LayoutN.tsx` (또는 변경 대상에 맞는 이름으로) N개 파일 생성.
   각 파일은:
   - 독립적으로 동작하는 정적 프리뷰 (실제 API 호출 없음)
   - `MOCK_ARTICLES`나 적절한 목 데이터 사용
   - 하단에 `<Switcher current={N} />` 포함
   - 다른 스타일 컨셉 적용 (예: 사이드바 vs 탑 네비, 다크 vs 라이트 등)

4. **DevIndex 갱신**

   `src/dev/DevIndex.tsx`에 새로 추가된 옵션 카드 반영.

5. **사용자에게 안내**

   ```
   npm run dev 실행 후 http://localhost:5173/dev 에서 비교해보세요.
   - /dev/1 ~ /dev/N 을 둘러보고 마음에 드는 스타일을 알려주세요.
   - 특정 레이아웃의 요소만 가져오는 것도 가능합니다.
   ```

## 주의사항

- dev 프리뷰는 `src/dev/` 안에만 존재하고 실제 앱 코드에 영향을 주지 않음
- 인증 우회: `/dev/*` 라우트는 auth guard 없이 접근 가능하게 유지
- Tailwind inline styles 대신 utility class 사용 (단, 정확한 색상값이 필요한 경우 예외)
- 프리뷰 확정 후 `src/dev/` 폴더는 그대로 두거나 나중에 삭제
