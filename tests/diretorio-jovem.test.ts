import { describe, expect, it } from "vitest";
import {
  demoEspecialistasCatalogo,
  demoJovemColegas,
  demoJovemContatos,
  demoJovemDiretorio,
  demoJovemDuplas,
  demoJovemEspecialistas,
  demoJovemPerfil,
  demoPessoas,
  demoPropostas,
  demoSolicitacoesVisiveis,
} from "@/lib/demo/queries";
import { getDemoData } from "@/lib/demo/data";
import {
  baldeDaEntrada,
  enriqueceDiretorio,
} from "@/lib/jovem-diretorio";

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

  it("a linha traz só a projeção da view — contato direto e nada mais", () => {
    // 484: a ficha do adulto enriquece pelo catálogo; a linha segue sendo
    // nome, foto e os 2 canais que a jovem_contatos já libera — sem bio,
    // linkedin ou qualquer campo coord-only de profiles
    for (const c of contatos) {
      expect(Object.keys(c).sort()).toEqual([
        "avatar_path",
        "dupla_id",
        "email",
        "id",
        "nome",
        "nome_social",
        "papel",
        "role",
        "whatsapp",
      ]);
    }
  });
});

describe("demoJovemEspecialistas — jovem_especialistas (0075/0086/0101)", () => {
  const catalogo = demoJovemEspecialistas("mentorado");

  it("a projeção pública nunca carrega contato direto nem dado coord", () => {
    // 484: a ficha do especialista enriquece com ESTE recorte — trava a
    // fronteira: sem e-mail, whatsapp, linkedin, notas ou documento
    for (const e of catalogo) {
      expect(Object.keys(e).sort()).toEqual([
        "areas",
        "avatar_path",
        "bio",
        "cargo",
        "cidade",
        "empresa",
        "experiencia_previa",
        "formacao_externa",
        "grade_resumo",
        "id",
        "nome",
        "nome_social",
        "uf",
        "vagas",
        "voluntariado",
      ]);
    }
  });

  it("grade_resumo é período por dia, nunca slot exato", () => {
    for (const e of catalogo) {
      for (const janela of e.grade_resumo ?? []) {
        expect(janela).toMatch(/de manhã|à tarde|à noite/);
        expect(janela).not.toMatch(/\d{2}:\d{2}/);
      }
    }
  });
});

