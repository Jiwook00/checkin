import { useMemo, useState } from "react";
import type { Retrospective } from "../types";
import ArchiveList from "./ArchiveList";
import ArchiveStats from "./ArchiveStats";
import ArticlePanel from "./ArticlePanel";

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

interface ArchivePageProps {
  articles: Retrospective[];
}

export default function ArchivePage({ articles }: ArchivePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null,
  );

  const selectedArticle =
    articles.find((a) => a.id === selectedArticleId) ?? null;

  // 멤버별 글 수 집계 (내림차순)
  const members: MemberSummary[] = useMemo(() => {
    const map = new Map<string, MemberSummary>();
    for (const a of articles) {
      if (!map.has(a.member_id)) {
        map.set(a.member_id, {
          member_id: a.member_id,
          nickname: a.checkin_members?.nickname ?? "알 수 없음",
          avatar_url: a.checkin_members?.avatar_url ?? null,
          articleCount: 0,
        });
      }
      map.get(a.member_id)!.articleCount++;
    }
    return [...map.values()].sort((a, b) => b.articleCount - a.articleCount);
  }, [articles]);

  // 세션 목록 (내림차순)
  const sessions: string[] = useMemo(
    () =>
      [...new Set(articles.map((a) => a.session))].sort((a, b) =>
        b.localeCompare(a),
      ),
    [articles],
  );

  // 필터 적용된 글 목록
  const filteredArticles = useMemo(
    () =>
      articles.filter((a) => {
        if (selectedMemberId && a.member_id !== selectedMemberId) return false;
        if (selectedSession && a.session !== selectedSession) return false;
        if (
          searchQuery &&
          !a.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
          return false;
        return true;
      }),
    [articles, selectedMemberId, selectedSession, searchQuery],
  );

  // 년/월별 그루핑
  const groupedArticles: YearGroup[] = useMemo(() => {
    const sessionMap = new Map<string, Retrospective[]>();
    for (const a of filteredArticles) {
      if (!sessionMap.has(a.session)) sessionMap.set(a.session, []);
      sessionMap.get(a.session)!.push(a);
    }
    const yearMap = new Map<number, MonthGroup[]>();
    for (const [session, arts] of [...sessionMap.entries()].sort(([a], [b]) =>
      b.localeCompare(a),
    )) {
      const [y, m] = session.split("-");
      const year = +y;
      const label = `${parseInt(m)}월 (${arts.length})`;
      if (!yearMap.has(year)) yearMap.set(year, []);
      yearMap.get(year)!.push({ session, label, articles: arts });
    }
    return [...yearMap.entries()]
      .sort(([a], [b]) => b - a)
      .map(([year, months]) => ({ year, months }));
  }, [filteredArticles]);

  const handleMemberClick = (memberId: string) => {
    setSelectedMemberId((prev) => (prev === memberId ? null : memberId));
    setSelectedArticleId(null);
  };

  return (
    <div className="flex h-full overflow-hidden pt-14 md:pt-0">
      {/* 좌 패널 — 글 목록 */}
      <div className="flex h-full w-full flex-shrink-0 flex-col overflow-hidden border-r border-stone-100 md:w-[22rem] lg:w-[26rem]">
        <ArchiveList
          groupedArticles={groupedArticles}
          sessions={sessions}
          members={members}
          searchQuery={searchQuery}
          selectedMemberId={selectedMemberId}
          selectedSession={selectedSession}
          selectedArticleId={selectedArticleId}
          onSearchChange={setSearchQuery}
          onMemberChange={setSelectedMemberId}
          onSessionChange={setSelectedSession}
          onArticleClick={(article) => setSelectedArticleId(article.id)}
        />
      </div>

      {/* 우 패널 — 통계 or 아티클 */}
      <div className="hidden flex-1 overflow-y-auto md:block">
        {selectedArticle ? (
          <ArticlePanel
            article={selectedArticle}
            onClose={() => setSelectedArticleId(null)}
          />
        ) : (
          <ArchiveStats
            articles={articles}
            members={members}
            selectedMemberId={selectedMemberId}
            onMemberClick={handleMemberClick}
          />
        )}
      </div>
    </div>
  );
}
