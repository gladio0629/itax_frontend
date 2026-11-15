import type { SeatPosition } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { Armchair } from "@/lib/icons";
import { Tag } from "./OrderDetails";

/** Which seats the passenger booked ("Old o'rindiq, Orqa chap"), as the server lists them. */
export function SeatsTag({ seatIds }: { seatIds: SeatPosition[] }) {
  const { t } = useT();
  const seats = seatIds.map((s) => t(`seat.${s}`)).join(", ");
  return (
    <Tag icon={Armchair} label={t("feed.seatIds", { seats })}>
      {seats}
    </Tag>
  );
}
