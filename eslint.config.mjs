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
    rules: {
      // Wyłączenie ostrzeżeń o nienazwanych funkcjach (często występuje w komponentach Next.js)
      "func-names": "off",
      // Pozwala na używanie props spreading w komponentach
      "react/jsx-props-no-spreading": "off",
      // Wyłącza wymóg defaultProps w React
      "react/require-default-props": "off",
      // Pozwala na używanie wyrażeń JSX bez importu React (Next.js 13+)
      "react/react-in-jsx-scope": "off",
      // Wyłącza ostrzeżenia o brakujących typach propsów (TypeScript to sprawdza)
      "react/prop-types": "off",
      // Pozwala na używanie dowolnych rozszerzeń plików
      "react/jsx-filename-extension": ["warn", { "extensions": [".js", ".jsx", ".ts", ".tsx"] }],
      // Bardziej elastyczne reguły dla eksportów
      "import/prefer-default-export": "off",
      // Wyłącza ostrzeżenia o używaniu console.log (pomocne w developmencie)
      "no-console": "warn",
      // Pozwala na nieużywane zmienne zaczynające się od _
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      // Bardziej elastyczne reguły dla promisów
      "@typescript-eslint/no-floating-promises": "off",
      // Wyłącza wymóg return type dla funkcji (TypeScript często może wywnioskować)
      "@typescript-eslint/explicit-function-return-type": "off",
      // Pozwala na any w niektórych sytuacjach
      "@typescript-eslint/no-explicit-any": "warn",
      // Wyłącza ostrzeżenia o styled-components props
      "@typescript-eslint/no-unused-expressions": "off",
      // Pozwala na import styli CSS
      "import/no-unresolved": ["error", { "ignore": ["\\.css$"] }],
    },
  },
];

export default eslintConfig;
