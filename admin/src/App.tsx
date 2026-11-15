import { lazy, Suspense } from "react";
import { DEMO_MODE } from "@/config";
import { AppRoutes } from "./routes";

// The test panel ("Sinov paneli") exists only in the sample-data build.
// DEMO_MODE is a build-time constant, so the http build drops this import.
const TestPanel = DEMO_MODE ? lazy(() => import("@/components/TestPanel")) : null;

export default function App() {
  return (
    <>
      <AppRoutes />
      {TestPanel && (
        <Suspense fallback={null}>
          <TestPanel />
        </Suspense>
      )}
    </>
  );
}
