import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

// Migraciones leídas en Node y pasadas al Worker de test como binding
export default defineConfig(async () => {
  const migraciones = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migraciones, GROQ_API_KEY: "test-key" } },
      }),
    ],
    test: { setupFiles: ["./tests/setup.ts"] },
  };
});
