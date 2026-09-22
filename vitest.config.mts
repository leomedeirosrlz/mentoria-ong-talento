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
    include: ["tests/**/*.test.ts"],
  },
});
