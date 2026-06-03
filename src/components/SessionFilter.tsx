interface SessionFilterProps {
  sessions: string[];
  selectedSession: string;
  onSessionChange: (session: string) => void;
}

export default function SessionFilter({
  sessions,
  selectedSession,
  onSessionChange,
}: SessionFilterProps) {
  return (
    <div
      role="radiogroup"
      aria-label="회차 필터"
      className="flex items-center gap-1 mb-7 border-b border-hairline pb-5"
    >
      {sessions.map((s) => (
        <button
          key={s}
          role="radio"
          aria-checked={selectedSession === s}
          onClick={() => onSessionChange(selectedSession === s ? "" : s)}
          className={`text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
            selectedSession === s
              ? "bg-primary text-on-primary font-semibold"
              : "text-muted hover:text-ink hover:bg-surface-card"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
