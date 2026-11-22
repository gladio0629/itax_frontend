import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'uz.izgo.client',
  appName: 'IZGO',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      // iOS: the web view shrinks to the space above the keyboard, so the
      // sheet and its main button stay visible (src/ui/keyboard.ts).
      resize: KeyboardResize.Native,
      // Android: resize the web view under the edge-to-edge (full screen) layout too.
      resizeOnFullScreen: true,
    },
  },
};

export default config;
