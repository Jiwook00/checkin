import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";

const DevRoutes = import.meta.env.DEV
  ? lazy(() => import("./dev/DevRoutes"))
  : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {import.meta.env.DEV && DevRoutes && (
            <Route
              path="/dev/*"
              element={
                <Suspense fallback={null}>
                  <DevRoutes />
                </Suspense>
              }
            />
          )}
          <Route path="/*" element={<App />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
