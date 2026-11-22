// The native shell's own global (Capacitor's native bridge injects it before
// the app loads). Read directly instead of importing @capacitor/core, so the
// bundle carries no Capacitor web code (its HTTP shim contains fetch, which
// the sample-data build must not have). In a browser it is absent.
type Listener = { remove: () => Promise<void> | void };
type AppPlugin = {
  addListener(event: "backButton", cb: (e: { canGoBack: boolean }) => void): Promise<Listener> | Listener;
  exitApp(): Promise<void> | void;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { App?: AppPlugin };
};

function cap(): CapacitorGlobal | undefined {
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export const isNative = () => !!cap()?.isNativePlatform?.();
/** "ios" | "android" | "web". */
export const platform = () => cap()?.getPlatform?.() ?? "web";
/** @capacitor/app's native plugin (registered by `cap sync`), when running in the app. */
export const appPlugin = () => (isNative() ? cap()?.Plugins?.App : undefined);
