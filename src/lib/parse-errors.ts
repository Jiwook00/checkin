const MESSAGES: Record<string, string> = {
  INVALID_URL: "링크 형식이 올바르지 않아요. 주소를 다시 확인해주세요.",
  NOTION_PRIVATE:
    "노션 페이지가 비공개 상태예요. 공유 설정에서 웹 게시를 켜주세요.",
  NOTION_SCHEMA:
    "노션 페이지 구조를 읽지 못했어요. 링크는 저장되었으니 원본 링크로 읽을 수 있어요.",
  HTTP_404: "페이지를 찾을 수 없어요. 링크가 맞는지 확인해주세요.",
  HTTP_403: "이 사이트가 자동 수집을 막고 있어요. 원본 링크로 읽을 수 있어요.",
  HTTP_429: "요청이 몰려 잠시 막혔어요. 잠시 뒤 다시 시도해주세요.",
  HTTP_5XX: "상대 사이트가 응답하지 않아요. 잠시 뒤 다시 시도해주세요.",
  TIMEOUT: "페이지 응답이 너무 느려요. 잠시 뒤 다시 시도해주세요.",
  NETWORK: "페이지에 연결하지 못했어요. 잠시 뒤 다시 시도해주세요.",
  NO_CONTENT_NODE: "본문을 찾지 못했어요. 원본 링크로 읽을 수 있어요.",
  LOW_QUALITY: "본문을 제대로 가져오지 못했어요. 원본 링크로 읽을 수 있어요.",
  JS_RENDERED:
    "이 페이지는 화면에서 본문을 그리는 방식이라 가져오지 못했어요. 원본 링크로 읽을 수 있어요.",
  UNREACHABLE: "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해주세요.",
  STORE_FAILED: "글을 저장하지 못했어요. 잠시 뒤 다시 시도해주세요.",
};

const FALLBACK = "글 내용을 가져오지 못했어요. 원본 링크로 읽을 수 있어요.";

/** 파싱 error_code → 사용자에게 보여줄 한국어 안내 */
export function parseErrorMessage(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || FALLBACK;
}
