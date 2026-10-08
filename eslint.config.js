import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "src-tauri/target", "src-tauri/gen"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/*",
                "react-*",
                "@tauri-apps/*",
                "@/ipc",
                "@/ipc/*",
                "@/components",
                "@/components/*",
                "@/ui",
                "@/ui/*",
                "@/features",
                "@/features/*",
                "@/store",
                "@/store/*",
              ],
              message: "领域层必须保持纯 TS（C-04/C-07）：禁止导入 UI/网络/Tauri/IPC。",
            },
          ],
        },
      ],
    },
  },
);
