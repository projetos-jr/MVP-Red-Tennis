import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const eslintConfig = [
  ...nextVitals,
  {
    ignores: [".next/**", ".open-next/**", ".wrangler/**", ".claude/**", "next-env.d.ts"],
  },
  // Gravar e assincrono (o banco responde depois): `gravar(...)` e
  // `executar(...)` devolvem uma promessa. Esta regra acusa quem usa o
  // resultado sem `await`, como em `if (gravar(...))`, que seria sempre
  // verdadeiro.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksConditionals: true, checksSpreads: true, checksVoidReturn: false },
      ],
    },
  },
];

export default eslintConfig;
