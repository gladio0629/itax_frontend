import type { ReactNode } from "react";
import type { LucideIcon } from "@/lib/icons";
import { StateBlock } from "./StateBlock";

/** Nothing to show yet: soft icon tile, title, hint and an optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return <StateBlock icon={icon} title={title} description={description} action={action} />;
}
