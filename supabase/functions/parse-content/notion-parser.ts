import { ParseError } from "./errors.ts";
import { fetchWithPolicy } from "./fetch-policy.ts";

interface ParsedContent {
  title: string;
  content_html: string;
  content_markdown: string;
  // 본문이 끝까지 수집되지 못했을 때만 채운다 (예: NOTION_TRUNCATED)
  quality_flags?: string[];
}

interface NotionBlockValue {
  id: string;
  type: string;
  properties?: Record<string, unknown[][]>;
  format?: Record<string, unknown>;
  content?: string[];
}

interface NotionBlock {
  spaceId?: string;
  value: NotionBlockValue | { value: NotionBlockValue };
}

interface RecordMap {
  block: Record<string, NotionBlock>;
}

interface PageChunkCursor {
  stack: unknown[][];
}

interface PageChunkResponse {
  recordMap: RecordMap;
  cursor?: PageChunkCursor;
}

// 한 페이지에서 받아 오는 블록 상한. 넘으면 중단하고 NOTION_TRUNCATED로 표시한다
const MAX_BLOCKS = 1000;
// 커서가 끝나지 않는 비정상 응답에 대한 안전장치
const MAX_CHUNKS = 30;
// syncRecordValues 한 번에 요청하는 블록 수와 보충 라운드 상한
const SYNC_BATCH = 100;
const SYNC_ROUNDS = 3;

// 구 API: block.value = NotionBlockValue
// 신 API: block.value = { value: NotionBlockValue }
function unwrapBlock(
  block: NotionBlock | undefined,
): NotionBlockValue | undefined {
  if (!block?.value) return undefined;
  if ("type" in block.value) return block.value as NotionBlockValue;
  if ("value" in block.value)
    return (block.value as { value: NotionBlockValue }).value;
  return undefined;
}

const NOTION_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; RetroReader/1.0; +https://retro-reader.app)",
};

