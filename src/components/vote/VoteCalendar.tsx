import type { DateInfo, VotePoll } from "../../types";
import { DAY_NAMES } from "../../types";

function isDateClickable(dateInfo: DateInfo, poll: VotePoll): boolean {
  if (poll.type === "offline") return dateInfo.isWeekend;
  return true;
}

interface VoteCalendarProps {
  poll: VotePoll;
  dates: DateInfo[];
  calendarRows: (number | null)[][];
  selectedDates: Set<number>;
  activeDate: number | null;
  allWeekdayVotes: Record<number, number>;
  allWeekendHourVotes: Record<number, Record<number, number>>;
  maxVoteCount: number;
  dateFromDay: number;
  dateToDay: number;
  monthKO: string;
  onToggleDate: (date: number) => void;
}

export default function VoteCalendar({
  poll,
  dates,
  calendarRows,
  selectedDates,
  activeDate,
  allWeekdayVotes,
  allWeekendHourVotes,
  maxVoteCount,
  dateFromDay,
  dateToDay,
  monthKO,
  onToggleDate,
}: VoteCalendarProps) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-stone-800">{monthKO}</span>
        <span className="text-xs text-stone-400 bg-stone-50 rounded-full px-2 py-0.5">
          {dateFromDay}일 ~ {dateToDay}일
        </span>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-stone-400"}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      {calendarRows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7">
          {row.map((day, di) => {
            if (!day) return <div key={di} className="aspect-square" />;
            const dateInfo = dates.find((d) => d.date === day);
            const inRange = !!dateInfo;
            const clickable = inRange && isDateClickable(dateInfo!, poll);
            const isMarked = selectedDates.has(day);
            const isActive = activeDate === day;
            const isSun = di === 0;
            const isSat = di === 6;
            const isWeekend = dateInfo?.isWeekend ?? false;
            const weekdayCount =
              inRange && !isWeekend ? (allWeekdayVotes[day] ?? 0) : 0;
            const weekendMaxCount =
              inRange && isWeekend && allWeekendHourVotes[day]
                ? Math.max(...Object.values(allWeekendHourVotes[day]))
                : 0;
            const isTopVote = weekdayCount === maxVoteCount && weekdayCount > 0;

            if (!inRange || !clickable) {
              return (
                <div
                  key={di}
                  className={`aspect-square flex items-center justify-center text-xs ${!inRange ? (isSun ? "text-red-200" : isSat ? "text-blue-200" : "text-stone-200") : isSun ? "text-red-300" : isSat ? "text-blue-300" : "text-stone-300"}`}
                >
                  {day}
                </div>
              );
            }

            return (
              <button
                key={di}
                onClick={() => onToggleDate(day)}
                className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg transition-all relative
                  ${isMarked ? "bg-stone-900 text-white" : isActive ? "ring-2 ring-stone-300 text-stone-800 font-semibold" : isTopVote ? "bg-emerald-50 ring-1 ring-emerald-200 text-stone-900" : "hover:bg-stone-50 text-stone-700 font-medium"}
                  ${isWeekend && !isMarked && !isActive && isSun ? "text-red-500" : ""}
                  ${isWeekend && !isMarked && !isActive && isSat ? "text-blue-500" : ""}
                `}
              >
                <span>{day}</span>
                {inRange && !isWeekend && weekdayCount > 0 && (
                  <span
                    className={`text-[9px] leading-none mt-0.5 font-bold ${isMarked ? "text-stone-400" : isTopVote ? "text-emerald-600" : "text-stone-400"}`}
                  >
                    {weekdayCount}명
                  </span>
                )}
                {inRange && isWeekend && weekendMaxCount > 0 && (
                  <span
                    className={`text-[9px] leading-none mt-0.5 font-bold ${isMarked ? "text-stone-400" : "text-blue-400"}`}
                  >
                    {weekendMaxCount}명
                  </span>
                )}
                {isWeekend && weekendMaxCount === 0 && (
                  <span
                    className={`text-[9px] leading-none ${isMarked ? "opacity-60" : "opacity-40"}`}
                  >
                    주말
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      {/* 범례 */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <div className="w-3 h-3 rounded bg-stone-900" />
          <span>내가 가능</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <div className="w-3 h-3 rounded ring-2 ring-stone-300" />
          <span>선택 중</span>
        </div>
        {maxVoteCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <div className="w-3 h-3 rounded bg-emerald-50 ring-1 ring-emerald-200" />
            <span>최다 득표</span>
          </div>
        )}
        {(Object.keys(allWeekdayVotes).length > 0 ||
          Object.keys(allWeekendHourVotes).length > 0) && (
          <div className="flex items-center gap-1 text-xs text-stone-400">
            <span className="text-[10px] font-bold">N명</span>
            <span>= 셀 안 응답 인원</span>
          </div>
        )}
      </div>
    </div>
  );
}
