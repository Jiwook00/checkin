현재 브랜치의 변경사항을 분석해서 이 프로젝트의 PR 템플릿(.github/PULL_REQUEST_TEMPLATE.md)에 맞춰 Pull Request를 생성해줘.

## Steps

1. 다음을 병렬로 실행:
   - `git branch --show-current` — 현재 브랜치 확인 및 이슈 번호 추출 (e.g. `feat/issue-9-foo` → `#9`)
   - `git log main..HEAD --oneline` — 이 브랜치의 커밋 목록 확인
   - `git diff main...HEAD` — 변경 내용 전체 확인

2. **브랜치 push 여부 확인**: 리모트에 없으면 `git push -u origin <브랜치명>` 먼저 실행.

3. **PR 본문 작성** — 아래 템플릿을 그대로 사용:

```
## 변경 사항

<!-- 무엇을 왜 변경했는지 설명 -->

## 관련 항목

Closes #이슈번호

---

<details>
<summary>AI 협업 로그 (선택)</summary>

**사용 도구**: Claude Code

**작업 요약**: (이 작업에서 AI와 함께 한 것을 한 문장으로)

**핵심 프롬프트**:

> (핵심이 됐던 지시사항이나 질문 2~3개를 원문 그대로 인용)

**주요 결정**:

- (AI 제안을 수용/수정/거절한 중요한 결정들. 수정/거절했다면 이유도 함께)

</details>
```

### 작성 규칙

- **변경 사항**: diff와 커밋 내용을 바탕으로 "무엇을, 왜"를 설명. 기술적 배경이 있으면 포함.
- **관련 항목**: 브랜치명에서 이슈 번호가 감지되면 `Closes #번호` 포함. 없으면 생략.
- **AI 협업 로그**: 현재 대화 컨텍스트를 바탕으로 자동 작성. 핵심 프롬프트는 사용자 발언을 원문 그대로 인용.

4. **PR 제목**: Conventional Commits 형식, 한국어, 72자 이내.

   ```
   feat: 짧은 설명
   ```

5. `gh pr create --title "..." --body "..."` 로 PR 생성 후 URL 출력.
