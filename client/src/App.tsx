import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { PhoneFrame } from "@/components/PhoneFrame";
import { DEMO_MODE } from "@/config";

// The test panel is a separate chunk that exists only in the sample-data
// build: DEMO_MODE is a compile-time constant, so the http build drops it.
const TestControlPanel = DEMO_MODE
  ? lazy(() => import("@/components/TestControlPanel").then((m) => ({ default: m.TestControlPanel })))
  : null;

export function RootLayout() {
  return (
    <>
      <PhoneFrame>
        <Outlet />
      </PhoneFrame>
      {TestControlPanel && (
        <Suspense fallback={null}>
          <TestControlPanel />
        </Suspense>
      )}
    </>
  );
}
