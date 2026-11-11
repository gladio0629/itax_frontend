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
        "brand-yellow-hover": "var(--color-brand-yellow-hover)",
        success: "rgb(var(--color-success-rgb) / <alpha-value>)",
        "on-yellow": "var(--color-on-yellow)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        border: "var(--color-border)",
        "sidebar-bg": "var(--color-sidebar-bg)",
        "sidebar-text": "rgb(var(--color-sidebar-text-rgb) / <alpha-value>)",
        "sidebar-border": "var(--color-sidebar-border)",
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
        card: "var(--radius-card)",
        sheet: "var(--radius-sheet)",
      },
      transitionDuration: { DEFAULT: "200ms" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0.2, 0, 0, 1)" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.98)" },
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
        "check-pop": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s cubic-bezier(0.2,0,0,1)",
        "slide-up": "slide-up 0.2s cubic-bezier(0.2,0,0,1)",
        "slide-in-right": "slide-in-right 0.2s cubic-bezier(0.2,0,0,1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.2,0,0,1)",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "check-pop": "check-pop 0.2s cubic-bezier(0.2,0,0,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
