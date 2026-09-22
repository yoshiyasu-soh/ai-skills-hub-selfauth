import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        header: "var(--header-bg)",
        footer: "rgb(var(--footer-bg) / <alpha-value>)",
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          hover: "rgb(var(--border-hover) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--text) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
        },
        signal: "rgb(var(--signal) / <alpha-value>)",
        skill: {
          DEFAULT: "rgb(var(--skill) / <alpha-value>)",
          dim: "var(--skill-dim)",
        },
        prompt: {
          DEFAULT: "rgb(var(--prompt) / <alpha-value>)",
          dim: "var(--prompt-dim)",
        },
        external: {
          DEFAULT: "rgb(var(--external) / <alpha-value>)",
          dim: "var(--external-dim)",
        },
        warn: {
          bg: "var(--warn-bg)",
          border: "var(--warn-border)",
        },
        onaccent: "rgb(var(--on-accent) / <alpha-value>)",
        cta: {
          DEFAULT: "rgb(var(--cta-bg) / <alpha-value>)",
          hover: "rgb(var(--cta-bg-hover) / <alpha-value>)",
          text: "rgb(var(--cta-text) / <alpha-value>)",
        },
        logo: {
          bg: "rgb(var(--logo-bg) / <alpha-value>)",
          fg: "rgb(var(--logo-fg) / <alpha-value>)",
        },
        avatar: {
          bg: "rgb(var(--avatar-bg) / <alpha-value>)",
          fg: "rgb(var(--avatar-fg) / <alpha-value>)",
          border: "rgb(var(--avatar-border) / <alpha-value>)",
        },
        active: {
          DEFAULT: "rgb(var(--active-bg) / <alpha-value>)",
          text: "rgb(var(--active-text) / <alpha-value>)",
        },
        selection: {
          text: "rgb(var(--selection-text) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Manrope", "Hiragino Sans", "Yu Gothic", "sans-serif"],
        display: ["Space Grotesk", "Hiragino Sans", "Yu Gothic", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        popover: "var(--shadow-popover)",
        "item-hover": "var(--item-shadow-hover)",
        "guide-hover": "var(--guide-shadow-hover)",
      },
      ringColor: {
        signal: "var(--signal-ring)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
      },
    },
  },
  plugins: [typography],
};
