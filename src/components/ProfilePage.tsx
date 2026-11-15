import { useEffect, useRef, useState } from "react";
import type { Member } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import AvatarCropModal from "./AvatarCropModal";

interface ProfilePageProps {
  member: Member;
  onAvatarUpdate: (url: string) => void;
  onNotifyCommentDmChange: (value: boolean) => void;
}

export default function ProfilePage({
  member,
  onAvatarUpdate,
  onNotifyCommentDmChange,
}: ProfilePageProps) {
  const [retroCount, setRetroCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const [notifyError, setNotifyError] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("checkin_retrospectives")
      .select("*", { count: "exact", head: true })
      .eq("member_id", member.id)
      .then(({ count }) => setRetroCount(count ?? 0));
  }, [member.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setCropSrc(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleNotifyToggle = async () => {
    const next = !member.notify_comment_dm;
    setSavingNotify(true);
    setNotifyError(false);
    const { error } = await supabase
      .from("checkin_members")
      .update({ notify_comment_dm: next })
      .eq("id", member.id);
    setSavingNotify(false);
    if (error) {
      setNotifyError(true);
      return;
    }
    onNotifyCommentDmChange(next);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);
    setUploading(true);
    try {
      const path = `avatars/${member.id}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("checkin-images")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("checkin-images")
        .getPublicUrl(path);

      const url = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("checkin_members")
        .update({ avatar_url: url })
        .eq("id", member.id);

      if (updateError) throw updateError;

      onAvatarUpdate(url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-6 pt-10 pb-28 md:px-10 md:pt-10 md:pb-20">
      <div className="max-w-sm">
        {/* 아바타 + 정보 */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <button
              className="w-24 h-24 rounded-full bg-surface-card flex items-center justify-center text-muted text-3xl font-semibold overflow-hidden cursor-pointer hover:brightness-90 active:brightness-75 transition-[filter] disabled:cursor-not-allowed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="프로필 사진 변경"
            >
              {uploading ? (
                <span className="text-base text-muted">업로드 중</span>
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
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs shadow-md hover:bg-primary-active active:bg-primary-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="프로필 사진 변경"
            >
              ✎
            </button>
          </div>
          <h1 className="text-xl font-bold text-ink mb-1">{member.nickname}</h1>
          <p className="text-sm text-muted">{member.email}</p>
        </div>

        {/* 구분선 */}
        <div className="border-t border-hairline-soft mb-8" />

        {/* 활동 통계 */}
        <div className="bg-surface-card rounded-[12px] p-5">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
            활동
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-body">회고 작성</span>
            <span className="text-sm font-bold text-ink">
              {retroCount === null ? "…" : `${retroCount}건`}
            </span>
          </div>
        </div>

        {/* 알림 — 디스코드가 연결된 멤버에게만 (#105) */}
        {member.discord_linked && (
          <div className="bg-surface-card rounded-[12px] p-5 mt-4">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
              알림
            </h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p id="notify-comment-dm-label" className="text-sm text-body">
                  댓글 알림
                </p>
                <p className="text-xs text-muted mt-0.5">
                  내 회고에 댓글이 달리면 디스코드 DM으로 알려드려요
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={member.notify_comment_dm}
                aria-labelledby="notify-comment-dm-label"
                onClick={handleNotifyToggle}
                disabled={savingNotify}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  member.notify_comment_dm ? "bg-primary" : "bg-surface-strong"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-canvas shadow-sm transition-transform ${
                    member.notify_comment_dm ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
            {notifyError && (
              <p className="text-xs text-error mt-3">
                설정을 저장하지 못했어요. 다시 시도해 주세요.
              </p>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}
