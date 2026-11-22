import { useState } from "react";
import { api } from "@/api/client";
import type { Address, AddressDetails, OrderDetailsRules, SavedAddressInfo } from "@/api/types";
import { AddressSearch, type AddressTarget } from "./AddressSearch";
import { MapPick } from "./MapPick";
import { AddressDetailsScreen } from "./AddressDetailsScreen";

type Step = { kind: "search" } | { kind: "map" } | { kind: "details"; address: Address; entrance?: string; back: "search" | "map" };

/**
 * Picking a route point (design v2): Address search → (Xaritadan belgilash →
 * MapPick) → (AddressDetails) → done. Target "save" (Home "+") always ends in
 * AddressDetails with "Manzilni saqlash".
 *
 * onDone gets the point, the entrance a search result named (fills Podyezd)
 * and the Tafsilotlar entered on the way (undefined when none were edited).
 */
export function AddressFlow({
  target,
  title,
  fromLabel,
  toLabel,
  fromAddressId,
  excludeCityId,
  onlyCityId,
  rules,
  startOnMap,
  onDone,
  onClose,
  onSwap,
}: {
  target: AddressTarget;
  title: string;
  fromLabel?: string | null;
  toLabel?: string | null;
  fromAddressId?: string;
  excludeCityId?: string;
  onlyCityId?: string;
  rules?: OrderDetailsRules | null;
  /** Open on the map (Home "+", design: MapPick) where the map can pick. */
  startOnMap?: boolean;
  onDone: (address: Address, entrance?: string, details?: AddressDetails, saved?: SavedAddressInfo) => void;
  onClose: () => void;
  onSwap?: () => void;
}) {
  const canMap = api.capabilities.mapPick;
  const [step, setStep] = useState<Step>(startOnMap && canMap ? { kind: "map" } : { kind: "search" });
  /** Details typed on the map step, kept while the pin moves. */
  const [mapDetails, setMapDetails] = useState<AddressDetails | undefined>(undefined);

  if (step.kind === "details") {
    return (
      <AddressDetailsScreen
        address={step.address}
        value={target === "save" ? (step.entrance ? { entrance: step.entrance } : {}) : { ...(mapDetails ?? {}), ...(step.entrance ? { entrance: step.entrance } : {}) }}
        rules={rules}
        mode={target === "save" ? "save" : "point"}
        onClose={() => setStep(step.back === "map" ? { kind: "map" } : { kind: "search" })}
        onDone={(details, saved) => {
          if (target === "save") onDone(step.address, undefined, details, saved);
          else if (step.back === "map") {
            // From MapPick the details return to the map, which confirms the point.
            setMapDetails(details);
            setStep({ kind: "map" });
          } else onDone(step.address, step.entrance, details, saved);
        }}
      />
    );
  }

  if (step.kind === "map") {
    return (
      <MapPick
        target={target}
        excludeCityId={excludeCityId}
        onlyCityId={onlyCityId}
        details={mapDetails}
        allowDetails={target !== "save" && api.capabilities.addressDetails}
        onDetails={(address) => setStep({ kind: "details", address, back: "map" })}
        onSearch={() => setStep({ kind: "search" })}
        onConfirm={(address) => {
          if (target === "save") setStep({ kind: "details", address, back: "map" });
          else onDone(address, undefined, mapDetails);
        }}
      />
    );
  }

  return (
    <AddressSearch
      target={target}
      title={title}
      fromLabel={fromLabel}
      toLabel={toLabel}
      fromAddressId={fromAddressId}
      excludeCityId={excludeCityId}
      onlyCityId={onlyCityId}
      onClose={onClose}
      onSwap={onSwap}
      onMap={canMap ? () => setStep({ kind: "map" }) : undefined}
      onPick={(address, entrance) => {
        if (target === "save") setStep({ kind: "details", address, entrance, back: "search" });
        else onDone(address, entrance);
      }}
    />
  );
}
