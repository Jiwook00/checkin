export interface Retrospective {
  id: string;
  title: string;
  author: string;
  source_url: string;
  source_type: "notion" | "tistory" | "other";
  content_html: string | null;
  content_markdown: string;
  session: string;
  created_at: string;
  updated_at: string;
}

export interface AddArticleForm {
  title: string;
  author: string;
  source_url: string;
  session: string;
}
