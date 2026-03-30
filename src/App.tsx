import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import type {
  AddArticleForm,
  Announcement,
  Retrospective,
  VotePoll,
} from "./types";
import EditArticleModal from "./components/EditArticleModal";
import { getActivePoll } from "./lib/vote";
import Layout from "./components/Layout";
import SessionBanner from "./components/SessionBanner";
import SessionFilter from "./components/SessionFilter";
import ArticleList from "./components/ArticleList";
import ArticleReader from "./components/ArticleReader";
import AddArticleModal from "./components/AddArticleModal";
import LoginPage from "./components/LoginPage";
import VotePage from "./components/VotePage";
import AnnouncementBanner from "./components/AnnouncementBanner";
import UpdatesPage from "./components/UpdatesPage";
import { useAuth } from "./hooks/useAuth";
import ProfilePage from "./components/ProfilePage";
import ArchivePage from "./components/ArchivePage";

const BUCKET_PREFIX = "/checkin-images/";

function extractStorageImagePaths(
  html: string | null,
  markdown: string,
): string[] {
  const urls = new Set<string>();

  if (html) {
    const imgRegex = /<img[^>]+src="([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRegex.exec(html)) !== null) urls.add(m[1]);
  }

  const mdRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdRegex.exec(markdown)) !== null) urls.add(m[1]);

  const paths: string[] = [];
  for (const url of urls) {
    const idx = url.indexOf(BUCKET_PREFIX);
    if (idx !== -1) paths.push(url.slice(idx + BUCKET_PREFIX.length));
  }
  return paths;
}

