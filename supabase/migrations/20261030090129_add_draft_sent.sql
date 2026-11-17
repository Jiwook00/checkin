-- 리마인더 초안 발송 기록 (이슈 #84)
--   sent_at  : 메일을 실제로 보냈다고 표시한 시각
--   sent_via : 보낸 방법. 지금은 'manual'(화면에서 복사해 운영자가 직접), 메일 API 발송(#85)이 생기면 'api'
--   발송 기록의 출처는 DB 다. 로컬 메모는 자동 발송으로 넘어가면 쓸 수 없고, 중복 발송은 DB 가 막아야 한다

ALTER TABLE checkin_reminder_drafts
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN sent_via TEXT CHECK (sent_via IN ('manual', 'api'));

-- 발송 시각과 방법은 함께 채운다
ALTER TABLE checkin_reminder_drafts
  ADD CONSTRAINT checkin_reminder_drafts_sent_pair_check
    CHECK ((sent_at IS NULL) = (sent_via IS NULL));

-- 승인(approved) 또는 수정 승인(edited)된 초안만 보낸 것으로 표시할 수 있다.
-- 보낸 뒤에 draft·rejected 로 되돌리면 검토 기록(사람 라벨)과 발송 사실이 어긋난다
ALTER TABLE checkin_reminder_drafts
  ADD CONSTRAINT checkin_reminder_drafts_sent_status_check
    CHECK (sent_at IS NULL OR status IN ('approved', 'edited'));

-- 한 회차에 한 멤버에게는 발송 기록이 하나만 있다 (재생성한 다른 row 에도 중복 표시를 막는다)
CREATE UNIQUE INDEX checkin_reminder_drafts_sent_once_idx
  ON checkin_reminder_drafts (session, member_id)
  WHERE sent_at IS NOT NULL;

-- 관리자가 고칠 수 있는 컬럼에 발송 기록을 더한다. 행 단위 권한은 기존 "Allow admin review" 정책이 그대로 관리자로 제한한다
GRANT UPDATE (sent_at, sent_via) ON checkin_reminder_drafts TO authenticated;
