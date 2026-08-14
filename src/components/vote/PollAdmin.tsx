import { useState } from "react";
import type { PollFormData, VotePoll } from "../../types";
import { DAY_NAMES } from "../../types";
import type {
  UpdatePollMetaData,
  UpdatePollScheduleData,
} from "../../lib/vote";

export type PollType = "online" | "offline";

// --- 날짜 유틸 ---

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// 현재 달 기준 범위 모드 기본값
// - 온라인: 1~10일
// - 오프라인: 첫째·둘째 주말을 포함하는 범위 (첫 토요일 ~ +8일)
function defaultRange(isOnline: boolean): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1~12
  if (isOnline) {
    return { from: ymd(year, month, 1), to: ymd(year, month, 10) };
  }
  let firstSat = 1;
  while (new Date(year, month - 1, firstSat).getDay() !== 6) firstSat++;
  return {
    from: ymd(year, month, firstSat),
    to: ymd(year, month, firstSat + 8),
  };
}

// --- MiniMonthPicker: 특정 날짜 탭 선택용 미니 캘린더 ---

function MiniMonthPicker({
  year,
  month, // 1~12
  selected,
  onToggle,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number;
  selected: Set<string>;
  onToggle: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onPrevMonth}
          className="w-7 h-7 rounded-[8px] text-muted hover:bg-surface-card transition-colors"
          aria-label="이전 달"
        >
          ‹
        </button>
        <span className="text-sm font-bold text-ink">
          {year}년 {month}월
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          className="w-7 h-7 rounded-[8px] text-muted hover:bg-surface-card transition-colors"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted"}`}
          >
            {d}
          </div>
        ))}
      </div>

      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7">
          {row.map((day, di) => {
            if (!day) return <div key={di} className="aspect-square" />;
            const dateStr = ymd(year, month, day);
            const isSelected = selected.has(dateStr);
            const isSun = di === 0;
            const isSat = di === 6;

            return (
              <button
                key={di}
                type="button"
                onClick={() => onToggle(dateStr)}
                className={`aspect-square flex items-center justify-center text-xs rounded-lg transition-all
                  ${isSelected ? "bg-primary text-on-primary font-semibold" : "hover:bg-surface-card text-body font-medium"}
                  ${!isSelected && isSun ? "text-red-500" : ""}
                  ${!isSelected && isSat ? "text-blue-500" : ""}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// --- EmptyState ---

export function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center">
      <div className="bg-canvas rounded-[12px] border border-dashed border-hairline p-12 max-w-sm mx-auto">
        <div className="text-4xl mb-4">📅</div>
        <p className="text-sm font-bold text-body mb-2">
          현재 진행 중인 일정 조율이 없어요
        </p>
        <p className="text-xs text-muted mb-6 leading-relaxed">
          새 일정을 만들어 멤버들의
          <br />
          가능한 날짜를 모아보세요
        </p>
        <button
          onClick={onStart}
          className="bg-primary text-on-primary px-6 py-2.5 rounded-[8px] text-sm font-semibold hover:bg-primary-active transition-colors"
        >
          + 새 일정 만들기
        </button>
      </div>
    </div>
  );
}

// --- PresetSelect ---

export function PresetSelect({
  onSelect,
  onBack,
}: {
  onSelect: (type: PollType) => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="text-xs text-muted hover:text-body mb-6 block transition-colors"
      >
        ← 돌아가기
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
          Step 1
        </p>
        <h2 className="text-xl font-black text-ink">미팅 유형을 선택하세요</h2>
        <p className="text-sm text-muted mt-1.5">
          날짜·시간 기본값이 자동으로 설정돼요. 다음 단계에서 수정 가능해요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSelect("online")}
          className="text-left bg-canvas rounded-[12px] border-2 border-hairline p-6 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-4">💻</div>
          <p className="font-black text-ink mb-3">온라인 미팅</p>
          <div className="space-y-1.5">
            <p className="text-xs text-muted">📆 매월 1~10일</p>
            <p className="text-xs text-muted">🌙 평일 22:00 고정</p>
            <p className="text-xs text-muted">☀️ 주말 10:00~22:00</p>
          </div>
        </button>

        <button
          onClick={() => onSelect("offline")}
          className="text-left bg-canvas rounded-[12px] border-2 border-hairline p-6 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-4">🏢</div>
          <p className="font-black text-ink mb-3">오프라인 미팅</p>
          <div className="space-y-1.5">
            <p className="text-xs text-muted">📆 첫째·둘째 주말</p>
            <p className="text-xs text-muted">🕙 10:00~18:00</p>
            <p className="text-xs text-muted">📍 장소 직접 입력</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// --- PollForm ---

export function PollForm({
  pollType,
  onBack,
  onSubmit,
  disabled,
}: {
  pollType: PollType;
  onBack: () => void;
  onSubmit: (data: PollFormData) => void;
  disabled?: boolean;
}) {
  const isOnline = pollType === "online";
  const [dateMode, setDateMode] = useState<"range" | "specific">("range");
  const [dateFrom, setDateFrom] = useState(() => defaultRange(isOnline).from);
  const [dateTo, setDateTo] = useState(() => defaultRange(isOnline).to);
  const [specificDates, setSpecificDates] = useState<Set<string>>(new Set());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [weekdayTime, setWeekdayTime] = useState("22:00");
  const [weekendStart, setWeekendStart] = useState("10:00");
  const [weekendEnd, setWeekendEnd] = useState(isOnline ? "22:00" : "18:00");
  const [location, setLocation] = useState("");

  const toggleSpecific = (dateStr: string) => {
    setSpecificDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
        return next;
      }
      // 앱은 단일 월 기준 — 다른 달 날짜를 고르면 선택을 새로 시작
      const month = dateStr.slice(0, 7); // "YYYY-MM"
      const sameMonth = [...next].every((d) => d.slice(0, 7) === month);
      if (!sameMonth) return new Set([dateStr]);
      next.add(dateStr);
      return next;
    });
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  };

  const sortedSpecific = [...specificDates].sort();
  const canSubmit = dateMode === "range" || sortedSpecific.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const isSpecific = dateMode === "specific";
    onSubmit({
      dateFrom: isSpecific ? sortedSpecific[0] : dateFrom,
      dateTo: isSpecific ? sortedSpecific[sortedSpecific.length - 1] : dateTo,
      dates: isSpecific ? sortedSpecific : null,
      timeWeekday: isOnline ? weekdayTime : null,
      timeStart: weekendStart,
      timeEnd: weekendEnd,
      location: location.trim() || null,
    });
  };

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="text-xs text-muted hover:text-body mb-6 block transition-colors"
      >
        ← 유형 다시 선택
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
          Step 2
        </p>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-ink">일정 상세 설정</h2>
          <span className="text-xs bg-surface-card text-muted rounded-full px-2.5 py-1 font-medium">
            {isOnline ? "💻 온라인" : "🏢 오프라인"}
          </span>
        </div>
      </div>

      <div className="bg-canvas rounded-[12px] border border-hairline divide-y divide-hairline-soft">
        <div className="p-5">
          <label className="text-xs font-semibold text-muted block mb-3">
            날짜
          </label>

          {/* 모드 토글 */}
          <div className="grid grid-cols-2 gap-1 bg-surface-card rounded-[8px] p-1 mb-4">
            <button
              type="button"
              onClick={() => setDateMode("range")}
              className={`py-1.5 rounded-[6px] text-xs font-semibold transition-colors ${dateMode === "range" ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-body"}`}
            >
              범위
            </button>
            <button
              type="button"
              onClick={() => setDateMode("specific")}
              className={`py-1.5 rounded-[6px] text-xs font-semibold transition-colors ${dateMode === "specific" ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-body"}`}
            >
              특정 날짜
            </button>
          </div>

          {dateMode === "range" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
              />
              <span className="text-muted flex-shrink-0">~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
              />
            </div>
          ) : (
            <div>
              <MiniMonthPicker
                year={viewYear}
                month={viewMonth}
                selected={specificDates}
                onToggle={toggleSpecific}
                onPrevMonth={() => shiftMonth(-1)}
                onNextMonth={() => shiftMonth(1)}
              />
              <p className="text-xs text-muted mt-3">
                {sortedSpecific.length > 0
                  ? `${sortedSpecific.map((d) => parseInt(d.split("-")[2])).join(", ")}일 · ${sortedSpecific.length}일 선택`
                  : "가능한 날짜를 탭해서 선택하세요."}
              </p>
            </div>
          )}
        </div>

        <div className="p-5">
          <label className="text-xs font-semibold text-muted block mb-3">
            시간
          </label>
          <div className="space-y-2">
            {isOnline && (
              <div className="flex items-center justify-between bg-surface-card rounded-[8px] px-4 py-2.5">
                <span className="text-sm text-muted">평일</span>
                <input
                  type="time"
                  value={weekdayTime}
                  onChange={(e) => setWeekdayTime(e.target.value)}
                  className="text-sm font-semibold text-ink bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            )}
            <div className="flex items-center justify-between bg-surface-card rounded-[8px] px-4 py-2.5">
              <span className="text-sm text-muted">주말</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={weekendStart}
                  onChange={(e) => setWeekendStart(e.target.value)}
                  className="text-sm font-semibold text-ink bg-transparent border-none outline-none cursor-pointer"
                />
                <span className="text-muted text-xs">~</span>
                <input
                  type="time"
                  value={weekendEnd}
                  onChange={(e) => setWeekendEnd(e.target.value)}
                  className="text-sm font-semibold text-ink bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {!isOnline && (
          <div className="p-5">
            <label className="text-xs font-semibold text-muted block mb-3">
              장소
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 강남역 카페, 잠실 공유 오피스"
              className="w-full border border-hairline rounded-[8px] px-4 py-2.5 text-sm outline-none focus:border-muted placeholder:text-muted-soft"
            />
          </div>
        )}

        <div className="p-5">
          <button
            onClick={handleSubmit}
            disabled={disabled || !canSubmit}
            className="w-full py-3 bg-primary text-on-primary text-sm font-semibold rounded-[8px] hover:bg-primary-active transition-colors disabled:opacity-50"
          >
            {disabled
              ? "생성 중..."
              : !canSubmit
                ? "날짜를 선택하세요"
                : "일정 만들기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- EditPollModal ---

export function EditPollModal({
  poll,
  hasVotes,
  onClose,
  onSaveMeta,
  onSaveSchedule,
}: {
  poll: VotePoll;
  hasVotes: boolean;
  onClose: () => void;
  onSaveMeta: (data: UpdatePollMetaData) => Promise<void>;
  onSaveSchedule: (data: UpdatePollScheduleData) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 특정 날짜로 만든 일정은 모달에서 날짜·시간 수정을 지원하지 않는다 (범위 모드만 인라인 편집)
  const isSpecific = !!poll.dates && poll.dates.length > 0;
  const scheduleEditable = !hasVotes && !isSpecific;

  // 메타 정보
  const [location, setLocation] = useState(poll.location ?? "");
  const [meetingUrl, setMeetingUrl] = useState(poll.meeting_url ?? "");
  const [meetingPassword, setMeetingPassword] = useState(
    poll.meeting_password ?? "",
  );

  // 일정 범위 (투표 없을 때만 수정 가능)
  const [dateFrom, setDateFrom] = useState(poll.date_from);
  const [dateTo, setDateTo] = useState(poll.date_to);
  const [timeWeekday, setTimeWeekday] = useState(poll.time_weekday ?? "22:00");
  const [timeStart, setTimeStart] = useState(poll.time_start);
  const [timeEnd, setTimeEnd] = useState(poll.time_end);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const metaChanged =
      location !== (poll.location ?? "") ||
      meetingUrl !== (poll.meeting_url ?? "") ||
      meetingPassword !== (poll.meeting_password ?? "");

    const scheduleChanged =
      scheduleEditable &&
      (dateFrom !== poll.date_from ||
        dateTo !== poll.date_to ||
        timeWeekday !== (poll.time_weekday ?? "22:00") ||
        timeStart !== poll.time_start ||
        timeEnd !== poll.time_end);

    if (metaChanged) {
      await onSaveMeta({
        location: location.trim() || null,
        meeting_url: meetingUrl.trim() || null,
        meeting_password: meetingPassword.trim() || null,
      });
    }
    if (scheduleChanged) {
      await onSaveSchedule({
        date_from: dateFrom,
        date_to: dateTo,
        dates: null,
        time_weekday: poll.type === "online" ? timeWeekday : null,
        time_start: timeStart,
        time_end: timeEnd,
      });
    }
    if (!metaChanged && !scheduleChanged) {
      onClose();
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-canvas rounded-[12px] w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline-soft flex items-center justify-between">
          <p className="text-sm font-bold text-ink">일정 수정</p>
          <button
            onClick={onClose}
            className="text-muted hover:text-body transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 날짜 범위 — 투표 없고 범위 모드일 때만 */}
          {scheduleEditable && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">날짜 범위</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
                />
                <span className="text-muted flex-shrink-0">~</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
                />
              </div>
            </div>
          )}

          {/* 시간 — 투표 없고 범위 모드일 때만 */}
          {scheduleEditable && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">
                {poll.type === "online" ? "평일 시간" : "시간 범위"}
              </p>
              {poll.type === "online" ? (
                <input
                  type="time"
                  value={timeWeekday}
                  onChange={(e) => setTimeWeekday(e.target.value)}
                  className="w-full border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className="flex-1 border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
                  />
                  <span className="text-muted">~</span>
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    className="flex-1 border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
                  />
                </div>
              )}
            </div>
          )}

          {hasVotes && (
            <p className="text-xs text-muted bg-surface-card rounded-[8px] px-3 py-2.5">
              이미 투표한 멤버가 있어 날짜·시간은 수정할 수 없어요.
            </p>
          )}
          {!hasVotes && isSpecific && (
            <p className="text-xs text-muted bg-surface-card rounded-[8px] px-3 py-2.5">
              특정 날짜로 만든 일정이에요. 날짜·시간을 바꾸려면 일정을 다시
              만들어주세요.
            </p>
          )}

          {/* 메타 정보 */}
          {poll.type === "offline" && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">장소</p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 강남역 스타벅스"
                className="w-full border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
              />
            </div>
          )}
          {poll.type === "online" && (
            <>
              <div>
                <p className="text-xs font-semibold text-muted mb-2">
                  회의 링크
                </p>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted mb-2">
                  비밀번호
                </p>
                <input
                  type="text"
                  value={meetingPassword}
                  onChange={(e) => setMeetingPassword(e.target.value)}
                  placeholder="없으면 비워두세요"
                  className="w-full border border-hairline rounded-[8px] px-3 py-2 text-sm outline-none focus:border-muted"
                />
              </div>
            </>
          )}

          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        </div>

        <div className="p-5 border-t border-hairline-soft">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-primary text-on-primary rounded-[8px] text-sm font-semibold hover:bg-primary-active transition-colors disabled:opacity-40"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
