import { useState } from "react";
import { Link } from "react-router-dom";
import type { VotePoll } from "../types";

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const hour = h > 12 ? h - 12 : h;
  return m === 0 ? `${ampm} ${hour}시` : `${ampm} ${hour}시 ${m}분`;
}

function formatConfirmedDate(dateStr: string, timeStr: string | null) {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayName = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const timePart = timeStr ? ` ${formatTime(timeStr)}` : "";
  return `${month}월 ${day}일 (${dayName})${timePart}`;
}

interface Props {
  onAddClick: () => void;
  activePoll?: VotePoll | null;
}

export default function SessionBanner({ onAddClick, activePoll }: Props) {
  const [copied, setCopied] = useState(false);

  function copyPassword(pw: string) {
    navigator.clipboard.writeText(pw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const currentMonth = new Date().getMonth() + 1;
  const sessionMonth = activePoll?.month ?? currentMonth;
  const retroMonth = sessionMonth === 1 ? 12 : sessionMonth - 1;
  const retroTitle = `${sessionMonth}월에 하는 ${retroMonth}월 회고`;

  const isConfirmed =
    activePoll?.status === "confirmed" && !!activePoll.confirmed_date;
  const confirmedTime =
    activePoll?.confirmed_time ?? activePoll?.time_weekday ?? null;

  return (
    <div className="mb-6 rounded-[12px] border border-hairline bg-canvas p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-ink leading-[1.3] tracking-[-0.3px]">
            {retroTitle}
          </h1>

          {isConfirmed && activePoll!.type === "online" && (
            <>
              <p className="text-sm text-muted mt-1.5">
                {formatConfirmedDate(
                  activePoll!.confirmed_date!,
                  confirmedTime,
                )}{" "}
                · 온라인
              </p>
              {(activePoll!.meeting_url || activePoll!.meeting_password) && (
                <div className="flex flex-col gap-1 mt-2">
                  {activePoll!.meeting_url && (
                    <a
                      href={activePoll!.meeting_url}
                      className="text-sm font-medium text-muted underline underline-offset-2 hover:text-ink transition-colors"
                    >
                      회의 참여하기 →
                    </a>
                  )}
                  {activePoll!.meeting_password && (
                    <button
                      onClick={() =>
                        copyPassword(activePoll!.meeting_password!)
                      }
                      title="클릭하면 복사돼요"
                      className="flex items-center gap-1 text-xs text-muted-soft hover:text-muted cursor-pointer transition-colors self-start"
                    >
                      {copied ? (
                        <>
                          <span>✓</span>
                          <span>복사됨</span>
                        </>
                      ) : (
                        <>
                          <span>비밀번호: {activePoll!.meeting_password}</span>
                          <span className="opacity-50">⎘</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {isConfirmed && activePoll!.type === "offline" && (
            <>
              <p className="text-sm text-muted mt-1.5">
                {formatConfirmedDate(
                  activePoll!.confirmed_date!,
                  confirmedTime,
                )}{" "}
                · 오프라인
              </p>
              {activePoll!.location && (
                <p className="text-xs text-muted-soft mt-1">
                  📍 {activePoll!.location}
                </p>
              )}
            </>
          )}

          {!isConfirmed && activePoll && (
            <p className="text-sm text-muted mt-1.5">
              날짜 조율 중 ·{" "}
              <Link
                to="/vote"
                className="underline underline-offset-2 hover:text-ink transition-colors"
              >
                일정 투표하러 가기 →
              </Link>
            </p>
          )}

          {!activePoll && (
            <p className="text-sm text-muted-soft mt-1.5">
              아직 일정이 만들어지지 않았어요
            </p>
          )}
        </div>

        <button
          onClick={onAddClick}
          className="hidden md:block shrink-0 rounded-[8px] bg-primary h-10 px-5 text-sm font-semibold text-on-primary hover:bg-primary-active transition-colors"
        >
          + 글 추가
        </button>
      </div>
    </div>
  );
}
