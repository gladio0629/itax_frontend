import { DemoBadge } from "@/components/DemoBadge";
import { DemoControlPanel } from "@/components/DemoControlPanel";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <>
      <DemoBadge />
      <AppRoutes />
      <DemoControlPanel />
    </>
  );
}
