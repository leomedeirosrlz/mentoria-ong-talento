import { describe, expect, it } from "vitest";

import { msgsContato } from "@/lib/whatsapp-msgs";
import { msgLinkWhatsApp } from "@/components/forms/link-shared";
import { acaoWhatsAppDupla } from "@/lib/acao-lembrete";
import { lembreteDaDupla } from "@/components/agenda-partes";
import type { DuplaSaude } from "@/lib/ciclo";
import type {
  Dupla,
  Encontro,
  MentoradoPar,
  Profile,
} from "@/lib/types";

// Voz das mensagens de WhatsApp e o deep-link do nudge — a auditoria
// out/2026 achou o mentor assinando "da equipe" e o Lembrar caindo na
// ficha genérica em vez da pendência exata.

const HOJE = new Date("2026-10-07T20:00:00-03:00");

function mkProfile(nome: string): Profile {
  return {
    id: `p-${nome}`,
    user_id: null,
    nome,
    email: `${nome}@x.test`,
    whatsapp: null,
    role: "mentor_dpp",
    ativo: true,
    bio: null,
    linkedin: null,
    areas: null,
    voluntariado: null,
    onboarded_em: null,
  };
}

function mkMentorado(nome: string): MentoradoPar {
  return {
    id: `m-${nome}`,
    nome,
    nome_social: null,
    avatar_path: null,
    whatsapp: null,
    email: null,
    ong_origem: null,
    cidade: null,
    uf: null,
    interesses: [],
    disponibilidade: null,
    situacao: "ativo",
  };
}

function mkEncontro(over: Partial<Encontro>): Encontro {
  return {
    id: "e-limbo",
    dupla_id: "d1",
    numero: 7,
    data_hora: null,
    realizado_em: null,
    duracao_min: 60,
    status: "agendado",
    origem: "plataforma",
    link: null,
    motivo_reagendamento: null,
    registro: null,
    ...over,
  };
}

function mkDupla(over: Partial<Dupla> = {}): Dupla {
  return {
    id: "d1",
    turma: "2026/2027",
    cronograma_id: "c1",
    status: "ativa",
    iniciada_em: "2026-09-01",
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: mkProfile("André Lima"),
    mentorado: mkMentorado("Ana Souza"),
    supervisor: null,
    encontros: [],
    encaminhamentos: [],
    ...over,
  };
}

function mkSaude(over: Partial<DuplaSaude> = {}): DuplaSaude {
  return {
    semaforo: "atencao",
    motivo: "x",
    motivos: ["x"],
    sinais: [],
    apoio: { aberto: false },
    esperado: 6,
    feitos: 6,
    proximo: null,
    registroPendente: false,
    pediuApoio: false,
    apoioJovem: false,
    avaliacaoJovemPendente: 0,
    ...over,
  };
}

describe("msgsContato texto livre — voz do remetente", () => {
  const ctx = {
    eu: "Joana Costa",
    mentorNome: "André Lima",
    mentoradoNome: "Ana Souza",
  };

  it("staff (default): mentor recebe texto assinado pela equipe", () => {
    const m = msgsContato(ctx, { casoMentor: "Consegue preencher hoje?" });
    expect(m.mentor).toBe(
      "Oi André, tudo bem? Aqui é Joana, da equipe do Realiza.vc. Passando pra acompanhar a mentoria com Ana. Consegue preencher hoje?"
    );
  });

  it("staff: mentorado recebe check-in assinado pela equipe", () => {
    const m = msgsContato(ctx);
    expect(m.mentorado).toContain("Aqui é Joana, da equipe do Realiza.vc.");
    expect(m.mentorado).toContain("como está indo a mentoria com André");
  });

  it("sem nome de quem envia: cai no genérico 'a equipe'", () => {
    const m = msgsContato({ ...ctx, eu: undefined });
    expect(m.mentor).toContain("Aqui é a equipe do Realiza.vc.");
  });

  it("mentor remetente: o jovem lê 'seu mentor', nunca 'da equipe'", () => {
    const m = msgsContato(
      { ...ctx, eu: "André Lima", remetente: "mentor" },
      {
        casoMentorado:
          "Passando pra ver como você está. Os encontros seguem abertos pra gente marcar.",
      }
    );
    expect(m.mentorado).toBe(
      "Oi Ana, tudo bem? Aqui é André, seu mentor. Passando pra ver como você está. Os encontros seguem abertos pra gente marcar."
    );
    expect(m.mentorado).not.toContain("da equipe");
  });

  it("mentor remetente sem nome próprio: fallback 'seu mentor'", () => {
    const m = msgsContato({ ...ctx, eu: undefined, remetente: "mentor" });
    expect(m.mentorado).toContain("Aqui é seu mentor.");
  });
});

