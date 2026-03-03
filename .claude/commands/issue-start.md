Start working on a GitHub issue. Usage: /issue-start <issue-number>

## Steps

1. **이슈 정보 가져오기**

   Run:

   ```
   gh issue view $ARGUMENTS --json number,title,body,labels
   ```

   이슈가 없으면 "이슈 #$ARGUMENTS 를 찾을 수 없습니다." 라고 알리고 중단. 이슈의 코멘트까지 확인해서 컨텍스트를 더 잘 이해할 수 있도록 한다.

2. **브랜치명 제안**

   라벨 기반으로 prefix 결정:
   - `type: bug` → `fix/`
   - `type: feature` → `feat/`
   - `type: chore` → `chore/`
   - 그 외 → `feat/`

   이슈 제목을 영어 소문자 + 하이픈으로 변환 (짧게, 최대 5단어):

   ```
   fix/issue-6-parser-improvement
   feat/issue-9-member-access-control
   ```

   제안 브랜치명을 보여주고 사용자에게 묻기:

   > 이 브랜치명으로 생성할까요? (y / 직접 입력 / cancel)

3. **브랜치 생성**

   확인되면:

   ```
   git checkout -b <branch-name>
   ```

4. **작업 컨텍스트 제공**

   이슈 제목, 본문, 라벨을 정리해서 보여주며 작업 준비 완료를 알림.
   추가로 물어볼 것: "어디서부터 시작할까요?"
