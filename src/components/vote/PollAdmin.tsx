import { useState } from "react";
import type { PollFormData, VotePoll } from "../../types";
import type {
  UpdatePollMetaData,
  UpdatePollScheduleData,
} from "../../lib/vote";

export type PollType = "online" | "offline";

// --- EmptyState ---

export function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center">
      <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-12 max-w-sm mx-auto">
        <div className="text-4xl mb-4">📅</div>
        <p className="text-sm font-bold text-stone-700 mb-2">
          현재 진행 중인 일정 조율이 없어요
        </p>
        <p className="text-xs text-stone-400 mb-6 leading-relaxed">
          새 일정을 만들어 멤버들의
          <br />
          가능한 날짜를 모아보세요
        </p>
        <button
          onClick={onStart}
          className="bg-stone-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors"
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
        className="text-xs text-stone-400 hover:text-stone-600 mb-6 block transition-colors"
      >
        ← 돌아가기
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
          Step 1
        </p>
        <h2 className="text-xl font-black text-stone-900">
          미팅 유형을 선택하세요
        </h2>
        <p className="text-sm text-stone-400 mt-1.5">
          날짜·시간 기본값이 자동으로 설정돼요. 다음 단계에서 수정 가능해요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSelect("online")}
          className="text-left bg-white rounded-2xl border-2 border-stone-200 p-6 hover:border-stone-900 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-4">💻</div>
          <p className="font-black text-stone-900 mb-3">온라인 미팅</p>
          <div className="space-y-1.5">
            <p className="text-xs text-stone-400">📆 매월 1~10일</p>
            <p className="text-xs text-stone-400">🌙 평일 22:00 고정</p>
            <p className="text-xs text-stone-400">☀️ 주말 10:00~22:00</p>
          </div>
        </button>

        <button
          onClick={() => onSelect("offline")}
          className="text-left bg-white rounded-2xl border-2 border-stone-200 p-6 hover:border-stone-900 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-4">🏢</div>
          <p className="font-black text-stone-900 mb-3">오프라인 미팅</p>
          <div className="space-y-1.5">
            <p className="text-xs text-stone-400">📆 첫째·둘째 주말</p>
            <p className="text-xs text-stone-400">🕙 10:00~18:00</p>
            <p className="text-xs text-stone-400">📍 장소 직접 입력</p>
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
  const [dateFrom, setDateFrom] = useState(
    isOnline ? "2026-03-01" : "2026-03-07",
  );
  const [dateTo, setDateTo] = useState(isOnline ? "2026-03-10" : "2026-03-15");
  const [weekdayTime, setWeekdayTime] = useState("22:00");
  const [weekendStart, setWeekendStart] = useState("10:00");
  const [weekendEnd, setWeekendEnd] = useState(isOnline ? "22:00" : "18:00");
  const [location, setLocation] = useState("");

  const handleSubmit = () => {
    onSubmit({
      dateFrom,
      dateTo,
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
        className="text-xs text-stone-400 hover:text-stone-600 mb-6 block transition-colors"
      >
        ← 유형 다시 선택
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
          Step 2
        </p>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-stone-900">일정 상세 설정</h2>
          <span className="text-xs bg-stone-100 text-stone-500 rounded-full px-2.5 py-1 font-medium">
            {isOnline ? "💻 온라인" : "🏢 오프라인"}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        <div className="p-5">
          <label className="text-xs font-semibold text-stone-500 block mb-3">
            날짜 범위
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
            />
            <span className="text-stone-400 flex-shrink-0">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
            />
          </div>
        </div>

        <div className="p-5">
          <label className="text-xs font-semibold text-stone-500 block mb-3">
            시간
          </label>
          <div className="space-y-2">
            {isOnline && (
              <div className="flex items-center justify-between bg-stone-50 rounded-xl px-4 py-2.5">
                <span className="text-sm text-stone-500">평일</span>
                <input
                  type="time"
                  value={weekdayTime}
                  onChange={(e) => setWeekdayTime(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            )}
            <div className="flex items-center justify-between bg-stone-50 rounded-xl px-4 py-2.5">
              <span className="text-sm text-stone-500">주말</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={weekendStart}
                  onChange={(e) => setWeekendStart(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
                <span className="text-stone-400 text-xs">~</span>
                <input
                  type="time"
                  value={weekendEnd}
                  onChange={(e) => setWeekendEnd(e.target.value)}
                  className="text-sm font-semibold text-stone-800 bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {!isOnline && (
          <div className="p-5">
            <label className="text-xs font-semibold text-stone-500 block mb-3">
              장소
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 강남역 카페, 잠실 공유 오피스"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-stone-400 placeholder:text-stone-300"
            />
          </div>
        )}

        <div className="p-5">
          <button
            onClick={handleSubmit}
            disabled={disabled}
            className="w-full py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {disabled ? "생성 중..." : "일정 만들기"}
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
      !hasVotes &&
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
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <p className="text-sm font-bold text-stone-900">일정 수정</p>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 날짜 범위 — 투표 없을 때만 */}
          {!hasVotes && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2">
                날짜 범위
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
                <span className="text-stone-400 flex-shrink-0">~</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              </div>
            </div>
          )}

          {/* 시간 — 투표 없을 때만 */}
          {!hasVotes && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2">
                {poll.type === "online" ? "평일 시간" : "시간 범위"}
              </p>
              {poll.type === "online" ? (
                <input
                  type="time"
                  value={timeWeekday}
                  onChange={(e) => setTimeWeekday(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                  />
                  <span className="text-stone-400">~</span>
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                  />
                </div>
              )}
            </div>
          )}

          {hasVotes && (
            <p className="text-xs text-stone-400 bg-stone-50 rounded-xl px-3 py-2.5">
              이미 투표한 멤버가 있어 날짜·시간은 수정할 수 없어요.
            </p>
          )}

          {/* 메타 정보 */}
          {poll.type === "offline" && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2">장소</p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 강남역 스타벅스"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
              />
            </div>
          )}
          {poll.type === "online" && (
            <>
              <div>
                <p className="text-xs font-semibold text-stone-500 mb-2">
                  회의 링크
                </p>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 mb-2">
                  비밀번호
                </p>
                <input
                  type="text"
                  value={meetingPassword}
                  onChange={(e) => setMeetingPassword(e.target.value)}
                  placeholder="없으면 비워두세요"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
                />
              </div>
            </>
          )}

          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        </div>

        <div className="p-5 border-t border-stone-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
