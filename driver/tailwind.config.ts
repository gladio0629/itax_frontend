import type { Config } from "tailwindcss";

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    // Radius scale is final: buttons 8, cards 12, sheets 16. Pills (full) only
    // for status dots, avatars, the online toggle and chips.
    borderRadius: {
      none: "0",
      button: "8px",
      card: "12px",
      sheet: "16px",
      full: "9999px",
    },
    fontWeight: {
      // Two weights only.
      medium: "500",
      bold: "700",
    },
    extend: {
      colors: {
        bg: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--color-surface-rgb) / <alpha-value>)",
        raised: "rgb(var(--color-raised-rgb) / <alpha-value>)",
        ink: "rgb(var(--color-text-rgb) / <alpha-value>)",
        muted: "rgb(var(--color-muted-rgb) / <alpha-value>)",
        line: "var(--color-line)",
        accent: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        yellow: "rgb(var(--color-yellow-rgb) / <alpha-value>)",
        "on-yellow": "rgb(var(--color-on-yellow-rgb) / <alpha-value>)",
        gold: "var(--color-gold)",
        success: "rgb(var(--color-success-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        "danger-fill": "var(--color-danger-fill)",
        "warning-fill": "var(--color-warning-fill)",
        "on-warning": "var(--color-on-warning)",
      },
      fontFamily: {
        sans: ["InterVariable", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "22px" }],
        lg: ["18px", { lineHeight: "24px" }],
        xl: ["22px", { lineHeight: "28px" }],
        "2xl": ["28px", { lineHeight: "34px" }],
        "3xl": ["36px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
        "4xl": ["44px", { lineHeight: "48px", letterSpacing: "-0.025em" }],
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
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