describe("msgLinkWhatsApp — voz do remetente", () => {
  it("equipe (default): convite institucional", () => {
    const m = msgLinkWhatsApp("PDM", "Ana Souza", "tok", "https://x.test");
    expect(m).toContain("A equipe Realiza.vc te convida");
  });

  it("mentor: assina como a pessoa conhecida do jovem", () => {
    const m = msgLinkWhatsApp(
      "PDM",
      "Ana Souza",
      "tok",
      "https://x.test",
      "André Lima"
    );
    expect(m).toContain("Aqui é André, seu mentor.");
    expect(m).not.toContain("A equipe");
  });
});

describe("deep-link do nudge Lembrar", () => {
  it("acaoWhatsAppDupla: pendência de registro cai no #registrar-<id>", () => {
    const d = mkDupla({
      encontros: [
        mkEncontro({
          id: "e-7",
          numero: 7,
          status: "realizado",
          data_hora: "2026-10-06T22:00:00Z",
        }),
      ],
    });
    const saude = mkSaude({
      sinais: [
        { tipo: "registro_pendente", tom: "atencao", texto: "registro" },
      ],
    });
    const acao = acaoWhatsAppDupla({
      dupla: d,
      saude,
      hoje: HOJE,
      ultimoNudge: null,
      meuNome: "Joana",
      tituloNudge: "Lembrete da coordenação",
    });
    expect(acao.nudge?.href).toBe("/duplas/d1#registrar-e-7");
    expect(acao.nudge?.destino).toBe("mentor");
  });

  it("acaoWhatsAppDupla: sem pendência operacional fica na ficha", () => {
    const d = mkDupla();
    const saude = mkSaude({
      sinais: [{ tipo: "atraso", tom: "atencao", texto: "atraso" }],
    });
    const acao = acaoWhatsAppDupla({
      dupla: d,
      saude,
      hoje: HOJE,
      ultimoNudge: null,
      meuNome: "Joana",
      tituloNudge: "Lembrete da coordenação",
    });
    expect(acao.nudge?.href).toBe("/duplas/d1");
  });

  it("lembreteDaDupla DPP: limbo aponta a linha do encontro", () => {
    const d = mkDupla({
      encontros: [
        mkEncontro({
          id: "e-7",
          numero: 7,
          data_hora: "2026-10-06T22:00:00Z",
        }),
      ],
    });
    const l = lembreteDaDupla(d, "limbo", [], "Joana", HOJE);
    expect(l.href).toBe("/duplas/d1#registrar-e-7");
    expect(l.corpo).toContain("Rolou?");
    expect(l.corpo).toContain("Joana, da equipe");
  });

  it("lembreteDaDupla DPP: registro pendente também cai na linha", () => {
    const d = mkDupla({
      encontros: [
        mkEncontro({
          id: "e-6",
          numero: 6,
          status: "realizado",
          data_hora: "2026-09-30T22:00:00Z",
        }),
      ],
    });
    const l = lembreteDaDupla(d, "registro_pendente", [], "Joana", HOJE);
    expect(l.href).toBe("/duplas/d1#registrar-e-6");
  });

  it("lembreteDaDupla esp: sessão realizada sem registro cai na linha", () => {
    const d = mkDupla({
      trilha: "especialista",
      encontros: [
        mkEncontro({
          id: "s-3",
          numero: 3,
          status: "realizado",
          data_hora: "2026-10-05T22:00:00Z",
        }),
      ],
    });
    const l = lembreteDaDupla(d, "registro_pendente", [], "Joana", HOJE);
    expect(l.href).toBe("/duplas/d1#registrar-s-3");
    expect(l.corpo).toContain("A sessão");
  });

  it("lembreteDaDupla: 'marcar o encontro' não inventa âncora", () => {
    const l = lembreteDaDupla(mkDupla(), "atraso", [], "Joana", HOJE);
    expect(l.href).toBeUndefined();
    // e o texto staff→mentor sai assinado (antes ia sem remetente)
    expect(l.corpo).toContain("Joana, da equipe do Realiza.vc");
  });
});
