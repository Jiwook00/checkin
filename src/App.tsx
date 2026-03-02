import { useEffect, useMemo, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./lib/supabase";
import type { AddArticleForm, Retrospective } from "./types";
import Layout from "./components/Layout";
import SessionBanner from "./components/SessionBanner";
import SessionFilter from "./components/SessionFilter";
import ArticleList from "./components/ArticleList";
import ArticleReader from "./components/ArticleReader";
import AddArticleModal from "./components/AddArticleModal";
import LoginPage from "./components/LoginPage";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { authState, signInWithGoogle, signOut } = useAuth();
  const [articles, setArticles] = useState<Retrospective[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Retrospective | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState("");

  // 글 목록 가져오기
  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("retrospectives")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setArticles(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  // 필터 옵션 추출
  const sessions = useMemo(
    () => [...new Set(articles.map((a) => a.session))].sort().reverse(),
    [articles],
  );
  const authors = useMemo(
    () => [...new Set(articles.map((a) => a.author))].sort(),
    [articles],
  );

  // 필터링된 글 목록
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (selectedSession && a.session !== selectedSession) return false;
      if (selectedAuthor && a.author !== selectedAuthor) return false;
      return true;
    });
  }, [articles, selectedSession, selectedAuthor]);

  // 글 추가
  const handleAddArticle = async (form: AddArticleForm) => {
    const { data, error } = await supabase.functions.invoke("parse-content", {
      body: form,
    });

    if (error) {
      throw new Error(error.message || "서버 오류가 발생했습니다");
    }

    if (!data.success) {
      throw new Error(data.error || "파싱에 실패했습니다");
    }

    // 목록 갱신
    await fetchArticles();
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

  // 리더 뷰가 열려 있으면 리더만 표시
  if (selectedArticle) {
    return (
      <ArticleReader
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    );
  }

  return (
    <Layout nickname={authState.member.nickname} onLogout={signOut}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <SessionBanner onAddClick={() => setShowAddModal(true)} />
              <SessionFilter
                sessions={sessions}
                authors={authors}
                selectedSession={selectedSession}
                selectedAuthor={selectedAuthor}
                onSessionChange={setSelectedSession}
                onAuthorChange={setSelectedAuthor}
              />
              {loading ? (
                <div className="py-20 text-center">
                  <p className="text-stone-400">불러오는 중...</p>
                </div>
              ) : (
                <ArticleList
                  articles={filteredArticles}
                  onArticleClick={setSelectedArticle}
                />
              )}
            </>
          }
        />
        <Route
          path="/archive"
          element={
            <div className="py-20 text-center text-stone-400">
              아카이브 (준비 중)
            </div>
          }
        />
        <Route
          path="/vote"
          element={
            <div className="py-20 text-center text-stone-400">
              투표 (준비 중)
            </div>
          }
        />
        <Route
          path="/profile"
          element={
            <div className="py-20 text-center text-stone-400">
              프로필 (준비 중)
            </div>
          }
        />
      </Routes>

      <AddArticleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddArticle}
      />
    </Layout>
  );
}
