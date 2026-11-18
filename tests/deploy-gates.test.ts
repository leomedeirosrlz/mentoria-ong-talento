// Gates de publicação: apagar um `if:` aqui publica tudo em todo push, e
// nenhuma tela avisa — o [deploy] que segura a produção mora no Ignored
// Build Step da Vercel, fora do repo, então o workflow é o que dá pra
// amarrar. Este spec trava os contratos dos arquivos de CI do repo.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const wf = (nome: string) =>
  readFileSync(path.join(process.cwd(), ".github", "workflows", nome), "utf8");

const ci = wf("ci.yml");
const deploy = wf("deploy.yml");
const preview = wf("e2e-preview.yml");

describe("gates de publicação", () => {
  it("ci roda typegen + tsc + eslint + vitest + schema-contract", () => {
    for (const passo of [
      "pnpm exec next typegen",
      "npx tsc --noEmit",
      "npx eslint src/",
      "pnpm test",
      "check-schema-contract.mjs",
    ]) {
      expect(ci).toContain(passo);
    }
  });

  it("deploy legado nunca dispara sozinho", () => {
    const gatilhos = /^on:\n([\s\S]*?)(?=^\w)/m.exec(deploy)?.[1] ?? "";
    expect(gatilhos).toContain("workflow_dispatch");
    expect(gatilhos, "deploy.yml voltou a disparar automático").not.toMatch(/\bpush:|\bpull_request:|\bschedule:/);
    // defesa em profundidade: mesmo via dispatch, só com a tag autorizada
    expect(deploy).toContain("contains(github.event.head_commit.message, '[deploy]')");
  });

  it("e2e-preview é opt-in pela tag e usa a fila única sem cancelar", () => {
    expect(preview).toContain("[e2e-preview]");
    expect(preview).toContain("deployment_status");
    expect(preview).toContain("state == 'success'");
    const grupo = /group:\s*(\S+)/.exec(preview)?.[1];
    expect(grupo, "a fila compartilhada e2e-staging evita dois runs apagando a fixture um do outro").toBe("e2e-staging");
    expect(preview).toContain("cancel-in-progress: false");
  });
});
