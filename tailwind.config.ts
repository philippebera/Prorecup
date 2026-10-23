import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f2",
          100: "#d5ece0",
          200: "#acd8c2",
          500: "#2f8f5f",
          600: "#23774e",
          700: "#1c5f3f",
          800: "#164a32",
          900: "#0f3323",
        },
        ink: { DEFAULT: "#1d2530", soft: "#4a5565", mute: "#6b7585" },
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
