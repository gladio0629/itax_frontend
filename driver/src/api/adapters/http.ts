import { NotImplementedError, type ApiAdapter } from "../adapterTypes";

// Integration point for the real IZGO backend. Every method rejects until
// implemented; the UI handles the rejection like any other API error.
export const httpAdapter = new Proxy({} as ApiAdapter, {
  get(_target, prop) {
    return () => Promise.reject(new NotImplementedError(String(prop)));
  },
});
