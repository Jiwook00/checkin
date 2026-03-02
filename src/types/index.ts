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

export interface VotePoll {
  id: string;
  session: string;
  year: number;
  month: number;
  status: "open" | "closed" | "confirmed";
  confirmed_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoteDateSelection {
  date: number;
  hours: number[];
}

export interface VoteResponse {
  id: string;
  poll_id: string;
  member_id: string;
  mode: "available" | "unavailable";
  selected_dates: VoteDateSelection[];
  created_at: string;
  updated_at: string;
}
