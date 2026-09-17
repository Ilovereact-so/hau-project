import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // W produkcji `console.log` jest błędem (debugowe logi nie mają prawa
      // trafić na produkcję i wyciekać do konsoli klienta), ale świadome
      // logowanie serwerowe — warn/error/info — jest dozwolone.
      "no-console": process.env.NODE_ENV === "production" ? ["error", { allow: ["warn", "error", "info"] }] : "off",
      "react-hooks/rules-of-hooks": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      // Nieużywane zmienne/importy: ostrzeżenie, prefiks _ = celowo pominięte
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true,
        "caughtErrorsIgnorePattern": "^_",
      }],
      "func-names": "off",
      "react/jsx-props-no-spreading": "off",
      "react/require-default-props": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-filename-extension": ["warn", { "extensions": [".js", ".jsx", ".ts", ".tsx"] }],
      "import/prefer-default-export": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "import/no-unresolved": ["error", { "ignore": ["\\.css$"] }],
      "react-hooks/exhaustive-deps": ["warn", {
        "additionalHooks": "(useRecoilCallback|useRecoilTransaction_UNSTABLE)"
      }],
    },
  },
  {
    // Skrypty CLI (odpalane ręcznie przez `tsx`) mają wypisywać na konsolę —
    // to ich jedyny interfejs. Blok MUSI być po bloku ogólnym: w płaskiej
    // konfiguracji wygrywa ostatnie dopasowanie.
    files: ["src/scripts/**/*.ts", "scripts/**/*.{ts,mjs}"],
    rules: { "no-console": "off" },
  },
];

export default eslintConfig;
