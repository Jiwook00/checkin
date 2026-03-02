// DEV ONLY — 레이아웃 프리뷰 라우터
import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";
import Layout1 from "./Layout1";
import Layout2 from "./Layout2";
import Layout3 from "./Layout3";
import Layout4 from "./Layout4";
import Layout5 from "./Layout5";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
      <Route path="/1" element={<Layout1 />} />
      <Route path="/2" element={<Layout2 />} />
      <Route path="/3" element={<Layout3 />} />
      <Route path="/4" element={<Layout4 />} />
      <Route path="/5" element={<Layout5 />} />
    </Routes>
  );
}
