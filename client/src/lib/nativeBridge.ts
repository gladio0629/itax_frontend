/**
 * Calls a native Capacitor plugin through the bridge the iOS/Android shell
 * injects (window.Capacitor). Importing @capacitor/core would put the
 * Capacitor runtime (and its third-party URLs) into the web bundle for one
 * or two calls; the injected bridge's `nativePromise` is the same channel
 * the plugin packages use. On the web (no bridge) every call is a no-op.
 *
 * The plugin packages themselves (@capacitor/status-bar, …) stay installed
 * so `cap sync` registers their native code.
 */
type Bridge = {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: (plugin: string, method: string, options?: object) => Promise<unknown>;
};

function bridge(): Bridge | null {
  const cap = (window as unknown as { Capacitor?: Bridge }).Capacitor;
  return cap?.isNativePlatform?.() && cap.nativePromise ? cap : null;
}

export function isNative(): boolean {
  return bridge() !== null;
}

/** Fire-and-forget native call; resolves to undefined off-device or on error. */
export async function nativeCall(plugin: string, method: string, options?: object): Promise<unknown> {
  const cap = bridge();
  if (!cap || (cap.isPluginAvailable && !cap.isPluginAvailable(plugin))) return undefined;
  try {
    return await cap.nativePromise!(plugin, method, options);
  } catch {
    return undefined;
  }
}