describe("demoJovemDiretorio — jovem_diretorio (0239)", () => {
  const diretorio = demoJovemDiretorio("mentorado");
  const porNome = (nome: string) =>
    diretorio.find((e) => (e.nome_social || e.nome).includes(nome));

  it("a linha traz exatamente a projeção da view — sem contato direto", () => {
    // a fronteira do diretório: whatsapp/email/linkedin nunca entram —
    // o canal direto segue sendo da rede (jovem_contatos)
    for (const e of diretorio) {
      expect(Object.keys(e).sort()).toEqual([
        "areas",
        "avatar_path",
        "bio",
        "cargo",
        "cidade",
        "empresa",
        "experiencia_previa",
        "formacao_externa",
        "grade_resumo",
        "id",
        "interesses",
        "minha_rede",
        "minha_turma",
        "nome",
        "nome_social",
        "papel",
        "tipo",
        "uf",
        "vagas",
        "voluntariado",
      ]);
    }
  });

  it("dedup por id — ninguém aparece duas vezes", () => {
    const ids = diretorio.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("adultos do programa entram como 'adulto', com a rede marcada", () => {
    const ricardo = porNome("Ricardo");
    expect(ricardo?.tipo).toBe("adulto");
    expect(ricardo?.minha_rede).toBe(true);
    // adulto fora da rede também aparece — o diretório é o programa
    const joaoPedro = porNome("João Pedro");
    expect(joaoPedro?.tipo).toBe("adulto");
    expect(joaoPedro?.minha_rede).toBe(false);
  });

  it("jovens com conta entram como 'jovem' — colega marca rede e turma", () => {
    const caio = porNome("Caio");
    const dandara = porNome("Dandara");
    expect(caio?.tipo).toBe("jovem");
    expect(caio?.papel).toBe("mentorado");
    expect(caio?.minha_rede).toBe(true);
    expect(caio?.minha_turma).toBe(true);
    expect(dandara?.minha_rede).toBe(true);
    // sem conta, não entra — mesmo recorte da view (profile_id not null)
    expect(porNome("Eduardo")).toBeUndefined();
    expect(porNome("Isabela")).toBeUndefined();
    expect(porNome("Wendel")).toBeUndefined();
    // o próprio jovem nunca aparece
    expect(porNome("Ana Beatriz")).toBeUndefined();
  });

  it("especialistas entram pelo braço catálogo — prioridade vence o adulto", () => {
    const catalogoIds = new Set(demoJovemEspecialistas("mentorado").map((e) => e.id));
    for (const e of diretorio.filter((d) => catalogoIds.has(d.id))) {
      expect(e.tipo).toBe("especialista");
      expect(e.papel).toBe("mentor_especialista");
    }
  });

  it("especialista da trilha chega sem minha_rede — quirk fiel da view", () => {
    // o distinct on (id) prefere a linha de catálogo (prioridade 0) e
    // perde o minha_rede=true do braço adulto — a página repara pelo
    // enriqueceDiretorio; a demo espelha o comportamento cru da view
    const espTrilha = diretorio.find(
      (e) =>
        e.tipo === "especialista" &&
        demoJovemContatos("mentorado").some(
          (c) => c.id === e.id && c.papel === "especialista"
        )
    );
    expect(espTrilha).toBeDefined();
    expect(espTrilha?.minha_rede).toBe(false);
  });
});

describe("enriqueceDiretorio — a rede é a faceta marcada (0239)", () => {
  const diretorio = demoJovemDiretorio("mentorado");
  const contatos = demoJovemContatos("mentorado");
  const colegas = demoJovemColegas("mentorado");
  const duplas = demoJovemDuplas("mentorado");
  const pessoas = enriqueceDiretorio(diretorio, contatos, colegas, duplas);
  const porNome = (nome: string) =>
    pessoas.find((p) => (p.nome_social || p.nome).includes(nome));

  it("rede = união dos contatos e colegas — o especialista da trilha entra", () => {
    const redeIds = new Set(
      pessoas.filter((p) => p.rede).map((p) => p.id)
    );
    for (const c of contatos) if (c.id) expect(redeIds).toContain(c.id);
    for (const c of colegas) if (c.id) expect(redeIds).toContain(c.id);
  });

  it("vínculo na voz do jovem + selo de dupla não-ativa", () => {
    expect(porNome("Ricardo")?.vinculo).toBe("Seu mentor");
    const caio = porNome("Caio");
    expect(caio?.vinculo).toBe("Colega da turma");
    // a trilha esp concluída da Bia seloa a pessoa quando o contato é dela
    const helenaContato = contatos.find(
      (c) => (c.nome ?? "").includes("Helena") && c.papel === "especialista"
    );
    if (helenaContato) {
      const helena = porNome("Helena");
      expect(helena?.rede).toBe(true);
      expect(helena?.vinculo).toBe("Seu especialista");
    }
  });

  it("baldeDaEntrada mapeia as facetas uma por linha", () => {
    expect(baldeDaEntrada({ tipo: "jovem", papel: "mentorado" })).toBe("colegas");
    expect(baldeDaEntrada({ tipo: "especialista", papel: "mentor_especialista" })).toBe("especialistas");
    expect(baldeDaEntrada({ tipo: "adulto", papel: "mentor_dpp" })).toBe("mentores");
    expect(baldeDaEntrada({ tipo: "adulto", papel: "supervisor" })).toBe("equipe");
    expect(baldeDaEntrada({ tipo: "adulto", papel: "coordenacao" })).toBe("equipe");
    // híbrido adulto com papel projetado especialista cai no balde esp
    expect(baldeDaEntrada({ tipo: "adulto", papel: "mentor_especialista" })).toBe("especialistas");
  });
});

describe("demoEspecialistasCatalogo — especialistas_catalogo (0239)", () => {
  it("staff lê a mesma projeção do catálogo do jovem, sem o recorte D9", () => {
    const catalogo = demoEspecialistasCatalogo("coordenacao");
    expect(catalogo.length).toBeGreaterThan(0);
    const jovem = new Set(
      demoJovemEspecialistas("mentorado").map((e) => e.id)
    );
    // todo especialista do jovem também é do staff — e o staff pode ver
    // o DPP do jovem se ele for híbrido (sem recorte D9)
    for (const e of catalogo) {
      expect(Object.keys(e).sort()).toEqual([
        "areas",
        "avatar_path",
        "bio",
        "cargo",
        "cidade",
        "empresa",
        "experiencia_previa",
        "formacao_externa",
        "grade_resumo",
        "id",
        "nome",
        "nome_social",
        "uf",
        "vagas",
        "voluntariado",
      ]);
      void jovem;
    }
    for (const papel of [
      "mentor_dpp",
      "mentor_especialista",
      "supervisor",
    ] as const) {
      expect(demoEspecialistasCatalogo(papel).length).toBe(catalogo.length);
    }
  });

  it("mentorado não lê o catálogo staff — a view fecha o gate", () => {
    expect(demoEspecialistasCatalogo("mentorado")).toEqual([]);
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
