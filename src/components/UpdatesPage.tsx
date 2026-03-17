import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface GithubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

export default function UpdatesPage() {
  const [releases, setReleases] = useState<GithubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("https://api.github.com/repos/Jiwook00/checkin/releases")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: GithubRelease[]) => {
        setReleases(data);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-stone-400">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-stone-400">업데이트 정보를 불러오지 못했습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-900 mb-8">업데이트</h1>
      <div className="space-y-12">
        {releases.map((release) => (
          <div key={release.id}>
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-base font-semibold text-stone-900">
                {release.name}
              </h2>
              <span className="text-xs text-stone-400">
                {new Date(release.published_at).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="prose prose-sm prose-stone max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {release.body}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
