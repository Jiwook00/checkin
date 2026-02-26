#!/bin/bash
# CLAUDE.md 업데이트가 필요한지 감지하는 훅
# Stop 이벤트 시 실행 — CLAUDE.md 관련 파일이 변경됐으면 알림

WATCHED=(
  "package.json"
  "vite.config.ts"
  "tsconfig.json"
  "tsconfig.app.json"
  "tsconfig.node.json"
  "eslint.config.js"
  ".prettierrc"
  "supabase/config.toml"
  "CLAUDE.md"
)

# git이 없거나 repo가 아니면 조용히 종료
git rev-parse --is-inside-work-tree &>/dev/null || exit 0

# HEAD 대비 변경된 파일 (staged + unstaged)
modified=$(git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null)
modified=$(echo "$modified" | sort -u)

changed=()
for f in "${WATCHED[@]}"; do
  if echo "$modified" | grep -qx "$f"; then
    changed+=("$f")
  fi
done

if [ ${#changed[@]} -gt 0 ]; then
  echo ""
  echo "📝 CLAUDE.md 업데이트 검토 필요"
  echo "   변경된 파일: ${changed[*]}"
  echo "   → 새 명령어, 의존성, 컨벤션이 생겼으면 CLAUDE.md에 반영하세요."
fi
