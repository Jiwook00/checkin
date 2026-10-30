// 관리자 전용 Edge Function의 인증 (#79)
//
// verify_jwt=false로 두고(parse-content와 같음) 함수 안에서 JWT로 유저를 확인한 뒤, 관리자 여부는 SQL 함수
// is_checkin_admin()에 묻는다. 관리자 판별의 단일 출처가 그 함수라서 RLS·앱 라우트 가드와 어긋나지 않는다.
// 통과하면 service role 클라이언트를 돌려준다 (DB 읽기·쓰기는 service role로 한다).

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { fail } from "./http.ts";

export interface AdminContext {
  user: User;
  admin: SupabaseClient;
}

/** 통과하면 AdminContext, 아니면 그대로 돌려줄 Response(401/403) */
export async function authenticateAdmin(
  req: Request,
): Promise<AdminContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail(401, "UNAUTHENTICATED", "인증이 필요합니다");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const asUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await asUser.auth.getUser();
  if (userError || !user) {
    return fail(401, "INVALID_SESSION", "유효하지 않은 세션입니다");
  }
  const { data: isAdmin } = await asUser.rpc("is_checkin_admin");
  if (isAdmin !== true) {
    return fail(403, "FORBIDDEN", "관리자만 사용할 수 있습니다");
  }
  return { user, admin: createClient(supabaseUrl, supabaseServiceKey) };
}
