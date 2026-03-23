import { Routes, Route } from "react-router-dom";
import DevIndex from "./DevIndex";

export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DevIndex />} />
    </Routes>
  );
}
