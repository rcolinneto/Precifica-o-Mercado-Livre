import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Carrega .env.local (entre outros) pro teste de RLS, que precisa de
    // credenciais reais do Supabase. lib/pricing.test.ts não usa nada disso.
    env: loadEnv(mode, import.meta.dirname, ""),
  },
}));
