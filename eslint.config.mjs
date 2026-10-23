import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Les photos privées sont servies par URL signée temporaire : next/image (cache/optimiseur) n'est pas adapté.
  { rules: { "@next/next/no-img-element": "off" } },
  { ignores: [".next/**", "node_modules/**"] },
];
