import { Outlet } from "react-router-dom";
import { PhoneFrame } from "@/components/PhoneFrame";
import { DemoControlPanel } from "@/components/DemoControlPanel";

export function RootLayout() {
  return (
    <>
      <PhoneFrame>
        <Outlet />
      </PhoneFrame>
      <DemoControlPanel />
    </>
  );
}
