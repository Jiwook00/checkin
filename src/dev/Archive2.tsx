// Archive Preview 2 — "컬러 어센트형"
// 왼쪽: 멤버 색상 기반 왼쪽 테두리 어센트 카드. 제목+미리보기+작성자를 컴팩트하게.
// 오른쪽: 대시보드형 — 상단 요약 통계 + 멤버 3열 프로필 카드 그리드.

import { useState, useMemo } from "react";
import { memberColorClass } from "../lib/vote";
import { MOCK_ARTICLES, MOCK_MEMBERS } from "./archive-mock";
import type { MockArticle } from "./archive-mock";

// 멤버별 컬러 어센트 (border-l)
const MEMBER_BORDER_COLORS: Record<string, string> = {
  m1: "border-l-violet-400",
  m2: "border-l-sky-400",
  m3: "border-l-emerald-400",
  m4: "border-l-amber-400",
  m5: "border-l-rose-400",
  m6: "border-l-indigo-400",
};

const MEMBER_BAR_COLORS: Record<string, string> = {
  m1: "bg-violet-400",
  m2: "bg-sky-400",
  m3: "bg-emerald-400",
  m4: "bg-amber-400",
  m5: "bg-rose-400",
  m6: "bg-indigo-400",
};

function Avatar({
  memberId,
  name,
  avatarUrl,
  size,
}: {
  memberId: string;
  name: string;
  avatarUrl: string | null;
  size: number;
}) {
  const colorClass = `${memberColorClass(memberId)} text-white`;
  const fontSize =
    size <= 24 ? "text-[10px]" : size <= 36 ? "text-xs" : "text-sm";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-bold ${colorClass}`}
      style={{ width: size, height: size }}
    >
      <span className={fontSize}>{name[0]}</span>
    </div>
  );
}

function ArchiveSwitcher({ current }: { current: number }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-1 bg-white/95 backdrop-blur-sm rounded-full shadow-lg px-2 py-1.5 border border-stone-200 z-50">
      {[
        { n: 1, label: "미니멀 카드형" },
        { n: 2, label: "컬러 어센트형" },
        { n: 3, label: "뉴스피드형" },
      ].map(({ n, label }) => (
        <a
          key={n}
          href={`/dev/archive-${n}`}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            current === n
              ? "bg-stone-900 text-white"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          {label}
        </a>
      ))}
      <a
        href="/archive"
        className="px-3 py-1 rounded-full text-xs font-medium text-stone-400 hover:text-stone-900 transition-colors border-l border-stone-200 ml-1 pl-3"
      >
        현재 버전
      </a>
    </div>
  );
}

type MonthGroup = { session: string; label: string; articles: MockArticle[] };
type YearGroup = { year: number; months: MonthGroup[] };

function buildGroups(articles: MockArticle[]): YearGroup[] {
  const sessionMap = new Map<string, MockArticle[]>();
  for (const a of articles) {
    if (!sessionMap.has(a.session)) sessionMap.set(a.session, []);
    sessionMap.get(a.session)!.push(a);
  }
  const yearMap = new Map<number, MonthGroup[]>();
  for (const [session, arts] of [...sessionMap.entries()].sort(([a], [b]) =>
    b.localeCompare(a),
  )) {
    const [y, m] = session.split("-");
    const year = +y;
    const label = `${parseInt(m)}월`;
    if (!yearMap.has(year)) yearMap.set(year, []);
    yearMap.get(year)!.push({ session, label, articles: arts });
  }
  return [...yearMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({ year, months }));
}

function DashboardRight({
  selectedMemberId,
  onMemberClick,
}: {
  selectedMemberId: string | null;
  onMemberClick: (id: string) => void;
}) {
  const totalArticles = MOCK_ARTICLES.length;
  const totalSessions = new Set(MOCK_ARTICLES.map((a) => a.session)).size;
  const totalMembers = MOCK_MEMBERS.length;
  const maxCount = MOCK_MEMBERS[0].articleCount;

  return (
    <div className="px-8 py-10">
      {/* 상단 요약 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-10 max-w-sm">
        {[
          { label: "총 글", value: totalArticles },
          { label: "회고", value: totalSessions },
          { label: "멤버", value: totalMembers },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-3xl font-black text-stone-900 leading-none">
              {value}
            </div>
            <div className="mt-1.5 text-[11px] text-stone-400 font-medium">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="w-full h-px bg-stone-100 mb-8" />

      {/* 멤버별 회고 */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-5">
        멤버별 회고
      </h3>
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        {MOCK_MEMBERS.map((member) => {
          const isSelected = selectedMemberId === member.member_id;
          const barColor =
            MEMBER_BAR_COLORS[member.member_id] ?? "bg-stone-400";
          return (
            <button
              key={member.member_id}
              onClick={() => onMemberClick(member.member_id)}
              className={`flex flex-col items-center rounded-2xl px-3 py-5 text-center transition-all ${
                isSelected
                  ? "bg-stone-900 shadow-lg"
                  : "bg-stone-50 hover:bg-stone-100"
              }`}
            >
              <Avatar
                memberId={member.member_id}
                name={member.nickname}
                avatarUrl={member.avatar_url}
                size={44}
              />
              <div
                className={`mt-2.5 text-xs font-semibold leading-tight ${
                  isSelected ? "text-white" : "text-stone-700"
                }`}
              >
                {member.nickname}
              </div>
              <div
                className={`mt-1 text-2xl font-black leading-none ${
                  isSelected ? "text-white" : "text-stone-900"
                }`}
              >
                {member.articleCount}
              </div>
              <div className="mt-2.5 w-full h-1 rounded-full bg-stone-200">
                <div
                  className={`h-1 rounded-full transition-all ${
                    isSelected ? "bg-white" : barColor
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

export default function Archive2() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null,
  );

  const sessions = useMemo(
    () =>
      [...new Set(MOCK_ARTICLES.map((a) => a.session))].sort((a, b) =>
        b.localeCompare(a),
      ),
    [],
  );

  const filtered = useMemo(
    () =>
      MOCK_ARTICLES.filter((a) => {
        if (selectedMemberId && a.member_id !== selectedMemberId) return false;
        if (selectedSession && a.session !== selectedSession) return false;
        if (
          searchQuery &&
          !a.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
          return false;
        return true;
      }),
    [selectedMemberId, selectedSession, searchQuery],
  );

  const grouped = useMemo(() => buildGroups(filtered), [filtered]);
  const selectedArticle =
    MOCK_ARTICLES.find((a) => a.id === selectedArticleId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* 좌 패널 */}
      <div
        className="flex-shrink-0 flex flex-col h-full border-r border-stone-100 overflow-hidden"
        style={{ width: "clamp(300px, 30vw, 460px)" }}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-stone-100">
          <div className="text-xs font-black text-stone-900 tracking-tight mb-3">
            Archive
          </div>
          <input
            type="text"
            placeholder="제목 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 focus:bg-white mb-2"
          />
          <div className="flex gap-2">
            <select
              value={selectedMemberId ?? ""}
              onChange={(e) => setSelectedMemberId(e.target.value || null)}
              className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-600 outline-none focus:border-stone-400"
            >
              <option value="">전체 멤버</option>
              {MOCK_MEMBERS.map((m) => (
                <option key={m.member_id} value={m.member_id}>
                  {m.nickname}
                </option>
              ))}
            </select>
            <select
              value={selectedSession ?? ""}
              onChange={(e) => setSelectedSession(e.target.value || null)}
              className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-600 outline-none focus:border-stone-400"
            >
              <option value="">전체 기간</option>
              {sessions.map((s) => {
                const [y, m] = s.split("-");
                return (
                  <option key={s} value={s}>
                    {y}년 {parseInt(m)}월
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* 글 목록 — 컬러 어센트 카드형 */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {grouped.length === 0 ? (
            <div className="py-16 text-center text-xs text-stone-400">
              결과 없음
            </div>
          ) : (
            grouped.map((yg) => (
              <div key={yg.year} className="mb-5">
                <div className="px-1 py-1 text-[11px] font-black text-stone-300 tracking-widest uppercase mb-1">
                  {yg.year}
                </div>
                {yg.months.map((mg) => (
                  <div key={mg.session} className="mb-4">
                    <div className="px-1 pb-1.5 text-xs font-semibold text-stone-400 flex items-center justify-between">
                      <span>{mg.label}</span>
                      <span className="text-stone-300">
                        {mg.articles.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {mg.articles.map((article) => {
                        const isSelected = article.id === selectedArticleId;
                        const nick = article.checkin_members.nickname;
                        const borderColor =
                          MEMBER_BORDER_COLORS[article.member_id] ??
                          "border-l-stone-300";
                        return (
                          <button
                            key={article.id}
                            onClick={() =>
                              setSelectedArticleId(
                                isSelected ? null : article.id,
                              )
                            }
                            className={`w-full rounded-lg border-l-4 px-3 py-2.5 text-left transition-all ${
                              isSelected
                                ? "bg-stone-900 border-l-stone-900"
                                : `bg-stone-50 hover:bg-white hover:shadow-sm ${borderColor}`
                            }`}
                          >
                            {/* 제목 */}
                            <div
                              className={`text-[13px] font-semibold leading-snug line-clamp-1 mb-1 ${
                                isSelected ? "text-white" : "text-stone-900"
                              }`}
                            >
                              {article.title}
                            </div>
                            {/* 본문 미리보기 */}
                            <div
                              className={`text-[11px] leading-relaxed line-clamp-2 mb-2 ${
                                isSelected ? "text-white/55" : "text-stone-400"
                              }`}
                            >
                              {article.preview_text}
                            </div>
                            {/* 작성자 */}
                            <div className="flex items-center gap-1.5">
                              <Avatar
                                memberId={article.member_id}
                                name={nick}
                                avatarUrl={article.checkin_members.avatar_url}
                                size={16}
                              />
                              <span
                                className={`text-[10px] font-medium ${
                                  isSelected
                                    ? "text-white/60"
                                    : "text-stone-500"
                                }`}
                              >
                                {nick}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 우 패널 */}
      <div className="flex-1 overflow-y-auto">
        {selectedArticle ? (
          <div className="h-full">
            <div className="sticky top-0 z-10 border-b border-stone-100 bg-white/90 backdrop-blur-sm">
              <div className="flex items-center justify-between px-8 py-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    memberId={selectedArticle.member_id}
                    name={selectedArticle.checkin_members.nickname}
                    avatarUrl={selectedArticle.checkin_members.avatar_url}
                    size={28}
                  />
                  <span className="text-sm font-medium text-stone-700">
                    {selectedArticle.checkin_members.nickname}
                  </span>
                  <span className="text-stone-300">·</span>
                  <span className="text-xs text-stone-400">
                    {selectedArticle.session}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedArticleId(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="px-8 py-10 max-w-3xl">
              <h1 className="mb-8 text-2xl font-bold leading-tight text-stone-900">
                {selectedArticle.title}
              </h1>
              <div className="prose prose-stone max-w-none prose-p:leading-relaxed">
                <h2>들어가며</h2>
                <p>이번 회고는 지난 한 달을 돌아보는 시간이었습니다.</p>
                <h3>잘한 것</h3>
                <ul>
                  <li>매일 꾸준히 코드를 작성했습니다</li>
                  <li>팀원과의 소통을 늘렸습니다</li>
                </ul>
                <h3>아쉬운 것</h3>
                <ul>
                  <li>문서 작성을 미뤘습니다</li>
                </ul>
                <h2>마무리</h2>
                <p>다음 달에는 더 나은 개발자가 되겠습니다.</p>
              </div>
            </div>
          </div>
        ) : (
          <DashboardRight
            selectedMemberId={selectedMemberId}
            onMemberClick={(id) =>
              setSelectedMemberId((prev) => (prev === id ? null : id))
            }
          />
        )}
      </div>

      <ArchiveSwitcher current={2} />
    </div>
  );
}
