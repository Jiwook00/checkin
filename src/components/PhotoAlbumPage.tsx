import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Photo {
  name: string;
  url: string;
}

export default function PhotoAlbumPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Photo | null>(null);

  useEffect(() => {
    async function loadPhotos() {
      const { data } = await supabase.storage
        .from("checkin-images")
        .list("images/photo-album", {
          limit: 500,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (data) {
        const items = data
          .filter((f) => f.name !== ".emptyFolderPlaceholder")
          .map((f) => ({
            name: f.name,
            url: supabase.storage
              .from("checkin-images")
              .getPublicUrl(`images/photo-album/${f.name}`).data.publicUrl,
          }));
        setPhotos(items);
      }
      setLoading(false);
    }
    loadPhotos();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-stone-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-stone-400 text-sm">아직 사진이 없어요.</p>
      </div>
    );
  }

  if (selected) {
    const others = photos.filter((p) => p.name !== selected.name);

    return (
      <div className="bg-white">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
          <button
            onClick={() => setSelected(null)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-600 text-lg transition-colors"
          >
            ←
          </button>
          <div className="flex-1" />
          <button className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 transition-colors text-sm">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>11</span>
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors text-lg leading-none">
            ···
          </button>
          <button className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">
            저장
          </button>
        </div>

        {/* Main section: photo | comments [| photos at xl] */}
        <div className="flex flex-col md:flex-row border-b border-stone-100">
          {/* Selected photo */}
          <div className="md:w-1/2 xl:w-[40%] bg-stone-50 flex items-center justify-center p-4 md:p-8 md:border-r border-stone-100">
            <img
              src={selected.url}
              alt=""
              className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl"
            />
          </div>

          {/* Comment area */}
          <div className="md:w-1/2 xl:w-[30%] flex flex-col xl:border-r border-stone-100">
            <div className="flex-1 px-4 py-5 text-sm text-stone-400 text-center">
              아직 댓글이 없어요.
            </div>
            <div className="px-4 py-4 border-t border-stone-100">
              <div className="flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2.5 bg-white">
                <input
                  type="text"
                  placeholder="댓글을 추가하고 대화를 시작하세요."
                  readOnly
                  className="flex-1 text-sm text-stone-500 bg-transparent outline-none cursor-default placeholder:text-stone-400"
                />
                <div className="flex items-center gap-1 text-stone-400">
                  <button className="w-7 h-7 flex items-center justify-center hover:text-stone-600 transition-colors">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 13s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center hover:text-stone-600 transition-colors text-xs font-bold">
                    GIF
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center hover:text-stone-600 transition-colors">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Photos right column — xl only */}
          <div className="hidden xl:block xl:w-[30%] px-3 pt-3 overflow-y-auto max-h-[calc(70vh+4rem)]">
            <div className="columns-1 2xl:columns-2 gap-2">
              {others.map((photo) => (
                <img
                  key={photo.name}
                  src={photo.url}
                  alt=""
                  className="mb-2 w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity break-inside-avoid"
                  onClick={() => setSelected(photo)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom photos grid — xl 미만에서만 표시 */}
        <div className="xl:hidden px-3 pt-3 pb-8">
          <div className="columns-2 md:columns-3 lg:columns-4 gap-2">
            {others.map((photo) => (
              <img
                key={photo.name}
                src={photo.url}
                alt=""
                className="mb-2 w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity break-inside-avoid"
                onClick={() => setSelected(photo)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-2 px-2 md:px-4">
      {photos.map((photo) => (
        <img
          key={photo.name}
          src={photo.url}
          alt=""
          className="mb-2 w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity break-inside-avoid"
          onClick={() => setSelected(photo)}
        />
      ))}
    </div>
  );
}
