import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'uz.izgo.driver',
  appName: 'IZGO Driver',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      // Every screen has the dark (Ink) top, in both themes: light status-bar
      // text. The bar overlays the web view (the plugin default), which pads
      // itself with env(safe-area-inset-*).
      style: 'DARK',
    },
    Keyboard: {
      // iOS: the web view shrinks to the space above the keyboard (as in the
      // client), so the page never scrolls the Ink top under the status bar
      // and the footer button stays above the keyboard (Screen.tsx).
      resize: KeyboardResize.Native,
      // Android: resize the web view under the edge-to-edge layout too.
      resizeOnFullScreen: true,
    },
  },
};

export default config;
