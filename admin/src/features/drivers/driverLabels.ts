import type { BadgeTone } from "@/components/Badge";
import type { Driver, DriverStatus } from "@/api/types";
import { api } from "@/api/client";

export const DRIVER_STATUS: Record<DriverStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Faol", tone: "success" },
  // The real API's draft / pending_review: not approved yet (checked automatically).
  auto_review: { label: "Avtomatik tekshiruvda", tone: "warning" },
  blocked: { label: "Bloklangan", tone: "neutral" },
  rejected: { label: "Rad etilgan", tone: "danger" },
};

/** The badge a driver row shows. "Qarz chegarasi" only when the server says
 * the wallet reached the limit (`atDebtLimit`); never computed here. */
export function driverBadge(d: Pick<Driver, "status" | "archived" | "atDebtLimit">): { label: string; tone: BadgeTone } {
  if (d.archived) return { label: "Arxivlangan", tone: "neutral" };
  if (d.status === "active" && d.atDebtLimit) return { label: "Qarz chegarasi", tone: "danger" };
  return DRIVER_STATUS[d.status];
}

/** Chips: one chip = one server status filter. */
export function driverChipStatuses(): ("active" | "auto_review" | "blocked" | "archived")[] {
  // The contract filters by account state only (active/blocked/archived).
  return api.capabilities.driverReviewFilter ? ["active", "auto_review", "blocked", "archived"] : ["active", "blocked", "archived"];
}
