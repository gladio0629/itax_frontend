import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  // Hover styles only where a real pointer can hover — on phones a tapped
  // element otherwise keeps its hover background until the next tap.
  future: { hoverOnlyWhenSupported: true },
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        card: "var(--color-card)",
        ink: "rgb(var(--color-text-rgb) / <alpha-value>)",
        accent: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        "accent-5": "var(--color-accent-5)",
        "accent-10": "var(--color-accent-10)",
        "brand-yellow": "rgb(var(--color-brand-yellow-rgb) / <alpha-value>)",
        "on-yellow": "var(--color-on-yellow)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        border: "var(--color-border)",
        fill: "var(--color-fill)",
        "fill-subtle": "var(--color-fill-subtle)",
        selected: "var(--color-selected)",
        hairline: "var(--color-hairline)",
        backdrop: "var(--color-backdrop)",
        // Design v2 role tokens (design/tokens-v2.css).
        iz: {
          head: "var(--iz-head)",
          "head-card": "var(--iz-head-card)",
          "head-border": "var(--iz-head-border)",
          "head-border-strong": "var(--iz-head-border-strong)",
          "head-text": "var(--iz-head-text)",
          "head-muted": "var(--iz-head-muted)",
          "head-soft": "var(--iz-head-soft)",
          sheet: "var(--iz-sheet)",
          ink: "var(--iz-ink)",
          muted: "var(--iz-muted)",
          field: "var(--iz-field)",
          "field-focus": "var(--iz-field-focus)",
          skeleton: "var(--iz-skeleton)",
          "skeleton-strong": "var(--iz-skeleton-strong)",
          border: "var(--iz-border)",
          "divider-in-field": "var(--iz-divider-in-field)",
          "chip-border": "var(--iz-chip-border)",
          selected: "var(--iz-selected)",
          "on-selected": "var(--iz-on-selected)",
          "selected-accent": "var(--iz-selected-accent)",
          green: "rgb(var(--iz-green-rgb) / <alpha-value>)",
          "on-green": "var(--iz-on-green)",
          "green-text": "var(--iz-green-text)",
          "green-soft": "var(--iz-green-soft)",
          danger: "var(--iz-danger)",
          "danger-soft": "var(--iz-danger-soft)",
          warn: "var(--iz-warn)",
          "warn-strong": "var(--iz-warn-strong)",
          "warn-soft": "var(--iz-warn-soft)",
          "warn-tile": "var(--iz-warn-tile)",
          sos: "var(--iz-sos)",
          "switch-off": "var(--iz-switch-off)",
          map: "var(--iz-map)",
          connector: "var(--iz-connector)",
          dash: "var(--iz-dash)",
          "map-pin": "var(--iz-map-pin)",
        },
      },
      // Family, sizes and shadows resolve through design tokens so the iOS
      // token set (design/ios.css) can swap them without touching markup.
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "var(--text-xs-lh)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--text-sm-lh)" }],
        base: ["var(--text-base)", { lineHeight: "var(--text-base-lh)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--text-lg-lh)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--text-xl-lh)" }],
        "4xl": ["var(--text-4xl)", { lineHeight: "var(--text-4xl-lh)" }],
        // Measured scale (design/tokens.css) — the same on every device.
        display: ["var(--type-display)", { lineHeight: "var(--type-display-lh)" }],
        section: ["var(--type-section)", { lineHeight: "var(--type-section-lh)" }],
        lead: ["var(--type-lead)", { lineHeight: "var(--type-lead-lh)" }],
        body: ["var(--type-body)", { lineHeight: "var(--type-body-lh)" }],
        control: ["var(--type-control)", { lineHeight: "var(--type-control-lh)" }],
        sub: ["var(--type-sub)", { lineHeight: "var(--type-sub-lh)" }],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        softer: "var(--shadow-softer)",
        inner5: "inset 0 1px 0 0 rgba(255,255,255,0.18)",
      },
      borderRadius: {
        // Measured scale (design/tokens.css), the same on every device.
        // `xl`/`2xl` keep their roles from the old markup: xl = controls and
        // buttons (17), 2xl/card = cards (25).
        xl: "var(--radius-button)",
        button: "var(--radius-button)",
        "2xl": "var(--radius-card)",
        card: "var(--radius-card)",
        "3xl": "var(--radius-card)",
        sheet: "var(--radius-sheet)",
        "sheet-home": "var(--radius-sheet-home)",
        control: "var(--radius-control)",
        field: "var(--radius-field)",
        tile: "var(--radius-tile)",
        thumb: "var(--radius-thumb)",
        bubble: "var(--radius-bubble)",
        group: "var(--radius-group)",
        chip: "var(--radius-chip)",
        "iz-sheet": "var(--iz-r-sheet)",
        "iz-card": "var(--iz-r-card)",
        "iz-field": "var(--iz-r-field)",
        "iz-tile": "var(--iz-r-tile)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "desc-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "drive-bob": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "check-pop": {
          "0%": { transform: "scale(0)" },
          "60%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        "drawer-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "drift-a": {
          "0%,100%": { transform: "translate(0,0)" },
          "50%": { transform: "translate(14px,-8px)" },
        },
        "drift-b": {
          "0%,100%": { transform: "translate(0,0)" },
          "50%": { transform: "translate(-10px,10px)" },
        },
        "step-fwd": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "step-back": {
          from: { opacity: "0", transform: "translateX(-16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "ios-sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "ios-backdrop-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "ios-alert-in": {
          from: { opacity: "0", transform: "scale(1.15)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "bob-y": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "desc-in": "desc-in 0.2s cubic-bezier(0.2,0,0,1)",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.35s cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scale-in 0.25s cubic-bezier(0.16,1,0.3,1)",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "drive-bob": "drive-bob 1.2s ease-in-out infinite",
        "check-pop": "check-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        "drawer-in": "drawer-in 0.26s cubic-bezier(0.2,0.8,0.2,1)",
        "drift-a": "drift-a 9s ease-in-out infinite",
        "drift-b": "drift-b 11s ease-in-out infinite",
        "bob-y": "bob-y 1.6s ease-in-out infinite",
        // iOS presentation timing (sheets, alerts).
        "ios-sheet-in": "ios-sheet-in 0.42s cubic-bezier(0.32,0.72,0,1)",
        "ios-backdrop-in": "ios-backdrop-in 0.3s ease-out",
        "ios-alert-in": "ios-alert-in 0.3s cubic-bezier(0.32,0.72,0,1)",
        "step-fwd": "step-fwd 0.24s cubic-bezier(0.2,0,0,1)",
        "step-back": "step-back 0.24s cubic-bezier(0.2,0,0,1)",
      },
    },
  },
  plugins: [
    // Platform variants (see lib/platform.ts): `ios:rounded-full`,
    // `standalone:hidden`. They only apply under the matching <html> attribute.
    plugin(({ addVariant }) => {
      addVariant("ios", 'html[data-platform="ios"] &');
      addVariant("standalone", 'html[data-standalone="true"] &');
      // The system keyboard is open (ui/keyboard.ts sets the attribute).
      addVariant("kb", 'html[data-kb="open"] &');
    }),
  ],
} satisfies Config;
