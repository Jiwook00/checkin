import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  process.stderr.write("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY\n");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

type MemberJoin = { nickname: string; avatar_url?: string | null };

type RetroRow = {
  id: string;
  title: string;
  source_url: string;
  source_type: string;
  content_markdown: string;
  session: string;
  presentation_order: number | null;
  created_at: string;
  checkin_members: MemberJoin | MemberJoin[] | null;
};

function getMember(row: RetroRow): MemberJoin | null {
  if (!row.checkin_members) return null;
  return Array.isArray(row.checkin_members)
    ? (row.checkin_members[0] ?? null)
    : row.checkin_members;
}

async function listSessions(args: { year?: number }) {
  const { data, error } = await supabase
    .from("checkin_retrospectives")
    .select("session, checkin_members!member_id(nickname)")
    .order("session", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data as unknown as {
    session: string;
    checkin_members: MemberJoin | MemberJoin[] | null;
  }[];

  const sessionMap = new Map<string, Set<string>>();
  for (const row of rows) {
    if (args.year && !row.session.startsWith(`${args.year}-`)) continue;
    if (!sessionMap.has(row.session)) sessionMap.set(row.session, new Set());
    const m = Array.isArray(row.checkin_members)
      ? row.checkin_members[0]
      : row.checkin_members;
    const nickname = m?.nickname;
    if (nickname) sessionMap.get(row.session)!.add(nickname);
  }

  return Array.from(sessionMap.entries()).map(([session, members]) => ({
    session,
    count: members.size,
    members: Array.from(members).sort(),
  }));
}

async function getSessionRetrospectives(args: { session: string }) {
  const { data, error } = await supabase
    .from("checkin_retrospectives")
    .select(
      "id, title, source_url, source_type, content_markdown, session, presentation_order, created_at, checkin_members!member_id(nickname, avatar_url)",
    )
    .eq("session", args.session)
    .order("presentation_order", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data as unknown as RetroRow[]).map((r) => ({
    id: r.id,
    session: r.session,
    title: r.title,
    source_url: r.source_url,
    source_type: r.source_type,
    member: getMember(r)?.nickname ?? "unknown",
    content_markdown: r.content_markdown,
  }));
}

async function getMemberRetrospectives(args: {
  nickname?: string;
  session_from?: string;
  session_to?: string;
  limit?: number;
}) {
  let query = supabase
    .from("checkin_retrospectives")
    .select(
      "id, title, source_url, source_type, content_markdown, session, presentation_order, created_at, checkin_members!member_id(nickname)",
    )
    .order("session", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(args.limit ?? 20);

  if (args.session_from) query = query.gte("session", args.session_from);
  if (args.session_to) query = query.lte("session", args.session_to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = data as unknown as RetroRow[];

  // PostgREST join 필터는 부모 row를 제거하지 않으므로 JS에서 필터링
  if (args.nickname) {
    rows = rows.filter((r) => getMember(r)?.nickname === args.nickname);
  }

  return rows.map((r) => ({
    id: r.id,
    session: r.session,
    title: r.title,
    source_url: r.source_url,
    source_type: r.source_type,
    member: getMember(r)?.nickname ?? "unknown",
    content_markdown: r.content_markdown,
  }));
}

async function searchRetrospectives(args: { query: string; limit?: number }) {
  const { data, error } = await supabase
    .from("checkin_retrospectives")
    .select(
      "id, title, source_url, session, content_markdown, checkin_members!member_id(nickname)",
    )
    .or(`title.ilike.%${args.query}%,content_markdown.ilike.%${args.query}%`)
    .order("session", { ascending: false })
    .limit(args.limit ?? 10);

  if (error) throw new Error(error.message);

  return (data as unknown as RetroRow[]).map((r) => {
    const excerpt = extractExcerpt(r.content_markdown, args.query);
    return {
      id: r.id,
      session: r.session,
      title: r.title,
      source_url: r.source_url,
      member: getMember(r)?.nickname ?? "unknown",
      excerpt,
    };
  });
}

function extractExcerpt(content: string, query: string): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1)
    return content.slice(0, 300) + (content.length > 300 ? "..." : "");
  const start = Math.max(0, idx - 100);
  const end = Math.min(content.length, idx + 200);
  const excerpt = content.slice(start, end);
  return (
    (start > 0 ? "..." : "") + excerpt + (end < content.length ? "..." : "")
  );
}

const server = new Server(
  { name: "checkin-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_sessions",
      description:
        "checkin 회고 세션 목록을 조회합니다. 각 세션의 참여 멤버와 회고 수를 반환합니다.",
      inputSchema: {
        type: "object",
        properties: {
          year: {
            type: "integer",
            description: "특정 연도로 필터링 (예: 2025). 생략 시 전체 조회",
          },
        },
        required: [],
      },
    },
    {
      name: "get_session_retrospectives",
      description:
        "특정 세션의 모든 회고를 가져옵니다. 전체 마크다운 내용을 포함합니다.",
      inputSchema: {
        type: "object",
        properties: {
          session: {
            type: "string",
            description: "세션 식별자 (예: '2025-06'). YYYY-MM 형식",
          },
        },
        required: ["session"],
      },
    },
    {
      name: "get_member_retrospectives",
      description:
        "특정 멤버(또는 전체 멤버)의 회고를 가져옵니다. 세션 범위로 필터링 가능합니다.",
      inputSchema: {
        type: "object",
        properties: {
          nickname: {
            type: "string",
            description:
              "멤버 닉네임 (예: '대니', '아이리스'). 생략 시 전체 멤버 조회",
          },
          session_from: {
            type: "string",
            description: "시작 세션 (포함). 예: '2025-01'",
          },
          session_to: {
            type: "string",
            description: "종료 세션 (포함). 예: '2025-06'",
          },
          limit: {
            type: "integer",
            description: "최대 결과 수. 기본값 20",
          },
        },
        required: [],
      },
    },
    {
      name: "search_retrospectives",
      description:
        "회고 제목과 내용에서 텍스트를 검색합니다. 매칭된 부분의 excerpt를 반환합니다.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "검색어",
          },
          limit: {
            type: "integer",
            description: "최대 결과 수. 기본값 10",
          },
        },
        required: ["query"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case "list_sessions":
        result = await listSessions(args as { year?: number });
        break;
      case "get_session_retrospectives":
        result = await getSessionRetrospectives(args as { session: string });
        break;
      case "get_member_retrospectives":
        result = await getMemberRetrospectives(
          args as {
            nickname?: string;
            session_from?: string;
            session_to?: string;
            limit?: number;
          },
        );
        break;
      case "search_retrospectives":
        result = await searchRetrospectives(
          args as { query: string; limit?: number },
        );
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
