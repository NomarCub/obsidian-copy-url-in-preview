import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config({
    files: ["**/*.ts", "**/*.mjs"],
    extends: [
        eslint.configs.recommended,
        tseslint.configs.strictTypeChecked,
        tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
        parserOptions: { projectService: true, project: true },
    },
    rules: {
        "@typescript-eslint/explicit-function-return-type": [
            "error",
            { allowExpressions: true },
        ],
        "@typescript-eslint/restrict-template-expressions": [
            "error",
            { allowNumber: true },
        ],
        "@typescript-eslint/no-non-null-assertion": "off",
    },
});
