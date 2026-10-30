// Edge Function 공용 응답 헬퍼 (#79). CORS 헤더는 parse-content와 같다

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export const fail = (status: number, error_code: string, message: string) =>
  json(status, { ok: false, error_code, message });
