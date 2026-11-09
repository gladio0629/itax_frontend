import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import type { Section } from "@/api/types";

/** Route guard: hides a section until the server-decided permission list
 * (Me.sections) says the current admin may see it. Never a role check. */
export function RequireSection({ section, children }: { section: Section; children: ReactNode }) {
  const { me, loading } = usePermissions();
  if (loading || !me) return null;
  if (!me.sections.includes(section)) return <Navigate to={me.landingPath} replace />;
  return <>{children}</>;
}
