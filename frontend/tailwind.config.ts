import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a5f",
        },
        danger: { 500: "#ef4444", 600: "#dc2626" },
        warning: { 500: "#f59e0b", 600: "#d97706" },
        success: { 500: "#22c55e", 600: "#16a34a" },
      },
    },
  },
  plugins: [],
};

export default config;
