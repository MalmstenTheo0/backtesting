import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Syne"', "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        panel: "12px",
        control: "8px",
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "section-title": "var(--section-title)",
        "metric-label": "var(--metric-label)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        positive: "var(--positive)",
        "positive-bg": "var(--positive-bg)",
        "chart-portfolio": "var(--chart-portfolio)",
        "chart-invested": "var(--chart-invested)",
        "chart-price": "var(--chart-price)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
      },
    },
  },
  plugins: [],
} satisfies Config;
