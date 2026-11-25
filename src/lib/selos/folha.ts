import { ARTE } from "./index";

// Entrada do `fi` (skill fun-isometric) pra revisar a arte:
//   bun ~/.claude/skills/fun-isometric/bin/fi.mjs check src/lib/selos/folha.ts
//   bun ~/.claude/skills/fun-isometric/bin/fi.mjs sheet src/lib/selos/folha.ts <id> --palette paleta.json
// O `fi` precisa do fun.ts ao lado deste arquivo — é por isso que mora aqui.
export const TODAS = Object.values(ARTE);
