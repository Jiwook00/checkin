// DEV ONLY — Preview 1: 새 일정 만들기 플로우
import { useState } from "react";
import { Switcher } from "./shared";

type Step = "empty" | "preset" | "form";
type PollType = "online" | "offline";

export default function VoteV2Create() {
  const [step, setStep] = useState<Step>("empty");
  const [pollType, setPollType] = useState<PollType>("online");

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              3월에 하는 2월 회고
            </span>
            <h1 className="text-lg font-black text-stone-900 mt-0.5">
              일정 조율
            </h1>
          </div>
          {step !== "empty" && (
            <button
              onClick={() => setStep("empty")}
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              취소
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {step === "empty" && <EmptyState onStart={() => setStep("preset")} />}
        {step === "preset" && (
          <PresetSelect
            onSelect={(type) => {
              setPollType(type);
              setStep("form");
            }}
            onBack={() => setStep("empty")}
          />
        )}
        {step === "form" && (
          <PollForm pollType={pollType} onBack={() => setStep("preset")} />
        )}
      </div>

      <Switcher current={1} total={4} />
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
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

function PresetSelect({
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

function PollForm({
  pollType,
  onBack,
}: {
  pollType: PollType;
  onBack: () => void;
}) {
  const isOnline = pollType === "online";
  const [weekdayTime, setWeekdayTime] = useState("22:00");
  const [weekendStart, setWeekendStart] = useState("10:00");
  const [weekendEnd, setWeekendEnd] = useState(isOnline ? "22:00" : "18:00");

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
              defaultValue={isOnline ? "2026-03-01" : "2026-03-07"}
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400"
            />
            <span className="text-stone-400 flex-shrink-0">~</span>
            <input
              type="date"
              defaultValue={isOnline ? "2026-03-10" : "2026-03-15"}
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
              placeholder="예: 강남역 카페, 잠실 공유 오피스"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-stone-400 placeholder:text-stone-300"
            />
          </div>
        )}

        <div className="p-5">
          <button className="w-full py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-700 transition-colors">
            일정 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
