import { api } from "@/api/client";
import type { Address, OrderWithDetails } from "@/api/types";
import { isLatLng, type LatLng } from "@shared/map/geo";

/** An address's place on the real map; null when the adapter gave none. */
export function addressPoint(address: Address | null | undefined): LatLng | null {
  const p = { lat: address?.lat, lng: address?.lng };
  return isLatLng(p) ? p : null;
}

/** An order's pickup or drop-off: the exact point when the adapter kept it,
 * else the city it names. */
export function orderPoint(order: OrderWithDetails, end: "from" | "to"): LatLng | null {
  const id = end === "from" ? order.extras?.fromAddressId : order.extras?.toAddressId;
  const exact = addressPoint(id ? api.addressById(id) : undefined);
  if (exact) return exact;
  const city = end === "from" ? order.fromCity : order.toCity;
  const p = { lat: city.lat, lng: city.lng };
  return isLatLng(p) ? p : null;
}