export default function App() {
  const { authState, signInWithGoogle, signOut, updateMember } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [articles, setArticles] = useState<Retrospective[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(() => {
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [activePoll, setActivePoll] = useState<VotePoll | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [editingArticle, setEditingArticle] = useState<Retrospective | null>(
    null,
  );

  // 글 목록 가져오기
  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("checkin_retrospectives")
      .select("*, checkin_members!member_id(nickname, avatar_url)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setArticles(data);
    }
    setLoading(false);
  };

  const fetchAnnouncement = async () => {
    const { data } = await supabase
      .from("checkin_announcements")
      .select("*, checkin_members!created_by(nickname)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAnnouncement(data ?? null);
  };

  useEffect(() => {
    fetchArticles();
    getActivePoll().then(setActivePoll);
    fetchAnnouncement();
  }, []);

  const handleAddAnnouncement = async (content: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const { error } = await supabase.from("checkin_announcements").insert({
      content,
      created_by: sessionData.session.user.id,
    });
    if (error) throw new Error(error.message);
    await fetchAnnouncement();
  };

  const handleDeactivateAnnouncement = async (id: string) => {
    const { error } = await supabase
      .from("checkin_announcements")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw new Error(error.message);
    setAnnouncement(null);
  };

  const defaultSession = useMemo(() => {
    if (!activePoll?.confirmed_date) return undefined;
    const retroYear =
      activePoll.month === 1 ? activePoll.year - 1 : activePoll.year;
    const retroMonth = activePoll.month === 1 ? 12 : activePoll.month - 1;
    return `${retroYear}-${String(retroMonth).padStart(2, "0")}`;
  }, [activePoll]);

  // 최근 3개월 세션 목록 (동적 계산)
  const recentSessions = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, []);

  // 회차 내 정렬: presentation_order 높은 순, 없으면 등록 순
  const sortWithinSession = (arr: Retrospective[]): Retrospective[] =>
    [...arr].sort((a, b) => {
      if (a.session !== b.session) return b.session.localeCompare(a.session);
      if (a.presentation_order !== null && b.presentation_order !== null)
        return b.presentation_order - a.presentation_order;
      if (a.presentation_order !== null) return -1;
      if (b.presentation_order !== null) return 1;
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

  // 필터링된 글 목록
  const filteredArticles = useMemo(() => {
    const filtered = articles.filter((a) => {
      if (!recentSessions.includes(a.session)) return false;
      if (selectedSession && a.session !== selectedSession) return false;
      return true;
    });
    return sortWithinSession(filtered);
  }, [articles, recentSessions, selectedSession]);

  // 모바일용 — 세션 필터 없이 최근 전체
  const mobileArticles = useMemo(() => {
    const filtered = articles.filter((a) => recentSessions.includes(a.session));
    return sortWithinSession(filtered);
  }, [articles, recentSessions]);

  // 글 추가
  const handleAddArticle = async (
    form: AddArticleForm,
    setStatus: (s: string) => void,
  ): Promise<{ parseFailed: boolean; articleId: string }> => {
    const { data: sessionData, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError || !sessionData.session) {
      throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
    }
    const memberId = sessionData.session.user.id;

    setStatus("파싱 중...");
    const { data, error } = await supabase.functions.invoke("parse-content", {
      body: form,
    });

    const parseSucceeded = !error && data?.success;

    if (!parseSucceeded) {
      // 파싱 실패 시 원본 링크만 저장
      const detectSourceType = (
        url: string,
      ): "notion" | "tistory" | "other" => {
        if (url.includes("notion.so") || url.includes("notion.site"))
          return "notion";
        if (url.includes("tistory.com")) return "tistory";
        return "other";
      };

      const { data: insertData, error: insertError } = await supabase
        .from("checkin_retrospectives")
        .insert({
          member_id: memberId,
          title: form.title || form.source_url,
          source_url: form.source_url,
          source_type: detectSourceType(form.source_url),
          content_markdown: "",
          content_html: null,
          session: form.session,
        })
        .select("id")
        .single();

      if (insertError) throw new Error(insertError.message);

      await fetchArticles();
      return { parseFailed: true, articleId: insertData.id };
    }

    // 이미지 처리
    const imageUrls: string[] = data.image_urls ?? [];
    if (imageUrls.length > 0) {
      let processed = 0;
      setStatus(`이미지 처리 중... (0/${imageUrls.length})`);

      const results = await Promise.allSettled(
        imageUrls.map(async (url: string) => {
          const result = await supabase.functions.invoke("upload-image", {
            body: { image_url: url },
          });
          processed++;
          setStatus(`이미지 처리 중... (${processed}/${imageUrls.length})`);
          return result;
        }),
      );

      const urlMap = new Map<string, string>();
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.data?.storage_url) {
          urlMap.set(
            result.value.data.original_url,
            result.value.data.storage_url,
          );
        }
      }

      if (urlMap.size > 0) {
        let content_html: string = data.data.content_html ?? "";
        let content_markdown: string = data.data.content_markdown ?? "";

        for (const [original, uploaded] of urlMap) {
          content_html = content_html.replaceAll(
            `src="${original}"`,
            `src="${uploaded}"`,
          );
          content_markdown = content_markdown.replaceAll(
            `](${original})`,
            `](${uploaded})`,
          );
        }

        await supabase
          .from("checkin_retrospectives")
          .update({ content_html, content_markdown })
          .eq("id", data.data.id);
      }
    }

    // 목록 갱신
    await fetchArticles();
    return { parseFailed: false, articleId: data.data.id };
  };

  // 발표 순서 저장
  const handleUpdatePresentationOrder = async (
    articleId: string,
    score: number,
  ) => {
    const { error } = await supabase
      .from("checkin_retrospectives")
      .update({ presentation_order: score })
      .eq("id", articleId);
    if (error) throw new Error(error.message);
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId ? { ...a, presentation_order: score } : a,
      ),
    );
  };

  // 글 수정
  const handleEditArticle = async (
    id: string,
    data: { title: string; session: string },
  ) => {
    const { error } = await supabase
      .from("checkin_retrospectives")
      .update(data)
      .eq("id", id);
    if (error) throw new Error(error.message);
    await fetchArticles();
  };

  // 글 삭제
  const handleDeleteArticle = async (id: string) => {
    const article = articles.find((a) => a.id === id);
    if (article) {
      const storagePaths = extractStorageImagePaths(
        article.content_html,
        article.content_markdown,
      );
      if (storagePaths.length > 0) {
        await supabase.storage.from("checkin-images").remove(storagePaths);
      }
    }

    const { error } = await supabase
      .from("checkin_retrospectives")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  if (authState.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-400">로딩 중...</p>
      </div>
    );
  }

  if (authState.status === "unauthenticated") {
    return <LoginPage onLogin={signInWithGoogle} error={authState.error} />;
  }

  return (
    <Layout
      nickname={authState.member.nickname}
      onLogout={signOut}
      onAddClick={() => setShowAddModal(true)}
      fullBleed={location.pathname === "/archive"}
    >
      <Routes>
        <Route
          path="/"
          element={
            <>
              <AnnouncementBanner
                announcement={announcement}
                onAdd={handleAddAnnouncement}
                onDeactivate={handleDeactivateAnnouncement}
              />
              <SessionBanner
                onAddClick={() => setShowAddModal(true)}
                activePoll={activePoll}
              />
              <div className="hidden md:block">
                <SessionFilter
                  sessions={recentSessions}
                  selectedSession={selectedSession}
                  onSessionChange={setSelectedSession}
                />
              </div>
              {loading ? (
                <div className="py-20 text-center">
                  <p className="text-stone-400">불러오는 중...</p>
                </div>
              ) : (
                <ArticleList
                  articles={filteredArticles}
                  mobileArticles={mobileArticles}
                  onArticleClick={(article) =>
                    navigate(`/articles/${article.id}`)
                  }
                  currentMemberId={authState.member.id}
                  onEdit={setEditingArticle}
                  onDelete={handleDeleteArticle}
                />
              )}
            </>
          }
        />
        <Route
          path="/articles/:id"
          element={<ArticleReader articles={articles} />}
        />
        <Route path="/archive" element={<ArchivePage articles={articles} />} />
        <Route
          path="/vote"
          element={
            <>
              <AnnouncementBanner
                announcement={announcement}
                onAdd={handleAddAnnouncement}
                onDeactivate={handleDeactivateAnnouncement}
              />
              <VotePage
                memberId={authState.member.id}
                poll={activePoll}
                onPollChange={setActivePoll}
              />
            </>
          }
        />
        <Route path="/updates" element={<UpdatesPage />} />
        <Route
          path="/profile"
          element={
            <ProfilePage
              member={authState.member}
              onAvatarUpdate={(url) => updateMember({ avatar_url: url })}
            />
          }
        />
      </Routes>

      <AddArticleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddArticle}
        onSaveDiceScore={handleUpdatePresentationOrder}
        defaultSession={defaultSession}
      />

      <EditArticleModal
        isOpen={editingArticle !== null}
        article={editingArticle}
        onClose={() => setEditingArticle(null)}
        onSubmit={(data) => handleEditArticle(editingArticle!.id, data)}
      />
    </Layout>
  );
}
