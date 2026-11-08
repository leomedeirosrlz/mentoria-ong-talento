import { describe, expect, it } from "vitest";
import { promptMcp } from "./mcp-prompt";

const ORIGEM = "https://app.realiza.vc";

describe("promptMcp", () => {
  it("embeds the token in the header and in the client config", () => {
    const p = promptMcp(ORIGEM, "rlz_mcp_abc123");
    expect(p).toContain(`POST ${ORIGEM}/api/mcp`);
    expect(p).toContain("Authorization: Bearer rlz_mcp_abc123");
    expect(p).toContain('"Authorization": "Bearer rlz_mcp_abc123"');
    expect(p).toContain(`"url": "${ORIGEM}/api/mcp"`);
    expect(p).not.toContain("<seu-token-rlz_mcp>");
  });

  it("uses a placeholder when no fresh token exists", () => {
    const p = promptMcp(ORIGEM);
    expect(p).toContain("Bearer <seu-token-rlz_mcp>");
    expect(p).not.toContain("undefined");
  });

  it("carries the program context and the write-confirmation note", () => {
    const p = promptMcp(ORIGEM, null);
    expect(p).toContain("Programa de Mentoria");
    expect(p).toContain("prévia antes de executar");
    expect(p).toContain("mcpServers");
  });
});
