-- 디스코드 발송 기록 (이슈 #98)
--   checkin_discord_deliveries : discord-notify 함수가 보낸(보내려던) 알림 한 건
--   unique (event_type, ref_id) 가 "같은 알림은 한 번만"을 보장한다. 함수가 보내기 전에 pending 으로 먼저 insert 해서 자리를 잡는다
--   ref_id 가 null 이면(test) Postgres 는 중복을 허용하므로 매번 보낸다
--   failed 는 자동 재시도하지 않는다. 사람이 보고 판단한다. error 에는 코드(network_error, http_404 …)만 남기고 URL·예외 메시지는 쓰지 않는다
--   쓰기: 정책이 없다 = service role(Edge Function discord-notify) 전용. 관리자는 읽기만 한다

CREATE TABLE checkin_discord_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  ref_id TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  discord_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT checkin_discord_deliveries_event_ref_key UNIQUE (event_type, ref_id)
);

ALTER TABLE checkin_discord_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin read" ON checkin_discord_deliveries
  FOR SELECT TO authenticated USING (is_checkin_admin());
