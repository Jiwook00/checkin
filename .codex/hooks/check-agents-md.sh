#!/bin/bash
# AGENTS.md 업데이트가 필요한지 감지하는 훅
# Stop 이벤트 시 실행 — AGENTS.md 관련 파일이 변경됐으면 알림

WATCHED=(
  "package.json"
  "vite.config.ts"
  "tsconfig.json"
  "tsconfig.app.json"
  "tsconfig.node.json"
  "eslint.config.js"
  ".prettierrc"
  "supabase/config.toml"
  "AGENTS.md"
)

# git이 없거나 repo가 아니면 조용히 종료
git rev-parse --is-inside-work-tree &>/dev/null || exit 0

changed=()
for f in "${WATCHED[@]}"; do
  if [[ -n "$(git -C "$(git rev-parse --show-toplevel)" status --porcelain -- "$f")" ]]; then
    changed+=("$f")
  fi
done

if (( ${#changed[@]} )); then
  jq -n --arg msg "변경된 파일: ${changed[*]}. 새 명령어, 의존성, 컨벤션이 생겼으면 AGENTS.md에 반영하세요." '{systemMessage: $msg}'
fi
