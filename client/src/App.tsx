import { PhoneFrame } from "@/components/PhoneFrame";
import { DemoControlPanel } from "@/components/DemoControlPanel";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <>
      <PhoneFrame>
        <AppRoutes />
      </PhoneFrame>
      <DemoControlPanel />
    </>
  );
}
