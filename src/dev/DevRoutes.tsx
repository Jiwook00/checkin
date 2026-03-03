// DEV ONLY — 레이아웃 프리뷰 라우터
import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";
import VoteV2Create from "./VoteV2Create";
import VoteV2VoteA from "./VoteV2VoteA";
import VoteV2VoteB from "./VoteV2VoteB";
import VoteV2Close from "./VoteV2Close";
import VoteFlowMock from "./VoteFlowMock";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
      <Route path="/1" element={<VoteV2Create />} />
      <Route path="/2" element={<VoteV2VoteA />} />
      <Route path="/3" element={<VoteV2VoteB />} />
      <Route path="/4" element={<VoteV2Close />} />
      <Route path="/5" element={<VoteFlowMock />} />
    </Routes>
  );
}
