import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // domínio puro — sem DOM, sem Next. Datas âncora em America/Sao_Paulo pra
    // getDay()/getDate() baterem com o fuso do programa em qualquer máquina.
    environment: "node",
    env: { TZ: "America/Sao_Paulo" },
    // tests/ é a casa histórica; src/**/*.test.ts cobre specs colocadas
    // junto do domínio (ex.: src/lib/jornada.test.ts do WP7)
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
