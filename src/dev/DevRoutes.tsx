// DEV ONLY — 레이아웃 프리뷰 라우터
import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
    </Routes>
  );
}
