import { Navigate, Route } from "react-router-dom";
import type { Me } from "@/api/types";
import { OpSearchScreen } from "./OpSearchScreen";
import { OpPassengersScreen } from "./OpPassengersScreen";
import { OpPassengerPage } from "./OpPassengerPage";
import { OpDriverPage } from "./OpDriverPage";

/**
 * Operator search, passengers and the passenger/driver cards, under the
 * app's operator prefix (/operators/...). Returned as a fragment of <Route>s
 * so OperatorsScreen mounts them inside its own <Routes>. What is shown
 * follows getMe() sections; the server makes the real check.
 */
export function opCardRoutes(me: Me) {
  const has = (...s: Me["sections"]) => s.some((x) => me.sections.includes(x));
  const canPassengers = has("passengers_view", "passengers");
  const canDrivers = has("drivers_view", "drivers");
  const canSearch = canPassengers || canDrivers || has("orders_view", "orders");
  const home = <Navigate to="/operators" replace />;
  return (
    <>
      <Route path="search" element={canSearch ? <OpSearchScreen /> : home} />
      <Route path="passengers" element={canPassengers ? <OpPassengersScreen /> : home} />
      <Route path="passengers/:passengerId/:tab?" element={canPassengers ? <OpPassengerPage /> : home} />
      {/* The list itself (/operators/drivers) stays in OperatorsScreen. */}
      <Route path="drivers/:driverId/:tab?" element={canDrivers ? <OpDriverPage /> : home} />
    </>
  );
}
