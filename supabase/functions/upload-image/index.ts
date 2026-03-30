import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * SSRF 방지: http/https 스킴만 허용하고, 사설 IP 대역 차단
 */
function validateImageUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "유효하지 않은 URL입니다" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "http 또는 https URL만 허용됩니다" };
  }

  const hostname = url.hostname.toLowerCase();

  // localhost / loopback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return { ok: false, reason: "허용되지 않는 URL입니다" };
  }

  // IPv4 사설 대역 (10.x, 172.16-31.x, 192.168.x, 169.254.x)
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    ) {
      return { ok: false, reason: "허용되지 않는 URL입니다" };
    }
  }

  return { ok: true, url };
}

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
};

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "인증이 필요합니다" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabaseWithAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "유효하지 않은 세션입니다" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { image_url } = await req.json();
    if (!image_url) {
      return new Response(
        JSON.stringify({ success: false, error: "image_url이 필요합니다" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const urlValidation = validateImageUrl(image_url);
    if (!urlValidation.ok) {
      return new Response(
        JSON.stringify({ success: false, error: urlValidation.reason }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 이미지 다운로드
    const response = await fetch(urlValidation.url.toString());
    if (!response.ok) {
      throw new Error(`이미지 fetch 실패: ${response.status}`);
    }

    const contentType =
      response.headers.get("Content-Type")?.split(";")[0].trim() ?? "";
    const ext = CONTENT_TYPE_TO_EXT[contentType] ?? ".jpg";
    const arrayBuffer = await response.arrayBuffer();

    // Storage 업로드
    const hash = await sha256Hex(image_url);
    const timestamp = Date.now();
    const path = `images/${user.id}/${timestamp}-${hash}${ext}`;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { error: uploadError } = await supabaseAdmin.storage
      .from("checkin-images")
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (uploadError) {
      throw new Error(`스토리지 업로드 실패: ${uploadError.message}`);
    }

    const { data } = supabaseAdmin.storage
      .from("checkin-images")
      .getPublicUrl(path);

    return new Response(
      JSON.stringify({
        success: true,
        original_url: image_url,
        storage_url: data.publicUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
