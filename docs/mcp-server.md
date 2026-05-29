# Checkin MCP 서버

Claude 데스크탑 앱 또는 Claude Code에서 회고 데이터를 자연어로 조회할 수 있는 MCP 서버입니다.

## 사전 준비

MCP 서버를 처음 사용하거나 코드를 수정한 경우 빌드가 필요합니다.

```bash
cd mcp
npm install
npm run build
```

빌드 결과물은 `mcp/dist/index.js`에 생성됩니다.

## 설정 방법

### Claude Code에 요청하기 (가장 쉬운 방법)

이 프로젝트가 열려 있는 Claude Code 세션에서 아래와 같이 말하면 자동으로 설정해줍니다.

```
checkin MCP 서버를 Claude 데스크탑 앱에서도 사용할 수 있도록 설정해줘
```

Claude Code가 `claude_desktop_config.json`을 직접 수정해주며, 재시작 안내까지 해줍니다.

---

### 직접 설정하기

#### Claude 데스크탑 앱

`~/Library/Application Support/Claude/claude_desktop_config.json`의 `mcpServers`에 아래 내용을 추가합니다.

```json
{
  "mcpServers": {
    "checkin": {
      "command": "node",
      "args": ["/절대경로/checkin/mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://kwipabophlxkaibkclut.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service_role_key>"
      }
    }
  }
}
```

`/절대경로/checkin`은 이 저장소를 클론한 경로로 변경하세요. (예: `/Users/yourname/projects/checkin`)  
`SUPABASE_SERVICE_ROLE_KEY`는 팀 채널에서 공유된 값을 사용하세요.

설정 후 Claude 데스크탑 앱을 완전히 재시작하면 적용됩니다.

#### Claude Code (CLI)

프로젝트 루트의 `.mcp.json`에 이미 설정이 포함되어 있습니다. Claude Code를 실행하면 자동으로 로드됩니다.

## 사용 가능한 툴

| 툴                           | 설명                       | 주요 파라미터                            |
| ---------------------------- | -------------------------- | ---------------------------------------- |
| `list_sessions`              | 전체 세션 목록 조회        | `year` (선택)                            |
| `get_session_retrospectives` | 특정 세션의 모든 회고 조회 | `session` (예: `"2026-04"`)              |
| `get_member_retrospectives`  | 특정 멤버의 회고 조회      | `nickname`, `session_from`, `session_to` |
| `search_retrospectives`      | 제목·내용 전문 검색        | `query`                                  |

## 사용 예시

Claude에게 자연어로 질문하면 됩니다.

```
지난달 대니 회고 보여줘
2026-03 세션에 참여한 멤버 목록 알려줘
"커피"가 언급된 회고 찾아줘
아이리스의 올해 회고 전부 가져와줘
```
