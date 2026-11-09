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
        "brand-yellow": "var(--color-brand-yellow)",
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
        button: "var(--radius-button)",
        "2xl": "16px",
        "3xl": "24px",
        sheet: "var(--radius-sheet)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
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
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.35s cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scale-in 0.25s cubic-bezier(0.16,1,0.3,1)",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "drive-bob": "drive-bob 1.2s ease-in-out infinite",
        "check-pop": "check-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
