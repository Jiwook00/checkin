import { useNavigate } from "react-router-dom";
import type { Retrospective } from "../types";
import MemberAvatar from "./MemberAvatar";

interface MemberSummary {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  articleCount: number;
}

type MonthGroup = {
  session: string;
  label: string;
  articles: Retrospective[];
};

type YearGroup = {
  year: number;
  months: MonthGroup[];
};

interface ArchiveListProps {
  groupedArticles: YearGroup[];
  sessions: string[];
  members: MemberSummary[];
  searchQuery: string;
  selectedMemberId: string | null;
  selectedSession: string | null;
  selectedArticleId: string | null;
  onSearchChange: (q: string) => void;
  onMemberChange: (id: string | null) => void;
  onSessionChange: (session: string | null) => void;
  onArticleClick: (article: Retrospective) => void;
}

function formatSessionLabel(session: string): string {
  const [y, m] = session.split("-");
  return `${y}년 ${parseInt(m)}월`;
}

function extractPreview(markdown: string): string {
  return (
    markdown
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return (
          t && !t.startsWith("#") && !t.startsWith("-") && !t.startsWith("*")
        );
      })
      .join(" ")
      .slice(0, 140)
      .trim() || "..."
  );
}

export default function ArchiveList({
  groupedArticles,
  sessions,
  members,
  searchQuery,
  selectedMemberId,
  selectedSession,
  selectedArticleId,
  onSearchChange,
  onMemberChange,
  onSessionChange,
  onArticleClick,
}: ArchiveListProps) {
  const navigate = useNavigate();

  const totalFiltered = groupedArticles.reduce(
    (sum, yg) => sum + yg.months.reduce((s, mg) => s + mg.articles.length, 0),
    0,
  );

  return (
    <div className="flex h-full flex-col">
      {/* 필터 바 */}
      <div className="flex-shrink-0 space-y-2 border-b border-hairline-soft px-3 py-3">
        <input
          type="text"
          placeholder="제목 검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-[8px] border border-hairline bg-surface-card px-3 py-2 text-sm text-body outline-none placeholder:text-muted focus:border-muted focus:bg-canvas"
        />
        <div className="flex gap-2">
          <select
            value={selectedMemberId ?? ""}
            onChange={(e) => onMemberChange(e.target.value || null)}
            className="flex-1 rounded-[8px] border border-hairline bg-surface-card px-2 py-1.5 text-xs text-body outline-none focus:border-muted"
          >
            <option value="">전체 멤버</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.nickname}
              </option>
            ))}
          </select>
          <select
            value={selectedSession ?? ""}
            onChange={(e) => onSessionChange(e.target.value || null)}
            className="flex-1 rounded-[8px] border border-hairline bg-surface-card px-2 py-1.5 text-xs text-body outline-none focus:border-muted"
          >
            <option value="">전체 기간</option>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {formatSessionLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 글 목록 — 뉴스피드형 */}
      <div className="flex-1 overflow-y-auto">
        {totalFiltered === 0 ? (
          <div className="py-16 text-center text-xs text-muted">
            검색 결과가 없어요
          </div>
        ) : (
          groupedArticles.map((yearGroup) => (
            <div key={yearGroup.year}>
              {yearGroup.months.map((monthGroup) => (
                <div key={monthGroup.session}>
                  {/* 년월 헤더 — sticky */}
                  <div className="sticky top-0 z-10 border-b border-hairline bg-canvas px-4 py-2.5">
                    <span className="text-sm font-bold text-ink">
                      {formatSessionLabel(monthGroup.session)}
                    </span>
                  </div>
                  {/* 카드 목록 */}
                  {monthGroup.articles.map((article, idx) => {
                    const isSelected = article.id === selectedArticleId;
                    const nickname =
                      article.checkin_members?.nickname ?? "알 수 없음";
                    const isLast = idx === monthGroup.articles.length - 1;
                    return (
                      <button
                        key={article.id}
                        onClick={() => {
                          if (window.innerWidth < 768) {
                            navigate(`/articles/${article.id}`);
                          } else {
                            onArticleClick(article);
                          }
                        }}
                        className={`w-full px-4 py-4 text-left transition-colors ${
                          isSelected
                            ? "bg-primary"
                            : "bg-canvas hover:bg-surface-card"
                        } ${!isLast ? "border-b border-hairline-soft" : ""}`}
                      >
                        {/* 작성자 헤더 */}
                        <div className="mb-2 flex items-center gap-2">
                          <MemberAvatar
                            memberId={article.member_id}
                            name={nickname}
                            avatarUrl={article.checkin_members?.avatar_url}
                            size={22}
                          />
                          <span
                            className={`text-xs font-semibold ${
                              isSelected ? "text-on-primary/80" : "text-body"
                            }`}
                          >
                            {nickname}
                          </span>
                          <span
                            className={`text-[10px] ${
                              isSelected
                                ? "text-on-primary/40"
                                : "text-muted-soft"
                            }`}
                          >
                            ·
                          </span>
                          <span
                            className={`text-[10px] ${
                              isSelected ? "text-on-primary/40" : "text-muted"
                            }`}
                          >
                            {article.session}
                          </span>
                        </div>
                        {/* 제목 */}
                        <div
                          className={`mb-1.5 line-clamp-2 text-[15px] font-bold leading-snug ${
                            isSelected ? "text-on-primary" : "text-ink"
                          }`}
                        >
                          {article.title}
                        </div>
                        {/* 본문 미리보기 */}
                        <div
                          className={`line-clamp-3 text-xs leading-relaxed ${
                            isSelected ? "text-on-primary/55" : "text-muted"
                          }`}
                        >
                          {extractPreview(article.content_markdown)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
