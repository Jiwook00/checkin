import type { ReminderDraft } from "../../types";

// 리마인더 초안(구조 데이터)을 갈피 HTML 템플릿에 채운다 (#89). 순수 함수만 둔다:
// 템플릿 문자열을 인자로 받으므로 ?raw import 없이도 불러 쓸 수 있다.
// 평문 조립 기준은 supabase/functions/_shared/reminder/generate.ts의 composeMail이다.

export type RenderResult =
  | { ok: true; html: string }
  | { ok: false; reason: string };

type Slots = Record<string, string>;
type SlotResult = { ok: true; slots: Slots } | { ok: false; reason: string };

const SIGNATURE = "— 갈피";
const GALPI_POSE = "holding-pencil";

// 일정 줄이 있을 때만 붙는 행. 템플릿의 다른 행과 같은 폰트 스택·색을 쓴다
const MEETING_ROW = `<tr>
                          <td
                            class="px"
                            align="center"
                            style="
                              padding: 20px 44px 0 44px;
                              font-family:
                                Georgia, &quot;Apple SD Gothic Neo&quot;,
                                &quot;Malgun Gothic&quot;, serif;
                              font-size: 14px;
                              line-height: 26px;
                              mso-line-height-rule: exactly;
                              color: #6b6055;
                            "
                          >
                            {{MEETING}}
                          </td>
                        </tr>`;

const LINK_STYLE = "color: #6b6055; text-decoration: underline";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 문단 안의 줄바꿈도, 문단 사이도 <br />로 잇는다 (2026-08 메일과 같은 밀도)
function paragraphsToHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => escapeHtml(p).replace(/\n/g, "<br />"))
    .join("<br />");
}

// composeMail과 수정본 비교가 같은 기준을 쓰도록 줄 끝 공백과 앞뒤 공백을 걷어 낸다
function normalize(s: string): string {
  return s
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function splitParagraphs(s: string): string[] {
  return s
    .trim()
    .split(/\n\s*\n/)
    .map(normalize)
    .filter(Boolean);
}

function noticeParagraph(draft: ReminderDraft): string {
  const { writeLine, scheduleLine } = draft.input.notice;
  return normalize(`${writeLine}\n${scheduleLine}`);
}

/**
 * 수정본을 본문(공통 질문 앞)과 맺음(공지 뒤)으로 나눈다. 기준점은 원본 구간 문자열이다:
 * 생성된 공통 질문 문단과 composeMail이 만든 공지 문단이 그대로, 하나씩, 이어서 있어야 한다.
 * 사람이 고친 문단을 조용히 버리지 않으려고, 못 찾으면 실패로 돌려준다.
 */
export function splitEdited(
  draft: ReminderDraft,
):
  | { ok: true; body: string[]; signoff: string[] }
  | { ok: false; reason: string } {
  const failure = {
    ok: false as const,
    reason:
      "수정본에서 공통 질문·공지 문단을 찾지 못했어요. 평문으로 복사하거나, 해당 문단을 원문대로 두고 다시 수정해 주세요.",
  };
  const result = draft.output?.result;
  if (!result || !draft.edited_mail) return failure;

  const paragraphs = splitParagraphs(draft.edited_mail);
  const question = normalize(result.commonQuestion);
  const notice = noticeParagraph(draft);
  const q = paragraphs.indexOf(question);
  const n = paragraphs.indexOf(notice);
  const unique =
    q >= 0 &&
    n >= 0 &&
    q === paragraphs.lastIndexOf(question) &&
    n === paragraphs.lastIndexOf(notice);
  if (!unique || n !== q + 1 || q === 0) return failure;

  return {
    ok: true,
    body: paragraphs.slice(0, q),
    signoff: paragraphs.slice(n + 1),
  };
}

// "다음 모임 일정은 … → https://…"처럼 끝에 링크가 붙은 일정 줄은 앞 문구를 링크 텍스트로 쓴다
function meetingToHtml(scheduleLine: string): string {
  const line = scheduleLine.trim();
  const m = /^(.*?)\s*→\s*(https?:\/\/\S+)$/.exec(line);
  if (!m) return escapeHtml(line);
  return `<a href="${escapeHtml(m[2])}" style="${LINK_STYLE}">${escapeHtml(m[1])}</a>`;
}

function buildSlots(draft: ReminderDraft): SlotResult {
  if (draft.status !== "approved" && draft.status !== "edited") {
    return { ok: false, reason: "승인한 초안만 HTML로 내보낼 수 있어요." };
  }
  const result = draft.output?.result;
  if (!result) {
    return { ok: false, reason: "생성 결과가 없어 HTML을 만들 수 없어요." };
  }

  let body: string[];
  let signoff: string[];
  if (draft.status === "edited") {
    const split = splitEdited(draft);
    if (!split.ok) return split;
    body = split.body;
    signoff = split.signoff;
  } else {
    body = [result.opening, result.callback].map(normalize).filter(Boolean);
    signoff = [result.closing].map(normalize).filter(Boolean);
  }

  const [, mm] = draft.session.split("-");
  const month = Number(mm);
  const headline = `${month}월 회고 쓰실 수 있어요`;
  const scheduleLine = draft.input.notice.scheduleLine.trim();

  return {
    ok: true,
    slots: {
      NAME: escapeHtml(draft.input.name),
      SESSION: escapeHtml(draft.session),
      TITLE: escapeHtml(headline),
      HEADLINE: escapeHtml(headline),
      PREHEADER: escapeHtml(`${headline}. 한 줄이어도 좋아요. ${SIGNATURE}`),
      SESSION_LABEL: escapeHtml(`${draft.session.replace("-", ". ")} 회고`),
      GALPI_POSE,
      BODY: paragraphsToHtml(body),
      REACTIONS: "",
      NOTICE: "",
      QUESTION: escapeHtml(draft.input.commonQuestion),
      SESSION_SHORT: `${month}월`,
      MEETING_ROW: scheduleLine
        ? MEETING_ROW.replace("{{MEETING}}", () => meetingToHtml(scheduleLine))
        : "",
      SIGNOFF: `${signoff.length ? `${paragraphsToHtml(signoff)}<br />` : ""}${SIGNATURE}`,
    },
  };
}

export function renderReminderMail(
  template: string,
  draft: ReminderDraft,
): RenderResult {
  const built = buildSlots(draft);
  if (!built.ok) return built;

  // 채우지 못한 슬롯이 메일에 그대로 나가지 않게 먼저 걸러 낸다
  const keys = new Set(
    [...template.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]),
  );
  const missing = [...keys].filter((k) => !(k in built.slots));
  if (missing.length > 0) {
    return { ok: false, reason: `채우지 못한 슬롯: ${missing.join(", ")}` };
  }

  const html = template.replace(
    /\{\{([A-Z_]+)\}\}/g,
    (_, key: string) => built.slots[key],
  );
  return { ok: true, html };
}

export function mailFileName(draft: ReminderDraft, nickname: string): string {
  const safe = nickname.replace(/[\\/:*?"<>|\s]+/g, "-");
  return `reminder-${draft.session}-${safe}.html`;
}
