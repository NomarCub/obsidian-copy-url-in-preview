import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default defineConfig([
    { ignores: ["main.js"] },
    ...obsidianmd.configs.recommended,
    {
        files: ["**/*.{ts,mts,mjs}"],
        extends: [
            eslint.configs.recommended,
            tseslint.configs.strictTypeChecked,
            tseslint.configs.stylisticTypeChecked,
        ],
        languageOptions: {
            parserOptions: { projectService: true },
        },
        rules: {
            "@typescript-eslint/explicit-function-return-type": ["error", { allowExpressions: true }],
            "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
            "@typescript-eslint/no-non-null-assertion": "off",
            // TODO(75): re-enable
            "eslint-comments/no-restricted-disable": ["off"],
        },
    },
    {
        // Node.js is allowed in .mts build files
        files: ["**/*.mts"],
        rules: {
            "obsidianmd/no-nodejs-modules": "off",
            "obsidianmd/rule-custom-message": "off",
        },
    },
]);
