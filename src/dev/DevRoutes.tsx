// DEV ONLY — 레이아웃 프리뷰 라우터
import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";
import Schedule1 from "./Schedule1";
import Schedule2 from "./Schedule2";
import Schedule3 from "./Schedule3";
import Schedule4 from "./Schedule4";
import Schedule5 from "./Schedule5";
import Schedule6 from "./Schedule6";
import Schedule7 from "./Schedule7";
import Schedule8 from "./Schedule8";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
      <Route path="/1" element={<Schedule1 />} />
      <Route path="/2" element={<Schedule2 />} />
      <Route path="/3" element={<Schedule3 />} />
      <Route path="/4" element={<Schedule4 />} />
      <Route path="/5" element={<Schedule5 />} />
      <Route path="/6" element={<Schedule6 />} />
      <Route path="/7" element={<Schedule7 />} />
      <Route path="/8" element={<Schedule8 />} />
    </Routes>
  );
}
