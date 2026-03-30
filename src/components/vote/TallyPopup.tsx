import type { TallyItem, VotePoll } from "../../types";
import MemberAvatar from "../MemberAvatar";

export type ClosePhase = "tally" | "date-modal";

interface TallyPopupProps {
  closePhase: ClosePhase;
  onSetClosePhase: (phase: ClosePhase | null) => void;
  voteTally: TallyItem[];
  totalMembers: number;
  respondedCount: number;
  cannotAttendCount: number;
  monthKO: string;
  poll: VotePoll;
  confirmedDate: { date: number; time: string } | null;
  onSelectConfirmedDate: (v: { date: number; time: string } | null) => void;
  confirming: boolean;
  onConfirm: () => void;
}

export default function TallyPopup({
  closePhase,
  onSetClosePhase,
  voteTally,
  totalMembers,
  respondedCount,
  cannotAttendCount,
  monthKO,
  poll,
  confirmedDate,
  onSelectConfirmedDate,
  confirming,
  onConfirm,
}: TallyPopupProps) {
  if (closePhase === "tally") {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
                {monthKO}
              </p>
              <h2 className="text-lg font-black text-stone-900">득표 현황</h2>
              <p className="text-xs text-stone-400 mt-1">
                {respondedCount}/{totalMembers}명 응답 완료
                {cannotAttendCount > 0 && (
                  <span className="ml-2 text-stone-400">
                    (불참 {cannotAttendCount}명)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => onSetClosePhase(null)}
              className="text-stone-400 hover:text-stone-600 text-xl font-light transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-4 max-h-80 overflow-y-auto">
            <div className="space-y-2">
              {voteTally.length > 0 ? (
                voteTally.map((item, idx) => {
                  const isTop = item.count === voteTally[0]?.count;
                  return (
                    <div
                      key={`${item.date}-${item.time}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isTop
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-stone-100 bg-white"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 bg-white border border-stone-100">
                        <span className="text-sm font-black text-stone-900">
                          {item.date}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {item.dayName}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-stone-800">
                          {poll.month}월 {item.date}일 ({item.dayName}){" "}
                          {item.time}
                        </p>
                        {isTop && idx === 0 && (
                          <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                            최다 득표
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="text-sm font-black text-stone-900">
                          {item.voters.length}
                          <span className="text-xs font-normal text-stone-400">
                            /{totalMembers}명
                          </span>
                        </p>
                        {/* 스택 아바타 (최대 5개 + +N 오버플로우) */}
                        <div className="flex">
                          {item.voters.slice(0, 5).map((v, i) => (
                            <div
                              key={v.memberId}
                              style={{ marginLeft: i === 0 ? 0 : -8 }}
                            >
                              <MemberAvatar
                                memberId={v.memberId}
                                name={v.name}
                                avatarUrl={v.avatarUrl}
                                size={24}
                                ringClass="ring-2 ring-white"
                              />
                            </div>
                          ))}
                          {item.voters.length > 5 && (
                            <div
                              style={{ marginLeft: -8 }}
                              className="w-6 h-6 bg-stone-200 rounded-full flex items-center justify-center text-stone-500 text-[9px] font-bold ring-2 ring-white"
                            >
                              +{item.voters.length - 5}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-stone-400 text-center py-4">
                  아직 투표 데이터가 없어요
                </p>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-stone-100 flex gap-2">
            <button
              onClick={() => onSetClosePhase(null)}
              className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
            >
              닫기
            </button>
            <button
              onClick={() => onSetClosePhase("date-modal")}
              className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors"
            >
              마감하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // closePhase === "date-modal"
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-100">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
            마감하기
          </p>
          <h2 className="text-lg font-black text-stone-900">
            확정 날짜를 선택하세요
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            득표 수를 참고해 최종 날짜를 골라주세요
          </p>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          <div className="space-y-2">
            {voteTally.length > 0 ? (
              voteTally.map((item) => {
                const isTop = item.count === voteTally[0]?.count;
                const isSelected =
                  confirmedDate?.date === item.date &&
                  confirmedDate?.time === item.time;
                return (
                  <button
                    key={`${item.date}-${item.time}`}
                    onClick={() =>
                      onSelectConfirmedDate({
                        date: item.date,
                        time: item.time,
                      })
                    }
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-stone-900 bg-stone-900 text-white"
                        : isTop
                          ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400"
                          : "border-stone-100 bg-white hover:border-stone-200"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 bg-white/20">
                      <span
                        className={`text-sm font-black ${isSelected ? "text-white" : "text-stone-900"}`}
                      >
                        {item.date}
                      </span>
                      <span
                        className={`text-[10px] ${isSelected ? "text-stone-300" : "text-stone-400"}`}
                      >
                        {item.dayName}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-semibold ${isSelected ? "text-white" : "text-stone-800"}`}
                      >
                        {poll.month}월 {item.date}일 ({item.dayName}){" "}
                        {item.time}
                      </p>
                      {isTop && !isSelected && (
                        <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                          최다 득표
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p
                        className={`text-sm font-black ${isSelected ? "text-white" : "text-stone-900"}`}
                      >
                        {item.count}
                        <span
                          className={`text-xs font-normal ${isSelected ? "text-stone-400" : "text-stone-400"}`}
                        >
                          /{totalMembers}명
                        </span>
                      </p>
                      <div className="flex gap-0.5 justify-end mt-1">
                        {Array.from({ length: totalMembers }, (_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-sm ${
                              i < item.count
                                ? isSelected
                                  ? "bg-white"
                                  : isTop
                                    ? "bg-emerald-500"
                                    : "bg-stone-500"
                                : isSelected
                                  ? "bg-white/20"
                                  : "bg-stone-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-stone-400 text-center py-4">
                아직 투표 데이터가 없어요
              </p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-stone-100 flex gap-2">
          <button
            onClick={() => {
              onSetClosePhase("tally");
              onSelectConfirmedDate(null);
            }}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:border-stone-400 transition-colors"
          >
            ← 돌아가기
          </button>
          <button
            disabled={!confirmedDate || confirming}
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirming
              ? "확정 중..."
              : confirmedDate
                ? "이 날짜로 확정"
                : "날짜를 선택하세요"}
          </button>
        </div>
      </div>
    </div>
  );
}
