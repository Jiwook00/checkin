interface SessionFilterProps {
  sessions: string[];
  authors: string[];
  selectedSession: string;
  selectedAuthor: string;
  onSessionChange: (session: string) => void;
  onAuthorChange: (author: string) => void;
}

export default function SessionFilter({
  sessions,
  authors,
  selectedSession,
  selectedAuthor,
  onSessionChange,
  onAuthorChange,
}: SessionFilterProps) {
  return (
    <div className="flex items-center gap-1.5 mb-7 border-b border-stone-100 pb-5">
      {["전체", ...sessions].map((s) => (
        <button
          key={s}
          onClick={() => onSessionChange(s === "전체" ? "" : s)}
          className={`text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
            (s === "전체" ? selectedSession === "" : selectedSession === s)
              ? "bg-stone-900 text-white"
              : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          }`}
        >
          {s}
        </button>
      ))}
      <span className="ml-auto">
        <select
          value={selectedAuthor}
          onChange={(e) => onAuthorChange(e.target.value)}
          className="text-xs text-stone-400 bg-transparent focus:outline-none cursor-pointer hover:text-stone-700"
        >
          <option value="">작성자: 전체</option>
          {authors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}
