interface SessionFilterProps {
  sessions: string[]
  authors: string[]
  selectedSession: string
  selectedAuthor: string
  onSessionChange: (session: string) => void
  onAuthorChange: (author: string) => void
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
    <div className="flex flex-wrap gap-3">
      <select
        value={selectedSession}
        onChange={(e) => onSessionChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-gray-500 focus:outline-none"
      >
        <option value="">전체 회차</option>
        {sessions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={selectedAuthor}
        onChange={(e) => onAuthorChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-gray-500 focus:outline-none"
      >
        <option value="">전체 작성자</option>
        {authors.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  )
}
