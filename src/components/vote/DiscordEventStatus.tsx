import { useCallback, useEffect, useRef, useState } from "react";
import type { PollDiscordEvent } from "../../types";
import { getPollDiscordEvent, syncDiscordEvent } from "../../lib/vote";

// 동기화 결과를 기다리는 횟수와 간격. 디스코드 호출은 보통 1~2초 안에 끝난다
const POLL_TRIES = 5;
const POLL_INTERVAL_MS = 2000;

const ERROR_LABELS: Record<string, string> = {
  past: "시작 시간이 지나서 만들지 않았어요",
  missing_bot_token: "봇 토큰 설정이 비어 있어요",
  missing_guild_id: "서버 ID 설정이 비어 있어요",
  missing_channel_id: "음성 채널 ID 설정이 비어 있어요",
  missing_permissions: "봇에게 이벤트 권한이 없어요",
  invalid_time: "확정 일시를 읽지 못했어요",
};

function errorLabel(code: string): string {
  return ERROR_LABELS[code] ?? `디스코드 호출에 실패했어요 (${code})`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 확정 화면의 관리자 전용 한 줄. 실패하면 이유와 다시 시도를 보여준다 (#103) */
export default function DiscordEventStatus({ pollId }: { pollId: string }) {
  const [event, setEvent] = useState<PollDiscordEvent | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const alive = useRef(true);

  // synced_at 이 바뀔 때까지 기다린다. 클라이언트와 서버 시계를 비교하지 않으려고 이전 값과만 비교한다
  const waitForSync = useCallback(
    async (prevSyncedAt: string | null) => {
      for (let i = 0; i < POLL_TRIES; i++) {
        await sleep(POLL_INTERVAL_MS);
        const next = await getPollDiscordEvent(pollId);
        if (!alive.current) return;
        if (next && next.discord_event_synced_at !== prevSyncedAt) {
          setEvent(next);
          break;
        }
      }
      if (alive.current) setWaiting(false);
    },
    [pollId],
  );

  useEffect(() => {
    alive.current = true;
    (async () => {
      const current = await getPollDiscordEvent(pollId);
      if (!alive.current) return;
      setEvent(current);
      // 확정 직후라 아직 한 번도 동기화되지 않았으면 결과를 조금 기다린다
      if (current && !current.discord_event_synced_at) {
        await waitForSync(null);
      } else {
        setWaiting(false);
      }
    })();
    return () => {
      alive.current = false;
    };
  }, [pollId, waitForSync]);

  const handleRetry = async () => {
    setRequestError(null);
    setWaiting(true);
    const { error } = await syncDiscordEvent(pollId);
    if (error) {
      setRequestError(error);
      setWaiting(false);
      return;
    }
    await waitForSync(event?.discord_event_synced_at ?? null);
  };

  let label: string;
  let tone = "text-muted";
  let canRetry = false;
  if (waiting) {
    label = "디스코드 이벤트 확인 중...";
  } else if (requestError) {
    label = requestError;
    tone = "text-error";
    canRetry = true;
  } else if (event?.discord_event_error) {
    label = errorLabel(event.discord_event_error);
    tone = "text-error";
    canRetry = event.discord_event_error !== "past";
  } else if (event?.discord_event_id) {
    label = "디스코드 이벤트에 올렸어요";
    tone = "text-success";
  } else {
    label = "디스코드 이벤트가 아직 없어요";
    canRetry = true;
  }

  return (
    <div className="mt-4 pt-4 border-t border-hairline-soft flex items-center justify-between gap-3 text-left">
      <p className={`text-xs ${tone}`}>
        <span className="text-muted-soft">관리자 · </span>
        {label}
      </p>
      {canRetry && (
        <button
          onClick={handleRetry}
          className="flex-shrink-0 text-xs text-body border border-hairline rounded-full px-3 py-1 hover:border-muted hover:text-ink transition-colors"
        >
          {event?.discord_event_error || requestError ? "다시 시도" : "만들기"}
        </button>
      )}
    </div>
  );
}
