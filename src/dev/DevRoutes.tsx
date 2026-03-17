import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";
import MobileLayout1 from "./MobileLayout1";
import MobileLayout2 from "./MobileLayout2";
import MobileLayout3 from "./MobileLayout3";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
      <Route path="/1" element={<MobileLayout1 />} />
      <Route path="/2" element={<MobileLayout2 />} />
      <Route path="/3" element={<MobileLayout3 />} />
    </Routes>
  );
}
