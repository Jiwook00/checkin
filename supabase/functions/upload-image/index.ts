import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // 이미지 다운로드
    const response = await fetch(image_url);
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
