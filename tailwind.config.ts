import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#64748b",
        line: "#dbe3ee",
        panel: "#ffffff",
        wash: "#f5f7fb",
        teal: "#0f766e",
        amber: "#b45309",
        danger: "#b91c1c"
      },
      boxShadow: {
        soft: "0 12px 40px rgba(23, 32, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
