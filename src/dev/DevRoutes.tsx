import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";
import Profile1 from "./Profile1";
import Profile2 from "./Profile2";
import Profile3 from "./Profile3";
import Profile1Web from "./Profile1Web";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
      <Route path="/1" element={<Profile1 />} />
      <Route path="/1-web" element={<Profile1Web />} />
      <Route path="/2" element={<Profile2 />} />
      <Route path="/3" element={<Profile3 />} />
    </Routes>
  );
}
