import { Link } from "react-router-dom";
import type { VotePoll } from "../types";

// 현재 날짜 기준으로 세션/회고 월 계산
// 예: 3월 → "3월에 하는 2월 회고", 1월 → "1월에 하는 12월 회고"
const now = new Date();
const currentMonth = now.getMonth() + 1; // 1–12
const currentYear = now.getFullYear();
const retroMonth = currentMonth === 1 ? 12 : currentMonth - 1;

const SESSION_LABEL = `${currentYear}년 ${currentMonth}월`;
const RETRO_TITLE = `${currentMonth}월에 하는 ${retroMonth}월 회고`;

interface Props {
  onAddClick: () => void;
  activePoll?: VotePoll | null;
}

export default function SessionBanner({ onAddClick, activePoll }: Props) {
  const pollRetroMonth = activePoll
    ? activePoll.month === 1
      ? 12
      : activePoll.month - 1
    : null;

  const confirmedDay = activePoll?.confirmed_date
    ? parseInt(activePoll.confirmed_date.split("-")[2])
    : null;

  const isConfirmed = activePoll?.status === "confirmed" && confirmedDay;

  return (
    <div className="mb-6 rounded-2xl border border-stone-200 bg-stone-50 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-stone-400 mb-1.5 font-medium uppercase tracking-widest">
            {SESSION_LABEL}
          </div>
          <h1 className="text-xl font-black text-stone-900 leading-tight">
            {RETRO_TITLE}
          </h1>
          <p className="text-xs text-stone-400 mt-1.5">
            {isConfirmed
              ? `${activePoll!.month}월 ${confirmedDay}일 확정`
              : "날짜 미정"}
          </p>
        </div>
        <button
          onClick={onAddClick}
          className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
        >
          + 글 추가
        </button>
      </div>

      {/* 날짜 투표 섹션 */}
      <div className="border-t border-stone-200 pt-4">
        <span className="text-xs font-semibold text-stone-500">날짜</span>
        <p className="text-xs text-stone-400 mt-2">
          {isConfirmed ? (
            <>
              {pollRetroMonth}월 회고: {activePoll!.month}월 {confirmedDay}일
              확정 ·{" "}
              <Link
                to="/vote"
                className="underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                자세히 보기 →
              </Link>
            </>
          ) : activePoll ? (
            <>
              아직 {pollRetroMonth}월 회고 날짜가 정해지지 않았어요 ·{" "}
              <Link
                to="/vote"
                className="underline underline-offset-2 hover:text-stone-700 transition-colors"
              >
                일정 조율하러 가기 →
              </Link>
            </>
          ) : (
            "아직 진행 중인 투표가 없어요"
          )}
        </p>
      </div>
    </div>
  );
}
