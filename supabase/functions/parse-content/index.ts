import { createClient } from "@supabase/supabase-js";
import { detectSourceType, validateSourceUrl } from "./url-utils.ts";
import { runPipeline } from "./pipeline.ts";
import { recordAttempt } from "./attempts.ts";
import { ParseError } from "./errors.ts";
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

    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);
    const sourceType = detectSourceType(source_url);

    // 파싱 실패 응답. 링크가 저장됐으면 article_id를 함께 돌려준다.
    // 파싱 결과라 HTTP 200으로 보내고, 프론트는 success/error_code로 분기한다.
    const failure = (error: ParseError, articleId?: string, status = 200) =>
      new Response(
        JSON.stringify({
          success: false,
          error_code: error.code,
          message: error.message,
          article_id: articleId ?? null,
        }),
        {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );

    // SSRF 방지: URL 검증 (실패 시 글은 저장하지 않는다)
    const urlValidation = validateSourceUrl(source_url);
    if (!urlValidation.ok) {
      const error = new ParseError(
        "validate",
        "INVALID_URL",
        "user_action",
        urlValidation.reason,
      );
      await recordAttempt(supabaseAdmin, {
        trigger: "user",
        source_url,
        source_type: sourceType,
        status: "failed",
        error,
        duration_ms: elapsed(),
      });
      return failure(error);
    }

    // 콘텐츠 파싱
    const parsed = await runPipeline(source_url, { fetch });
    if (!parsed.ok) {
      // 최종 실패 → 원본 링크만 저장
      const { data: linkRow, error: linkError } = await supabaseAdmin
        .from("checkin_retrospectives")
        .insert({
          title: title?.trim() || source_url,
          member_id: user.id,
          source_url,
          source_type: parsed.source_type,
          content_markdown: "",
          content_html: null,
          parse_status: "failed",
          session,
          presentation_order: Math.floor(Math.random() * 1000) + 1,
        })
        .select("id")
        .single();

      if (linkError) {
        const storeError = new ParseError(
          "store",
          "STORE_FAILED",
          "transient",
          "글을 저장하지 못했어요",
          linkError.message,
        );
        await recordAttempt(supabaseAdmin, {
          trigger: "user",
          source_url,
          source_type: parsed.source_type,
          status: "failed",
          error: storeError,
          fetch_attempts: parsed.fetch_attempts,
          duration_ms: elapsed(),
        });
        return failure(storeError, undefined, 500);
      }

      await recordAttempt(supabaseAdmin, {
        trigger: "user",
        source_url,
        source_type: parsed.source_type,
        status: "failed",
        retrospective_id: linkRow.id,
        error: parsed.error,
        fetch_attempts: parsed.fetch_attempts,
        duration_ms: parsed.duration_ms,
      });
      return failure(parsed.error, linkRow.id);
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
        source_type: parsed.source_type,
        content_html: parsed.content_html,
        content_markdown: parsed.content_markdown,
        parse_status: "ok",
        session,
        presentation_order: Math.floor(Math.random() * 1000) + 1,
      })
      .select()
      .single();

    if (error) {
      const storeError = new ParseError(
        "store",
        "STORE_FAILED",
        "transient",
        "글을 저장하지 못했어요",
        error.message,
      );
      await recordAttempt(supabaseAdmin, {
        trigger: "user",
        source_url,
        source_type: parsed.source_type,
        status: "failed",
        error: storeError,
        fetch_attempts: parsed.fetch_attempts,
        duration_ms: elapsed(),
      });
      return failure(storeError, undefined, 500);
    }

    await recordAttempt(supabaseAdmin, {
      trigger: "user",
      source_url,
      source_type: parsed.source_type,
      status: "ok",
      retrospective_id: data.id,
      content_chars: parsed.content_markdown.length,
      fetch_attempts: parsed.fetch_attempts,
      tier: parsed.tier,
      quality_flags: parsed.quality_flags,
      duration_ms: parsed.duration_ms,
    });

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
