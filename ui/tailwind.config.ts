import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101217",
        "ink-soft": "#1f2430",
        cream: "#f8f2e9",
        sand: "#f1e5d2",
        clay: "#c0733f",
        monero: "#f26822",
        sage: "#5d7a6a",
        fog: "rgba(16, 18, 23, 0.08)",
        card: "rgba(248, 242, 233, 0.88)",
        stroke: "rgba(16, 18, 23, 0.18)",
      },
      fontFamily: {
        sans: ["Space Grotesk", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["Crimson Pro", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 18px 36px rgba(16, 18, 23, 0.08)",
        card: "0 24px 50px rgba(16, 18, 23, 0.12)",
        deep: "0 24px 60px rgba(16, 18, 23, 0.26)",
      },
      borderRadius: {
        xl: "1.2rem",
        "2xl": "1.6rem",
        "3xl": "1.8rem",
      },
    },
  },
  plugins: [],
};

export default config;
