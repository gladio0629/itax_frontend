import { getTestNetwork } from "@/stores/testControlsStore";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/**
 * Fakes a server round-trip with a local timer — never touches the network.
 * Normal: 150–450ms. "Sekin internet": 1.8–3.2s. Failures only happen when
 * the "Xatoliklar" test-panel switch is on, so sample data stays deterministic.
 */
export function withLatency<T>(factory: () => T, opts?: { minMs?: number; maxMs?: number; noFail?: boolean }): Promise<T> {
  const net = getTestNetwork();
  const [min, max] = net.slowInternet ? [1800, 3200] : [opts?.minMs ?? 150, opts?.maxMs ?? 450];
  const delay = min + Math.random() * (max - min);
  const fail = net.forceErrors && !opts?.noFail && Math.random() < 0.5;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (fail) return reject(new ApiError("NETWORK_ERROR"));
      try {
        resolve(factory());
      } catch (err) {
        reject(err);
      }
    }, delay);
  });
}
