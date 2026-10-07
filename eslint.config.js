import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const clockMessage = "Reads the system clock. Inject a Clock instead (see CLAUDE.md).";

export default defineConfig([
  globalIgnores(["**/dist/", "**/coverage/"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript (with checkJs) already reports undefined names.
      "no-undef": "off",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { allowDefaultCaseForExhaustiveSwitch: false, requireDefaultForNonUnion: true },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: clockMessage },
        { object: "performance", property: "now", message: clockMessage },
        { object: "Temporal", property: "Now", message: clockMessage },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: clockMessage,
        },
        { selector: "CallExpression[callee.name='Date']", message: clockMessage },
      ],
    },
  },
  prettier,
]);
