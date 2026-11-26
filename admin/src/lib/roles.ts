import type { AdminRole } from "@/api/types";

/** Display names only (design-v2 copy). Never used for permission checks:
 * those come from getMe() (sections, actions, creatableRoles). */
export const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "Superadmin",
  owner: "Owner",
  menejer: "Menejer",
  marketolog: "Marketolog",
  operator: "Operator",
};
