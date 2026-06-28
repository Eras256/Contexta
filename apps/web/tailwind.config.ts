import type { Config } from "tailwindcss";

/**
 * Institutional dark theme. "ink" = backgrounds, "brand" = Stellar-adjacent
 * teal/blue, "accent" = warm signal for agentic actions.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#080b14",
          900: "#0b1020",
          850: "#0f1628",
          800: "#141d33",
          700: "#1d2942",
          600: "#2a3a5c",
        },
        brand: {
          DEFAULT: "#2dd4bf",
          400: "#34d399",
          500: "#14b8a6",
          600: "#0d9488",
        },
        accent: {
          DEFAULT: "#a78bfa",
          gold: "#f5b54a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 30px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};

export default config;
