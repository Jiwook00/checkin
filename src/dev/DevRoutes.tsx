import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";
import MobileLayout1 from "./MobileLayout1";
import MobileLayout2 from "./MobileLayout2";
import MobileLayout3 from "./MobileLayout3";
import TallyAvatar1 from "./TallyAvatar1";
import TallyAvatar2 from "./TallyAvatar2";
import TallyAvatar3 from "./TallyAvatar3";
import VoteResult1 from "./VoteResult1";
import VoteResult2 from "./VoteResult2";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
      <Route path="/1" element={<MobileLayout1 />} />
      <Route path="/2" element={<MobileLayout2 />} />
      <Route path="/3" element={<MobileLayout3 />} />
      <Route path="/4" element={<TallyAvatar1 />} />
      <Route path="/5" element={<TallyAvatar2 />} />
      <Route path="/6" element={<TallyAvatar3 />} />
      <Route path="/7" element={<VoteResult1 />} />
      <Route path="/8" element={<VoteResult2 />} />
    </Routes>
  );
}
