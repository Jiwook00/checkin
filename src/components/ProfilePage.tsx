import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

interface Member {
  id: string;
  email: string;
  nickname: string;
  avatar_url: string | null;
}

interface ProfilePageProps {
  member: Member;
  onAvatarUpdate: (url: string) => void;
}

export default function ProfilePage({
  member,
  onAvatarUpdate,
}: ProfilePageProps) {
  const [retroCount, setRetroCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("checkin_retrospectives")
      .select("*", { count: "exact", head: true })
      .eq("member_id", member.id)
      .then(({ count }) => setRetroCount(count ?? 0));
  }, [member.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const path = `avatars/${member.id}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("checkin-images")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("checkin-images")
        .getPublicUrl(path);

      const url = data.publicUrl;

      const { error: updateError } = await supabase
        .from("checkin_members")
        .update({ avatar_url: url })
        .eq("id", member.id);

      if (updateError) throw updateError;

      onAvatarUpdate(url);
    } finally {
      setUploading(false);
      // 같은 파일 재선택 가능하도록 초기화
      e.target.value = "";
    }
  };

  return (
    <div className="px-6 pt-10 pb-28 md:px-10 md:pt-10 md:pb-20">
      <div className="max-w-sm">
        {/* 아바타 + 정보 */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <button
              className="w-24 h-24 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-3xl font-semibold overflow-hidden cursor-pointer hover:brightness-90 active:brightness-75 transition-[filter] disabled:cursor-not-allowed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="프로필 사진 변경"
            >
              {uploading ? (
                <span className="text-base text-stone-400">업로드 중</span>
              ) : member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.nickname}
                  className="w-full h-full object-cover"
                />
              ) : (
                member.nickname.charAt(0)
              )}
            </button>
            <button
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-stone-900 flex items-center justify-center text-white text-xs shadow-md hover:bg-stone-700 active:bg-stone-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="프로필 사진 변경"
            >
              ✎
            </button>
          </div>
          <h1 className="text-xl font-bold text-stone-900 mb-1">
            {member.nickname}
          </h1>
          <p className="text-sm text-stone-400">{member.email}</p>
        </div>

        {/* 구분선 */}
        <div className="border-t border-stone-100 mb-8" />

        {/* 활동 통계 */}
        <div className="bg-stone-50 rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">
            활동
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">회고 작성</span>
            <span className="text-sm font-bold text-stone-900">
              {retroCount === null ? "…" : `${retroCount}건`}
            </span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
