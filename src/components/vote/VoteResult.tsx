import type { DateInfo, TallyItem, VotePoll } from "../../types";
import type { MemberInfo } from "../../lib/vote";
import MemberAvatar from "../MemberAvatar";

interface VoteResultProps {
  poll: VotePoll;
  confirmedDay: number | null;
  confirmedDateInfo: DateInfo | undefined;
  confirmedTallyItem: TallyItem | undefined;
  memberNicknames: Record<string, MemberInfo>;
  onCreateNext: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function VoteResult({
  poll,
  confirmedDay,
  confirmedDateInfo,
  confirmedTallyItem,
  memberNicknames,
  onCreateNext,
  onEdit,
  onDelete,
}: VoteResultProps) {
  return (
    <div className="text-center">
      <div className="bg-white rounded-2xl border border-emerald-200 p-8 max-w-sm md:max-w-md mx-auto">
        <div className="text-4xl mb-4">📆</div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">
          일정 확정
        </p>
        <p className="text-2xl font-black text-stone-900 mb-1">
          {poll.month}월 {confirmedDay}일 ({confirmedDateInfo?.dayName ?? ""})
        </p>
        <p className="text-lg font-bold text-stone-600 mb-4">
          {confirmedTallyItem?.time ?? poll.time_weekday ?? poll.time_start}{" "}
          시작
        </p>
        {confirmedTallyItem && (
          <>
            <p className="text-sm text-stone-400 mb-3">
              {confirmedTallyItem.count}명이 참여 가능한 날짜예요
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {Object.entries(memberNicknames)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([id, info]) => {
                  const attending = confirmedTallyItem.voters.some(
                    (v) => v.memberId === id,
                  );
                  return (
                    <MemberAvatar
                      key={id}
                      memberId={id}
                      name={info.nickname}
                      avatarUrl={info.avatarUrl}
                      size={36}
                      ringClass="ring-1"
                      colorOverride={
                        attending
                          ? undefined
                          : "bg-stone-100 text-stone-300 ring-stone-200"
                      }
                    />
                  );
                })}
            </div>
          </>
        )}
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={onCreateNext}
            className="w-full bg-stone-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-stone-700 transition-colors"
          >
            + 다음 회차 일정 만들기
          </button>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2 text-xs font-medium hover:border-stone-400 hover:text-stone-800 transition-colors"
            >
              일정 수정
            </button>
            <button
              onClick={onDelete}
              className="flex-1 border border-stone-200 text-stone-400 rounded-xl py-2 text-xs font-medium hover:border-red-200 hover:text-red-500 transition-colors"
            >
              일정 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
