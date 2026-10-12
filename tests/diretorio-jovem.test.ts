import { describe, expect, it } from "vitest";
import {
  demoJovemColegas,
  demoJovemContatos,
  demoJovemPerfil,
  demoPessoas,
  demoPropostas,
  demoSolicitacoesVisiveis,
} from "@/lib/demo/queries";
import { getDemoData } from "@/lib/demo/data";

// A demo promete o mesmo recorte das views da 0076 — estes testes travam a
// fronteira: quem aparece no diretório do jovem, o que vaza de contato e
// quais profiles a staff ainda lê depois do profiles_select apertado.
describe("demoJovemColegas — mentorados_turma (0076)", () => {
  const colegas = demoJovemColegas("mentorado");
  const nomes = colegas.map((c) => c.nome);

  it("só lista colega da mesma turma E com conta", () => {
    // T1 + profile_id: Caio e Dandara — os dois aparecem
    expect(nomes).toContain("Caio Henrique Oliveira");
    expect(nomes).toContain("Dandara Souza");
    // Eduardo e Pedro dividem a T1 mas não têm login → invisíveis
    expect(nomes).not.toContain("Eduardo Lima");
    expect(nomes).not.toContain("Pedro Henrique Almeida");
    // Isabela é da turma 2025/2026 — coorte diferente
    expect(colegas).toHaveLength(2);
  });

  it("whatsapp só sai atrás do opt-in do próprio colega", () => {
    const caio = colegas.find((c) => c.nome === "Caio Henrique Oliveira");
    const dandara = colegas.find((c) => c.nome === "Dandara Souza");
    expect(caio?.whatsapp).toBe("5511976123002");
    expect(dandara?.whatsapp).toBeNull();
  });

  it("a linha traz só a projeção da view — sem e-mail nem ficha", () => {
    for (const c of colegas) {
      expect(Object.keys(c).sort()).toEqual([
        "avatar_path",
        "cidade",
        "id",
        "interesses",
        "nome",
        "nome_social",
        "uf",
        "whatsapp",
      ]);
    }
  });
});

describe("demoJovemPerfil — jovem_perfil (0076)", () => {
  it("expõe contato_compartilhado e nunca notas/documento", () => {
    const p = demoJovemPerfil("mentorado");
    expect(p?.contato_compartilhado).toBe(true);
    expect(p).not.toHaveProperty("notas");
    expect(p).not.toHaveProperty("documento_path");
    expect(p).not.toHaveProperty("form_bruto");
  });
});

describe("demoJovemContatos — papel deriva da trilha (0076)", () => {
  const contatos = demoJovemContatos("mentorado");
  const papeis = contatos.map((c) => c.papel);

  it("especialista da trilha sai como 'especialista', não 'mentor'", () => {
    expect(papeis).toContain("especialista");
    expect(papeis).toContain("mentor");
    expect(papeis).toContain("supervisor");
    expect(papeis).toContain("coordenacao");
    // a trilha esp não pode inflar a contagem de mentores DPP
    expect(papeis.filter((p) => p === "mentor")).toHaveLength(1);
  });

  it("repete o adulto por dupla, como o union all da view", () => {
    // o Paulo supervisiona a DPP e as trilhas esp da Ana — a lista repete
    const paulo = contatos.filter(
      (c) => c.papel === "supervisor" && (c.nome ?? "").includes("Paulo")
    );
    expect(paulo.length).toBeGreaterThanOrEqual(2);
  });
});

describe("demoPessoas — profiles_select apertado (0076)", () => {
  const data = getDemoData();
  const idDe = (email: string) =>
    data.profiles.find((p) => p.email === email)?.id;
  const anaLogin = idDe("anabeatriz.silva@gmail.com");
  const caioLogin = idDe("caiohenrique.oliveira@gmail.com");
  const dandaraLogin = idDe("dandara.souza@gmail.com");

  it("coordenação segue vendo todos os profiles", () => {
    const ids = demoPessoas("coordenacao").map((p) => p.id);
    expect(ids).toContain(anaLogin);
    expect(ids).toContain(caioLogin);
    expect(ids).toContain(dandaraLogin);
  });

  it("mentor lê só a conta de jovem da própria dupla", () => {
    // o Ricardo é o mentor DPP da Ana — Caio e Dandara são de outras duplas
    const ids = demoPessoas("mentor_dpp").map((p) => p.id);
    expect(ids).toContain(anaLogin);
    expect(ids).not.toContain(caioLogin);
    expect(ids).not.toContain(dandaraLogin);
    // profiles de adulto seguem livres como sempre
    expect(ids).toContain(idDe("sofia.nogueira@realiza.vc"));
  });

  it("supervisor lê o jovem de QUALQUER dupla supervisionada", () => {
    // o Paulo supervisiona a duplaOk (Ana) e a duplaPend (Caio); a Dandara
    // é supervisionada pela Beatriz → fora do alcance dele
    const ids = demoPessoas("supervisor").map((p) => p.id);
    expect(ids).toContain(anaLogin);
    expect(ids).toContain(caioLogin);
    expect(ids).not.toContain(dandaraLogin);
  });
});

describe("demoPropostas — autor embed segue o profiles_select", () => {
  it("mentorado só resolve a própria linha como autor", () => {
    const data = getDemoData();
    const eu = data.personas.mentorado;
    // o pedido da Bia tem a contra-proposta da Helena — proposta de
    // especialista tem de chegar com autor null (o nome vem do catálogo
    // ou da solicitação achatada, nunca do embed)
    const visiveis = demoSolicitacoesVisiveis("mentorado");
    const comThread = visiveis.filter((s) =>
      data.solicitacaoPropostas.some((p) => p.solicitacao_id === s.id)
    );
    expect(comThread.length).toBeGreaterThan(0);
    for (const s of comThread) {
      for (const p of demoPropostas("mentorado", s.id)) {
        if (p.autor_id === eu.id) {
          expect(p.autor?.nome).toBeTruthy();
        } else {
          expect(p.autor).toBeNull();
        }
      }
    }
  });
});
