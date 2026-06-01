import next from "eslint-config-next";

/**
 * ESLint flat config nativa de Next 16 (core-web-vitals + typescript).
 * doc 12 §CI.
 */
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "docs/**", "data/**", "tasks/**", "next-env.d.ts"],
  },
  ...next,
];

export default eslintConfig;
