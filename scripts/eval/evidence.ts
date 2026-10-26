// 근거(evidence) 검증: 추출 결과의 인용이 원문에 실제로 있는지 문자열로 확인한다 (Deno 2.x, #75)
//
// 지어냈는지는 LLM이 아니라 코드가 먼저 가른다. 판정은 두 단계다.
//   통과(ok)      : normalizeStrict 한 원문이 normalizeStrict 한 인용을 부분 문자열로 포함한다 (인용은 10자 이상)
//   진단(실패 사유): 통과하지 못한 인용만 normalizeLoose로 다시 본다. 느슨하게는 맞으면 near_miss(서식·문장부호만 바뀜),
//                   그래도 없으면 not_found(원문에 없음). 느슨한 일치는 통과로 치지 않는다
//                   (짧은 인용이 우연히 맞는 일을 막고, 실패 원인이 "지어냄"인지 "따옴표를 바꿈"인지 구분하려는 것)
//
// 정규화 대상은 회고 원문(노션·티스토리에서 가져온 마크다운)에서 실제로 많이 나온 것들이다:
// 백슬래시 이스케이프(`\-`, `1\.`), 줄 끝 공백 2칸(줄바꿈), nbsp, 링크·이미지·굵게·헤딩·인용·목록 기호, HTML 태그

export type EvidenceFailure = "too_short" | "near_miss" | "not_found";

export interface EvidenceCheck {
  ok: boolean;
  reason?: EvidenceFailure;
}

// 정규화한 인용이 이보다 짧으면 우연히 맞을 수 있어 통과로 보지 않는다
export const MIN_EVIDENCE_CHARS = 10;

export function normalizeStrict(input: string): string {
  let s = input.normalize("NFC");
  // 이미지는 통째로 지우고, 링크는 표시 글자만 남긴다
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // HTML: <br>은 공백으로, 나머지 태그는 지운다
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<\/?[a-z][^>]*>/gi, "");
  // 줄 끝 백슬래시(강제 줄바꿈)와 문자 이스케이프
  s = s.replace(/\\$/gm, " ");
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!>~|<])/g, "$1");
  // 줄 머리의 헤딩 · 인용 · 목록 기호
  s = s.replace(/^[ \t]*#{1,6}(?:[ \t]+|$)/gm, "");
  s = s.replace(/^[ \t]*(?:>[ \t]*)+/gm, "");
  s = s.replace(/^[ \t]*(?:[-*+]|\d+\.)(?:[ \t]+|$)/gm, "");
  // 강조 · 코드 · 취소선 기호
  s = s.replace(/\*+|__|~~|`/g, "");
  // 공백류: 폭 없는 문자는 지우고, nbsp·전각 공백을 포함한 모든 공백을 한 칸으로
  s = s.replace(/[​-‍⁠﻿]/g, "");
  s = s.replace(/[\s 　]+/g, " ").trim();
  return s;
}

export function normalizeLoose(input: string): string {
  return normalizeStrict(input)
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .toLowerCase();
}

export interface PreparedSource {
  strict: string;
  loose: string;
}

/** 원문 정규화는 case당 한 번만 한다 */
export function prepareSource(markdown: string): PreparedSource {
  return { strict: normalizeStrict(markdown), loose: normalizeLoose(markdown) };
}

export function checkEvidence(
  source: PreparedSource,
  evidence: string,
): EvidenceCheck {
  const strict = normalizeStrict(evidence);
  if (strict.length < MIN_EVIDENCE_CHARS) {
    return { ok: false, reason: "too_short" };
  }
  if (source.strict.includes(strict)) return { ok: true };
  const loose = normalizeLoose(evidence);
  return {
    ok: false,
    reason: loose && source.loose.includes(loose) ? "near_miss" : "not_found",
  };
}
