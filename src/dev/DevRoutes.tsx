import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";
import Profile1 from "./Profile1";
import Profile2 from "./Profile2";
import Profile3 from "./Profile3";
import Profile1Web from "./Profile1Web";
import Archive1 from "./Archive1";
import Archive2 from "./Archive2";
import Archive3 from "./Archive3";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
      <Route path="/1" element={<Profile1 />} />
      <Route path="/1-web" element={<Profile1Web />} />
      <Route path="/2" element={<Profile2 />} />
      <Route path="/3" element={<Profile3 />} />
      <Route path="/archive-1" element={<Archive1 />} />
      <Route path="/archive-2" element={<Archive2 />} />
      <Route path="/archive-3" element={<Archive3 />} />
    </Routes>
  );
}
