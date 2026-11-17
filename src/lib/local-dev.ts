// 로컬 Supabase(`supabase start`)에 붙은 개발 서버에서만 쓰는 값 (#130).
// 운영 빌드에서는 import.meta.env.DEV가 false라서 IS_LOCAL_SUPABASE도 false가 되고, 로컬 로그인 UI는 번들에서 빠진다.

const LOCAL_HOSTS = ["127.0.0.1", "localhost"];

function isLocalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export const IS_LOCAL_SUPABASE =
  import.meta.env.DEV && isLocalUrl(import.meta.env.VITE_SUPABASE_URL);

// supabase/seed.sql의 계정과 같아야 한다
export const LOCAL_SEED_PASSWORD = "checkin-local";

export const LOCAL_SEED_ACCOUNTS = [
  { email: "admin@checkin.local", nickname: "관리자" },
  { email: "minji@checkin.local", nickname: "민지" },
  { email: "junho@checkin.local", nickname: "준호" },
  { email: "seoyeon@checkin.local", nickname: "서연" },
] as const;
