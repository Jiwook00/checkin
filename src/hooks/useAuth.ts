import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Member {
  id: string;
  email: string;
  nickname: string;
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

    setAuthState({
      status: "authenticated",
      member: { id: userId, email, nickname: allowed.nickname },
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

  return { authState, signInWithGoogle, signOut };
}
