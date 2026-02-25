import { NotionAPI } from "notion-client";

interface ParsedContent {
  title: string;
  content_html: string;
  content_markdown: string;
}

const notion = new NotionAPI();

/**
 * 노션 공개 페이지에서 콘텐츠를 파싱한다.
 * notion-client (비공식 API) → 블록 데이터 JSON → 마크다운 변환
 */
export async function parseNotion(pageId: string): Promise<ParsedContent> {
  const recordMap = await notion.getPage(pageId);

  if (!recordMap || !recordMap.block) {
    throw new Error("노션 페이지를 가져올 수 없습니다");
  }

  const blocks = recordMap.block;
  const blockIds = Object.keys(blocks);

  // 페이지 타이틀 추출
  const pageBlock = blocks[blockIds[0]]?.value;
  let title = "제목 없음";
  if (pageBlock?.properties?.title) {
    title = extractText(pageBlock.properties.title);
  }

  // 블록들을 마크다운으로 변환
  const markdownLines: string[] = [];

  for (const blockId of blockIds) {
    const block = blocks[blockId]?.value;
    if (!block) continue;

    const line = blockToMarkdown(block);
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
 */
function blockToMarkdown(block: Record<string, unknown>): string | null {
  const type = block.type as string;
  const properties = block.properties as
    | Record<string, unknown[][]>
    | undefined;
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
      const source =
        (block.format as Record<string, unknown>)?.display_source ||
        properties?.source?.[0]?.[0] ||
        "";
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
