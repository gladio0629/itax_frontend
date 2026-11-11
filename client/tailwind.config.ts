import type { Config } from "tailwindcss";

export default {
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
      fontFamily: {
        sans: ["InterVariable", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        lg: ["18px", { lineHeight: "24px" }],
        xl: ["28px", { lineHeight: "34px" }],
      },
      boxShadow: {
        soft: "0 2px 12px -2px var(--shadow-color)",
        softer: "0 1px 4px 0 var(--shadow-color)",
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
        "step-fwd": "step-fwd 0.24s cubic-bezier(0.2,0,0,1)",
        "step-back": "step-back 0.24s cubic-bezier(0.2,0,0,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
