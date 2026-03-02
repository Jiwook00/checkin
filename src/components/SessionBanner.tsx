import { Link } from "react-router-dom";

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
}

export default function SessionBanner({ onAddClick }: Props) {
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
          <p className="text-xs text-stone-400 mt-1.5">날짜 미정</p>
        </div>
        <button
          onClick={onAddClick}
          className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
        >
          + 글 추가
        </button>
      </div>

      {/* 날짜 투표 섹션 — 실제 투표 데이터 연동은 #11에서 구현 */}
      <div className="border-t border-stone-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-stone-500">
            날짜 투표
          </span>
          <Link
            to="/vote"
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
          >
            투표하러 가기 →
          </Link>
        </div>
        <p className="text-xs text-stone-400">
          아직 진행 중인 투표가 없습니다.
        </p>
      </div>
    </div>
  );
}
