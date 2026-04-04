interface ParsedContent {
  title: string;
  content_html: string;
  content_markdown: string;
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
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (items.length === 0) return result;

  const response = await fetch(
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

  if (!response.ok) return result;

  const data = (await response.json()) as { signedUrls: string[] };
  items.forEach(({ attachmentUrl }, i) => {
    const signed = data.signedUrls?.[i];
    if (signed) result.set(attachmentUrl, signed);
  });

  return result;
}

/**
 * 노션 공개 페이지에서 콘텐츠를 파싱한다.
 * Notion 비공개 API(/api/v3/loadPageChunk)에 직접 fetch → 블록 데이터 JSON → 마크다운 변환
 */
export async function parseNotion(pageId: string): Promise<ParsedContent> {
  const uuidPageId = pageId.includes("-") ? pageId : toUuid(pageId);

  const response = await fetch("https://www.notion.so/api/v3/loadPageChunk", {
    method: "POST",
    headers: NOTION_HEADERS,
    body: JSON.stringify({
      pageId: uuidPageId,
      limit: 100,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `노션 페이지를 가져올 수 없습니다: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { recordMap: RecordMap };
  const recordMap = data.recordMap;

  if (!recordMap || !recordMap.block) {
    throw new Error("노션 페이지 데이터가 올바르지 않습니다");
  }

  const blocks = recordMap.block;
  const blockIds = Object.keys(blocks);

  if (blockIds.length === 0) {
    throw new Error(
      "노션 페이지에서 블록을 가져오지 못했습니다. 페이지가 공개 상태인지 확인해주세요.",
    );
  }

  // 페이지 타이틀 추출
  const pageBlock = unwrapBlock(blocks[blockIds[0]]);
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
  const signedUrlMap = await resolveAttachmentUrls(attachmentItems);

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
  const contentHtml = JSON.stringify(recordMap); // 원본 보존용

  return {
    title,
    content_html: contentHtml,
    content_markdown: markdown,
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
