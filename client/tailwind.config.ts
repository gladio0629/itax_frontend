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
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        softer: "var(--shadow-softer)",
        inner5: "inset 0 1px 0 0 rgba(255,255,255,0.18)",
      },
      borderRadius: {
        // Tightened scale: buttons/inputs 8px, cards 12px, sheets 16px.
        // `xl`/`2xl` are overridden because the app's existing markup
        // already uses them as the de facto button/card sizes everywhere.
        xl: "var(--radius-button)",
        button: "var(--radius-button)",
        "2xl": "var(--radius-card)",
        card: "var(--radius-card)",
        "3xl": "var(--radius-card)",
        sheet: "var(--radius-sheet)",
        group: "var(--radius-group)",
        chip: "var(--radius-chip)",
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
    }),
  ],
} satisfies Config;
