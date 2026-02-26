Create a new GitHub issue based on the current conversation context or diff.

## Steps

1. **컨텍스트 수집**

   다음을 함께 확인:
   - 현재 대화에서 논의된 문제나 기능 요구사항
   - `git diff HEAD` (변경사항이 있다면)
   - `gh label list` — 사용 가능한 라벨 목록

2. **이슈 초안 작성**

   아래 형식으로 초안을 보여주기:

   ```
   제목: <한국어, 50자 이내>
   라벨: <type: bug / type: feature / type: chore 중 하나> + <phase: 라벨 있으면 추가>

   본문:
   ## 배경
   (왜 이 작업이 필요한지)

   ## 작업 내용
   - [ ] 항목 1
   - [ ] 항목 2

   ## 참고
   (관련 파일, 링크 등 있으면)
   ```

3. **확인 요청**

   > 이 이슈를 생성할까요? (y / edit / cancel)
   - `y` → `gh issue create --title "..." --body "..." --label "..."` 실행 후 이슈 URL 출력
   - `edit` → 수정할 부분 물어보고 다시 보여준 뒤 재확인
   - `cancel` → 중단
