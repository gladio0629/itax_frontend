import type { Config } from "tailwindcss";

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // Night mode follows the app setting (data-theme), not the OS.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    // Redesign v2 radii: sheet 32, card 24, field 20, icon tile 14; buttons
    // and chips are full pills.
    borderRadius: {
      none: "0",
      tile: "14px",
      field: "20px",
      card: "24px",
      sheet: "32px",
      button: "9999px",
      full: "9999px",
    },
    fontWeight: {
      normal: "400",
      // Legacy alias: the design has no 500, old screens map to 600.
      medium: "600",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    },
    extend: {
      colors: {
        // Fixed layer (never flips)
        night: "rgb(var(--color-night-rgb) / <alpha-value>)",
        "night-2": "rgb(var(--color-night-2-rgb) / <alpha-value>)",
        "night-line": "var(--color-night-line)",
        "night-muted": "var(--color-night-muted)",
        brand: "rgb(var(--color-brand-rgb) / <alpha-value>)",
        "on-brand": "rgb(var(--color-on-brand-rgb) / <alpha-value>)",
        sos: "var(--color-sos)",
        "night-warning": "var(--color-night-warning)",
        "night-danger": "var(--color-night-danger)",
        "night-bar": "var(--color-night-bar)",
        "night-brand-soft": "var(--color-night-brand-soft)",
        star: "var(--color-star)",
        payme: "var(--color-payme)",
        click: "var(--color-click)",
        "star-soft": "var(--color-star-soft)",
        "control-off": "var(--color-control-off)",
        dash: "var(--color-dash)",
        "ph-1": "var(--color-ph-1)",
        "ph-2": "var(--color-ph-2)",
        "ph-3": "var(--color-ph-3)",
        // Sheet layer (flips with night mode)
        bg: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--color-surface-rgb) / <alpha-value>)",
        raised: "rgb(var(--color-raised-rgb) / <alpha-value>)",
        ink: "rgb(var(--color-text-rgb) / <alpha-value>)",
        muted: "rgb(var(--color-muted-rgb) / <alpha-value>)",
        line: "rgb(var(--color-line-rgb) / <alpha-value>)",
        "brand-ink": "rgb(var(--color-brand-ink-rgb) / <alpha-value>)",
        "brand-soft": "rgb(var(--color-brand-soft-rgb) / <alpha-value>)",
        success: "rgb(var(--color-brand-ink-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        "danger-soft": "var(--color-danger-soft)",
        "danger-fill": "rgb(var(--color-danger-rgb) / <alpha-value>)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        "warning-icon": "var(--color-warning-icon)",
        "warning-soft": "var(--color-warning-soft)",
        // Solid warning fill (#F79009) with Ink on it (banners).
        "warning-fill": "var(--color-warning-icon)",
        "on-warning": "rgb(var(--color-night-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Manrope", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Small caps label: 11px / 700 / 0.8px tracking (see .label-caps).
        "2xs": ["11px", { lineHeight: "14px" }],
        xs: ["12px", { lineHeight: "16px" }],
        "13": ["13px", { lineHeight: "18px" }],
        sm: ["14px", { lineHeight: "20px" }],
        "15": ["15px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "22px" }],
        "17": ["17px", { lineHeight: "22px" }],
        lg: ["18px", { lineHeight: "24px" }],
        xl: ["22px", { lineHeight: "28px" }],
        "2xl": ["28px", { lineHeight: "34px" }],
        "3xl": ["36px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
        "4xl": ["44px", { lineHeight: "48px", letterSpacing: "-0.025em" }],
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        float: "var(--shadow-float)",
        none: "none",
      },
      transitionTimingFunction: { DEFAULT: EASE },
      transitionDuration: { DEFAULT: "240ms" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.6)", opacity: "0.55" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        radar: {
          "0%": { transform: "translate(-50%,-50%) scale(0.2)", opacity: "0.5" },
          "100%": { transform: "translate(-50%,-50%) scale(1)", opacity: "0" },
        },
        breathe: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        "check-pop": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
        halo: { "0%": { transform: "scale(1)", opacity: "0.45" }, "100%": { transform: "scale(1.08, 1.5)", opacity: "0" } },
        deplete: { from: { transform: "scaleX(1)" }, to: { transform: "scaleX(0)" } },
      },
      animation: {
        "fade-in": `fade-in 240ms ${EASE} both`,
        "fade-up": `fade-up 280ms ${EASE} both`,
        "sheet-up": `sheet-up 280ms ${EASE} both`,
        "pulse-ring": `pulse-ring 1.8s ${EASE} infinite`,
        radar: `radar 3s ${EASE} infinite both`,
        breathe: `breathe 2s ${EASE} infinite`,
        "check-pop": `check-pop 280ms ${EASE} both`,
        shimmer: `shimmer 1.4s ${EASE} infinite`,
        spin: "spin 0.9s linear infinite",
        halo: `halo 1.8s ${EASE} infinite`,
      },
    },
  },
  plugins: [],
} satisfies Config;
