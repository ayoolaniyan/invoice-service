import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/", "coverage/", "node_modules/"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            // Express handlers must keep (req, res, next) even when one isn't used
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_|^req$|^res$|^next$", varsIgnorePattern: "^_" }],
            eqeqeq: ["error", "always"],
            "no-console": "error",
            "prefer-const": "error",
        },
    },
    {
        // CLI scripts report progress to the terminal
        files: ["scripts/**/*.ts"],
        rules: {
            "no-console": "off",
        },
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
        },
    }
);
