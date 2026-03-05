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
    <div className="flex items-center gap-1.5 mb-7 border-b border-stone-100 pb-5">
      {sessions.map((s) => (
        <button
          key={s}
          onClick={() => onSessionChange(selectedSession === s ? "" : s)}
          className={`text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
            selectedSession === s
              ? "bg-stone-900 text-white"
              : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
