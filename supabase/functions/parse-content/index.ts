import { createClient } from "@supabase/supabase-js";
import {
  detectSourceType,
  extractNotionPageId,
  validateSourceUrl,
} from "./url-utils.ts";
import { parseBlog } from "./blog-parser.ts";
import { parseNotion } from "./notion-parser.ts";
import { extractUrls } from "./image-processor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // CORS preflight
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
    // 호출자 인증 검증
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

    // JWT로 유저 확인
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

    // 화이트리스트 확인
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: allowed } = await supabaseAdmin
      .from("checkin_allowed_members")
      .select("nickname")
      .eq("email", user.email)
      .maybeSingle();
    if (!allowed) {
      return new Response(
        JSON.stringify({ success: false, error: "접근 권한이 없습니다" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { title, source_url, session } = await req.json();

    // 입력 검증
    if (!source_url || !session) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "필수 필드가 누락되었습니다 (source_url, session)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // SSRF 방지: URL 검증
    const urlValidation = validateSourceUrl(source_url);
    if (!urlValidation.ok) {
      return new Response(
        JSON.stringify({ success: false, error: urlValidation.reason }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // URL 타입 판별
    const sourceType = detectSourceType(source_url);

    // 콘텐츠 파싱
    let parsed: {
      title: string;
      content_html: string;
      content_markdown: string;
    };

    if (sourceType === "notion") {
      const pageId = extractNotionPageId(source_url);
      if (!pageId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "노션 페이지 ID를 추출할 수 없습니다",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      parsed = await parseNotion(pageId);
    } else {
      parsed = await parseBlog(source_url);
    }

    // 제목: 사용자 입력 우선, 없으면 파싱된 제목 사용
    const finalTitle = title?.trim() || parsed.title;

    // 이미지 URL 목록 추출 (프론트에서 개별 처리)
    const image_urls = extractUrls(
      parsed.content_html,
      parsed.content_markdown,
    );

    // Supabase에 저장 (원본 이미지 URL 그대로)
    const { data, error } = await supabaseAdmin
      .from("checkin_retrospectives")
      .insert({
        title: finalTitle,
        member_id: user.id,
        source_url,
        source_type: sourceType,
        content_html: parsed.content_html,
        content_markdown: parsed.content_markdown,
        session,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`DB 저장 실패: ${error.message}`);
    }

    return new Response(JSON.stringify({ success: true, data, image_urls }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
