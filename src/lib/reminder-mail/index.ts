import type { ReminderDraft } from "../../types";
import template from "./template.html?raw";
import { renderReminderMail, type RenderResult } from "./render";

export { mailFileName } from "./render";
export type { RenderResult } from "./render";

export function renderDraftHtml(draft: ReminderDraft): RenderResult {
  return renderReminderMail(template, draft);
}
