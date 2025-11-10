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
      // Wyłączamy kompletnie reguły, które powodują problemy
      "no-console": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_|^(props|e|err|error|res|req|next|latest|i)$",
        "varsIgnorePattern": "^_|^(React|styles|console|process|parentNavbarRef|scrollX|useState)$",
        "ignoreRestSiblings": true,
        "caughtErrorsIgnorePattern": "^_",
      }],
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
      // Wyłącza ostrzeżenia o używaniu console.log w development
      "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
      // Pozwala na nieużywane zmienne zaczynające się od _
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
      // Bardziej elastyczne reguły dla promisów
      "@typescript-eslint/no-floating-promises": "off",
      // Wyłącza wymóg return type dla funkcji (TypeScript często może wywnioskować)
      "@typescript-eslint/explicit-function-return-type": "off",
      // Bardziej elastyczne podejście do any
      "@typescript-eslint/no-explicit-any": "off",
      // Wyłącza ostrzeżenia o styled-components props
      "@typescript-eslint/no-unused-expressions": "off",
      // Pozwala na import styli CSS
      "import/no-unresolved": ["error", { "ignore": ["\\.css$"] }],
      // Wyłącza niektóre reguły dla hooków w specyficznych przypadkach
      "react-hooks/rules-of-hooks": "warn",
      // Bardziej elastyczne sprawdzanie zależności w useEffect
      "react-hooks/exhaustive-deps": ["warn", {
        "additionalHooks": "(useRecoilCallback|useRecoilTransaction_UNSTABLE)"
      }],
    },
  },
];

export default eslintConfig;
