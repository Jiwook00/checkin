import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { IS_LOCAL_SUPABASE, LOCAL_SEED_PASSWORD } from "../lib/local-dev";

export interface Member {
  id: string;
  email: string;
  nickname: string;
  avatar_url: string | null;
  // 관리자 화면 접근 여부. 서버(RLS·Edge Function)도 is_checkin_admin()으로 따로 막는다
  is_admin: boolean;
  // 디스코드 계정이 연결됐는지 (#102, 관리자가 SQL로 넣는다). id 값 자체는 앱에서 쓰지 않는다
  discord_linked: boolean;
  // 내 글에 달린 댓글을 디스코드 DM으로 받을지 (#105)
  notify_comment_dm: boolean;
  notify_comment_participant_dm: boolean;
}

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated"; error?: string }
  | { status: "authenticated"; member: Member };

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  // 로컬 Supabase 전용: 시드 계정으로 로그인한다. 그 뒤 흐름(화이트리스트 확인·upsert)은 Google과 같다
  const signInAsLocalSeed = async (email: string) => {
    if (!IS_LOCAL_SUPABASE) return;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: LOCAL_SEED_PASSWORD,
    });
    if (error) {
      setAuthState({
        status: "unauthenticated",
        error:
          "로컬 계정으로 로그인하지 못했습니다. supabase db reset으로 시드를 다시 넣어 보세요.",
      });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Google OAuth 콜백 후 이메일 검증 및 checkin_members upsert
  const validateAndUpsertMember = async (userId: string, email: string) => {
    // 화이트리스트 확인
    const { data: allowed } = await supabase
      .from("checkin_allowed_members")
      .select("nickname")
      .eq("email", email)
      .maybeSingle();

    if (!allowed) {
      await supabase.auth.signOut();
      setAuthState({
        status: "unauthenticated",
        error: "접근 권한이 없는 계정입니다.",
      });
      return;
    }

    // checkin_members upsert
    const { error } = await supabase
      .from("checkin_members")
      .upsert(
        { id: userId, email, nickname: allowed.nickname },
        { onConflict: "id" },
      );

    if (error) {
      await supabase.auth.signOut();
      setAuthState({
        status: "unauthenticated",
        error: "로그인 처리 중 오류가 발생했습니다.",
      });
      return;
    }

    const { data: memberData } = await supabase
      .from("checkin_members")
      .select(
        "avatar_url, is_admin, discord_user_id, notify_comment_dm, notify_comment_participant_dm",
      )
      .eq("id", userId)
      .single();

    setAuthState({
      status: "authenticated",
      member: {
        id: userId,
        email,
        nickname: allowed.nickname,
        avatar_url: memberData?.avatar_url ?? null,
        is_admin: memberData?.is_admin ?? false,
        discord_linked: memberData?.discord_user_id != null,
        notify_comment_dm: memberData?.notify_comment_dm ?? true,
        notify_comment_participant_dm:
          memberData?.notify_comment_participant_dm ?? true,
      },
    });
  };

  useEffect(() => {
    // onAuthStateChange가 마운트 시 INITIAL_SESSION 이벤트로 현재 세션을 즉시 전달하므로
    // 별도의 getSession() 호출 불필요
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setAuthState((prev) =>
          prev.status === "loading"
            ? { status: "unauthenticated" }
            : prev.status === "authenticated"
              ? { status: "unauthenticated" }
              : prev,
        );
        return;
      }
      const { id, email } = session.user;
      // INITIAL_SESSION: 기존 세션 복원 시에도 upsert 필요 (nickname 조회)
      validateAndUpsertMember(id, email ?? "");
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateMember = (updates: Partial<Member>) => {
    setAuthState((prev) =>
      prev.status === "authenticated"
        ? { ...prev, member: { ...prev.member, ...updates } }
        : prev,
    );
  };

  return {
    authState,
    signInWithGoogle,
    signInAsLocalSeed,
    signOut,
    updateMember,
  };
}
