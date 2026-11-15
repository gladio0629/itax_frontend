import { getTestScenarios } from "@/stores/testScenariosStore";
import { ApiError } from "@shared/http/errors";

// One error type for both adapters (shared/http/errors.ts), so screens see
// the same `code` / `message` shape whichever adapter is active.
export { ApiError };

/**
 * Simulates a network round-trip to the mock server: 300-900ms latency
 * (1.8-3.2s when the "slow internet" demo scenario is on), with an
 * occasional random failure so retry states have something to show.
 * This NEVER touches the network — it's a local timer only.
 */
export function withLatency<T>(factory: () => T, opts?: { minMs?: number; maxMs?: number }): Promise<T> {
  const scenarios = getTestScenarios();
  const [min, max] = scenarios.slowInternet
    ? [1800, 3200]
    : [opts?.minMs ?? 300, opts?.maxMs ?? 900];
  const delay = min + Math.random() * (max - min);
  const failRate = scenarios.forceErrors ? 0.65 : 0.04;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failRate) {
        reject(new ApiError("NETWORK_ERROR", "Ulanishda xatolik yuz berdi. Qayta urinib ko'ring."));
        return;
      }
      try {
        resolve(factory());
      } catch (err) {
        reject(err);
      }
    }, delay);
  });
}
