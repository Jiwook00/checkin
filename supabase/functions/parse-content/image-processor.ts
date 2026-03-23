import { SupabaseClient } from "@supabase/supabase-js";

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
};

export function extractUrls(html: string, markdown: string): string[] {
  const urls = new Set<string>();

  // HTML: <img src="...">
  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  // Markdown: ![...](url)
  const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((match = mdImgRegex.exec(markdown)) !== null) {
    urls.add(match[1]);
  }

  return Array.from(urls);
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function uploadImage(
  url: string,
  userId: string,
  timestamp: number,
  supabaseAdmin: SupabaseClient,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch 실패: ${response.status}`);
  }

  const contentType =
    response.headers.get("Content-Type")?.split(";")[0].trim() ?? "";
  const ext = CONTENT_TYPE_TO_EXT[contentType] ?? ".jpg";

  const arrayBuffer = await response.arrayBuffer();
  const hash = await sha256Hex(url);
  const path = `images/${userId}/${timestamp}-${hash}${ext}`;

  const { error } = await supabaseAdmin.storage
    .from("checkin-images")
    .upload(path, arrayBuffer, { contentType, upsert: true });

  if (error) {
    throw new Error(`스토리지 업로드 실패: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from("checkin-images")
    .getPublicUrl(path);
  return data.publicUrl;
}

export async function processImages(
  html: string,
  markdown: string,
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<{ content_html: string; content_markdown: string }> {
  const urls = extractUrls(html, markdown);
  if (urls.length === 0) {
    return { content_html: html, content_markdown: markdown };
  }

  const timestamp = Date.now();

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const publicUrl = await uploadImage(
        url,
        userId,
        timestamp,
        supabaseAdmin,
      );
      return { original: url, uploaded: publicUrl };
    }),
  );

  const urlMap = new Map<string, string>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      urlMap.set(result.value.original, result.value.uploaded);
    }
  }

  if (urlMap.size === 0) {
    return { content_html: html, content_markdown: markdown };
  }

  let newHtml = html;
  let newMarkdown = markdown;

  for (const [original, uploaded] of urlMap) {
    // HTML: src="<url>"
    newHtml = newHtml.replaceAll(`src="${original}"`, `src="${uploaded}"`);
    // Markdown: ](<url>)
    newMarkdown = newMarkdown.replaceAll(`](${original})`, `](${uploaded})`);
  }

  return { content_html: newHtml, content_markdown: newMarkdown };
}
