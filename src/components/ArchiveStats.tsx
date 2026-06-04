import type { Retrospective } from "../types";
import MemberAvatar from "./MemberAvatar";

interface MemberSummary {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  articleCount: number;
}

interface ArchiveStatsProps {
  articles: Retrospective[];
  members: MemberSummary[];
  selectedMemberId: string | null;
  onMemberClick: (memberId: string) => void;
}

export default function ArchiveStats({
  articles,
  members,
  selectedMemberId,
  onMemberClick,
}: ArchiveStatsProps) {
  const sessionCount = new Set(articles.map((a) => a.session)).size;
  const maxCount = members[0]?.articleCount ?? 1;

  return (
    <div className="px-8 py-10">
      {/* 상단 요약 통계 */}
      <div className="mb-10 grid grid-cols-3 gap-4 max-w-sm">
        {[
          { label: "총 글", value: articles.length },
          { label: "회고", value: sessionCount },
          { label: "멤버", value: members.length },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-3xl font-black text-ink leading-none">
              {value}
            </div>
            <div className="mt-1.5 text-[11px] font-medium text-muted">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 h-px w-full bg-hairline" />

      {/* 멤버별 회고 — 3열 프로필 카드 그리드 */}
      <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted">
        멤버별 회고
      </h3>
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        {members.map((member) => {
          const isSelected = selectedMemberId === member.member_id;
          return (
            <button
              key={member.member_id}
              onClick={() => onMemberClick(member.member_id)}
              className={`flex flex-col items-center rounded-[12px] px-3 py-5 text-center transition-all ${
                isSelected
                  ? "bg-primary shadow-lg"
                  : "bg-surface-soft hover:bg-surface-card"
              }`}
            >
              <MemberAvatar
                memberId={member.member_id}
                name={member.nickname}
                avatarUrl={member.avatar_url}
                size={44}
              />
              <div
                className={`mt-2.5 text-xs font-semibold leading-tight ${
                  isSelected ? "text-on-primary" : "text-body"
                }`}
              >
                {member.nickname}
              </div>
              <div
                className={`mt-1 text-2xl font-black leading-none ${
                  isSelected ? "text-on-primary" : "text-ink"
                }`}
              >
                {member.articleCount}
              </div>
              <div className="mt-2.5 w-full h-1 rounded-full bg-hairline">
                <div
                  className={`h-1 rounded-full transition-all ${
                    isSelected ? "bg-on-primary" : "bg-muted"
                  }`}
                  style={{
                    width: `${(member.articleCount / maxCount) * 100}%`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
