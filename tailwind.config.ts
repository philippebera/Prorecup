import type { Config } from "tailwindcss";

// Palette inspirée d'un style « mobilité premium » : lime électrique en accent,
// vert forêt et quasi-noir pour les surfaces fortes, fond clair légèrement chaud.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F1F6EC",
          100: "#E2EDD6",
          200: "#C7DBB4",
          300: "#9DBF83",
          500: "#2F6B45",
          600: "#1F4D33",
          700: "#1A4029",
          800: "#143220",
          900: "#0D2116",
        },
        lime: {
          DEFAULT: "#C6F135",
          soft: "#EEFAC4",
          dark: "#AED61C",
        },
        ink: { DEFAULT: "#111513", soft: "#424A45", mute: "#6E7671" },
        canvas: "#F1F2EC",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(17,21,19,0.04), 0 8px 24px -12px rgba(17,21,19,0.12)",
        float: "0 24px 48px -20px rgba(17,21,19,0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