function toUuid(id: string): string {
  // 32자 hex → 8-4-4-4-12 UUID 형식으로 변환
  const hex = id.replace(/-/g, "");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * attachment: URL 목록을 Notion getSignedFileUrls API로 실제 다운로드 URL로 변환한다.
 * 실패 시 빈 Map 반환 (이미지 없이 진행).
 */
async function resolveAttachmentUrls(
  items: Array<{ attachmentUrl: string; blockId: string }>,
  fetchFn: typeof fetch,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (items.length === 0) return result;

  // 서명 URL은 부가 정보라 실패해도 이미지 없이 진행한다
  let data: { signedUrls?: string[] };
  try {
    const { body } = await fetchWithPolicy(
      fetchFn,
      "https://www.notion.so/api/v3/getSignedFileUrls",
      {
        method: "POST",
        headers: NOTION_HEADERS,
        body: JSON.stringify({
          urls: items.map(({ attachmentUrl, blockId }) => ({
            url: attachmentUrl,
            permissionRecord: { table: "block", id: blockId },
          })),
        }),
      },
    );
    data = JSON.parse(body);
  } catch {
    return result;
  }

  items.forEach(({ attachmentUrl }, i) => {
    const signed = data.signedUrls?.[i];
    if (signed) result.set(attachmentUrl, signed);
  });

  return result;
}

/**
 * loadPageChunk 한 청크를 가져온다. 청크 0의 요청 본문은 벤치 스냅샷 키와 같아야 하므로
 * 필드 순서와 값을 바꾸지 않는다.
 */
async function loadPageChunk(
  pageId: string,
  cursor: PageChunkCursor,
  chunkNumber: number,
  fetchFn: typeof fetch,
): Promise<PageChunkResponse> {
  const { body } = await fetchWithPolicy(
    fetchFn,
    "https://www.notion.so/api/v3/loadPageChunk",
    {
      method: "POST",
      headers: NOTION_HEADERS,
      body: JSON.stringify({
        pageId,
        limit: 100,
        cursor,
        chunkNumber,
        verticalColumns: false,
      }),
    },
  );

  try {
    return JSON.parse(body) as PageChunkResponse;
  } catch (err) {
    throw new ParseError(
      "extract",
      "NOTION_SCHEMA",
      "structural",
      "노션 페이지 데이터가 올바르지 않습니다",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * 페이지 블록의 content 트리를 따라가며 맵에 없는 자식 id를 모은다.
 * 하위 페이지는 제목만 쓰므로 그 안으로 내려가지 않는다.
 */
function collectMissingIds(
  blocks: Record<string, NotionBlock>,
  rootId: string,
): string[] {
  const missing: string[] = [];
  const visited = new Set<string>();
  const stack = [rootId];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const block = unwrapBlock(blocks[id]);
    if (!block) {
      missing.push(id);
      continue;
    }
    if (block.type === "page" && id !== rootId) continue;
    for (const childId of block.content ?? []) stack.push(childId);
  }
  return missing;
}

/**
 * loadPageChunk가 내려주지 않는 블록(토글 자식 등)을 syncRecordValues로 보충한다.
 * 보충은 부가 정보라 요청이나 응답 파싱이 실패하면 빠진 채로 진행한다.
 */
async function fillMissingBlocks(
  blocks: Record<string, NotionBlock>,
  rootId: string,
  fetchFn: typeof fetch,
): Promise<void> {
  const requested = new Set<string>();

  for (let round = 0; round < SYNC_ROUNDS; round++) {
    const missing = collectMissingIds(blocks, rootId).filter(
      (id) => !requested.has(id),
    );
    if (missing.length === 0) return;

    for (let i = 0; i < missing.length; i += SYNC_BATCH) {
      const batch = missing.slice(i, i + SYNC_BATCH);
      for (const id of batch) requested.add(id);

      try {
        const { body } = await fetchWithPolicy(
          fetchFn,
          "https://www.notion.so/api/v3/syncRecordValues",
          {
            method: "POST",
            headers: NOTION_HEADERS,
            body: JSON.stringify({
              requests: batch.map((id) => ({
                pointer: { table: "block", id },
                version: -1,
              })),
            }),
          },
        );
        const data = JSON.parse(body) as { recordMap?: Partial<RecordMap> };
        Object.assign(blocks, data.recordMap?.block ?? {});
      } catch {
        return;
      }
    }
  }
}

/**
 * 노션 공개 페이지에서 콘텐츠를 파싱한다.
 * Notion 비공개 API(/api/v3/loadPageChunk)에 직접 fetch → 블록 데이터 JSON → 마크다운 변환
 */
export async function parseNotion(
  pageId: string,
  fetchFn: typeof fetch,
): Promise<ParsedContent> {
  const uuidPageId = pageId.includes("-") ? pageId : toUuid(pageId);

  const data = await loadPageChunk(uuidPageId, { stack: [] }, 0, fetchFn);
  const recordMap = data?.recordMap;

  if (!recordMap || typeof recordMap !== "object") {
    throw new ParseError(
      "extract",
      "NOTION_SCHEMA",
      "structural",
      "노션 페이지 데이터가 올바르지 않습니다",
      `응답 키: ${Object.keys(data ?? {}).join(",")}`,
    );
  }

  // 비공개 페이지는 200 + recordMap에 block 없이(__version__만) 내려온다
  if (!recordMap.block) {
    throw new ParseError(
      "extract",
      "NOTION_PRIVATE",
      "user_action",
      "노션 페이지를 가져오지 못했습니다. 페이지가 공개 상태인지 확인해주세요.",
      `recordMap 키: ${Object.keys(recordMap).join(",")}`,
    );
  }

  if (Object.keys(recordMap.block).length === 0) {
    throw new ParseError(
      "extract",
      "NOTION_PRIVATE",
      "user_action",
      "노션 페이지에서 블록을 가져오지 못했습니다. 페이지가 공개 상태인지 확인해주세요.",
    );
  }

  // 커서가 남아 있으면 끝까지 이어 받는다. 청크 0은 위에서 검증했으므로
  // 이후 청크가 실패하면 받은 데까지만 쓰고 잘림으로 표시한다
  const blocks: Record<string, NotionBlock> = { ...recordMap.block };
  let truncated = false;
  let cursor = data.cursor;
  let chunkNumber = 1;
  while (cursor?.stack?.length) {
    if (Object.keys(blocks).length >= MAX_BLOCKS || chunkNumber >= MAX_CHUNKS) {
      truncated = true;
      break;
    }
    try {
      const next = await loadPageChunk(
        uuidPageId,
        cursor,
        chunkNumber,
        fetchFn,
      );
      Object.assign(blocks, next.recordMap?.block ?? {});
      cursor = next.cursor;
      chunkNumber++;
    } catch {
      truncated = true;
      break;
    }
  }

  // 응답에 없는 자식 블록(토글 안쪽 등) 보충
  await fillMissingBlocks(blocks, uuidPageId, fetchFn);

  const blockIds = Object.keys(blocks);

  // 페이지 타이틀 추출 (키 순서가 아니라 페이지 id로 찾는다)
  const pageBlock = unwrapBlock(blocks[uuidPageId] ?? blocks[blockIds[0]]);
  let title = "제목 없음";
  if (pageBlock?.properties?.title) {
    title = extractText(pageBlock.properties.title);
  }

  // image 블록의 attachment: URL → blockId 매핑 수집
  const attachmentItems: Array<{ attachmentUrl: string; blockId: string }> = [];
  for (const blockId of blockIds) {
    const block = unwrapBlock(blocks[blockId]);
    if (!block || block.type !== "image") continue;

    const source =
      ((block.format as Record<string, unknown>)?.display_source as string) ||
      (block.properties?.source?.[0]?.[0] as string) ||
      "";

    if (source.startsWith("attachment:")) {
      attachmentItems.push({ attachmentUrl: source, blockId });
    }
  }

  // attachment: URL을 실제 다운로드 URL로 일괄 변환
  const signedUrlMap = await resolveAttachmentUrls(attachmentItems, fetchFn);

  // 블록들을 마크다운으로 변환
  const markdownLines: string[] = [];

  for (const blockId of blockIds) {
    const block = unwrapBlock(blocks[blockId]);
    if (!block) continue;

    const line = blockToMarkdown(block, signedUrlMap);
    if (line !== null) {
      markdownLines.push(line);
    }
  }

  const markdown = markdownLines.join("\n\n");
  // 원본 보존용. 페이지네이션·보충으로 합친 블록 전체를 담는다
  const contentHtml = JSON.stringify({ ...recordMap, block: blocks });

  return {
    title,
    content_html: contentHtml,
    content_markdown: markdown,
    ...(truncated ? { quality_flags: ["NOTION_TRUNCATED"] } : {}),
  };
}

/**
 * 노션의 rich text 배열에서 평문 텍스트를 추출한다.
 * 포맷: [["text", [["b"], ["i"]]], ["more text"]]
 */
function extractText(richTextArray: unknown[][]): string {
  if (!Array.isArray(richTextArray)) return "";

  return richTextArray
    .map((segment) => {
      if (!Array.isArray(segment)) return "";
      const text = segment[0] || "";
      const decorations = segment[1] as unknown[][] | undefined;

      if (!decorations || decorations.length === 0) {
        return String(text);
      }

      let result = String(text);
      for (const decoration of decorations) {
        const type = decoration[0];
        if (type === "b") result = `**${result}**`;
        else if (type === "i") result = `*${result}*`;
        else if (type === "s") result = `~~${result}~~`;
        else if (type === "c") result = `\`${result}\``;
        else if (type === "a") result = `[${result}](${decoration[1]})`;
      }
      return result;
    })
    .join("");
}

/**
 * 단일 노션 블록을 마크다운 문자열로 변환한다.
 * signedUrlMap: attachment: URL → 실제 다운로드 URL 매핑
 */
function blockToMarkdown(
  block: NotionBlockValue,
  signedUrlMap: Map<string, string>,
): string | null {
  const type = block.type;
  const properties = block.properties;
  const text = properties?.title ? extractText(properties.title) : "";

  switch (type) {
    case "page":
      // 페이지 블록 자체는 건너뜀 (타이틀은 별도 추출)
      return null;

    case "text":
    case "paragraph":
      return text || "";

    case "header":
      return `# ${text}`;

    case "sub_header":
      return `## ${text}`;

    case "sub_sub_header":
      return `### ${text}`;

    case "bulleted_list":
      return `- ${text}`;

    case "numbered_list":
      return `1. ${text}`;

    case "to_do": {
      const checked = properties?.checked?.[0]?.[0] === "Yes";
      return `- [${checked ? "x" : " "}] ${text}`;
    }

    case "toggle":
      return `<details><summary>${text}</summary></details>`;

    case "quote":
      return `> ${text}`;

    case "callout":
      return `> ${text}`;

    case "code": {
      const language =
        (properties?.language?.[0]?.[0] as string)?.toLowerCase() || "";
      return `\`\`\`${language}\n${text}\n\`\`\``;
    }

    case "divider":
      return "---";

    case "image": {
      const rawSource =
        ((block.format as Record<string, unknown>)?.display_source as string) ||
        (properties?.source?.[0]?.[0] as string) ||
        "";
      // attachment: URL은 signed URL로 교체, 없으면 스킵
      const source = rawSource.startsWith("attachment:")
        ? (signedUrlMap.get(rawSource) ?? "")
        : rawSource;
      return source ? `![image](${source})` : null;
    }

    case "bookmark": {
      const link = properties?.link?.[0]?.[0] || "";
      const bookmarkTitle = properties?.title
        ? extractText(properties.title)
        : link;
      return link ? `[${bookmarkTitle}](${link})` : null;
    }

    case "equation": {
      return `$$\n${text}\n$$`;
    }

    case "table_of_contents":
      return null;

    case "column_list":
    case "column":
      return null;

    default:
      // 알 수 없는 블록 타입은 텍스트가 있으면 출력
      return text || null;
  }
}
