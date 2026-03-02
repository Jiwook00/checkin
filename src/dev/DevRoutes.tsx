// DEV ONLY — 레이아웃 프리뷰 라우터
import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";
import Layout1 from "./Layout1";
import Layout2 from "./Layout2";
import Layout3 from "./Layout3";
import Layout4 from "./Layout4";
import Layout5 from "./Layout5";
import Layout6 from "./Layout6";
import Layout7 from "./Layout7";
import Layout8 from "./Layout8";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
      <Route path="/1" element={<Layout1 />} />
      <Route path="/2" element={<Layout2 />} />
      <Route path="/3" element={<Layout3 />} />
      <Route path="/4" element={<Layout4 />} />
      <Route path="/5" element={<Layout5 />} />
      <Route path="/6" element={<Layout6 />} />
      <Route path="/7" element={<Layout7 />} />
      <Route path="/8" element={<Layout8 />} />
    </Routes>
  );
}
