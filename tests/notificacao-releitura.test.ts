import { describe, expect, it } from "vitest";
import {
  reescreveTitulo,
  relerTitulosNotificacao,
} from "@/lib/notificacao-releitura";
import type { Notificacao } from "@/lib/types";

// 027 (FR-011b/FR-012) — a guarda da 0019 torna a row imutável, então a
// leitura promove pro título a frase que o mint guardou no corpo. As
// fixtures abaixo são os corpos EXATOS das migrations (0086, 0087, 0097,
// 0101, 0102, 0156, 0216, 0220): se a mint mudar, o teste quebra junto e a
// tabela é revista.

describe("reescreveTitulo — pares ambíguos da tabela", () => {
  it("Sugestão confirmada: promove quem confirmou e deixa o próximo passo no corpo", () => {
    expect(
      reescreveTitulo(
        "solicitacao_registrada",
        "Sugestão confirmada",
        "Ana Beatriz Souza confirmou a sua sugestão de especialista — o pedido seguiu."
      )
    ).toEqual({
      titulo: "Ana Beatriz Souza confirmou a sua sugestão de especialista",
      corpo: "O pedido seguiu.",
    });
  });

  it("Sugestão dispensada (frase única): o corpo inteiro vira título", () => {
    expect(
      reescreveTitulo(
        "solicitacao_cancelada",
        "Sugestão dispensada",
        "Larissa Campos dispensou a sugestão de especialista por enquanto."
      )
    ).toEqual({
      titulo: "Larissa Campos dispensou a sugestão de especialista por enquanto",
      corpo: null,
    });
  });

  it("Pedido em aberto (mural): o sufixo 'o mural decide' vira o corpo", () => {
    expect(
      reescreveTitulo(
        "solicitacao_registrada",
        "Pedido de especialista em aberto",
        "Igor Batista confirmou a sugestão do mentor — o mural decide."
      )
    ).toEqual({
      titulo: "Igor Batista confirmou a sugestão do mentor",
      corpo: "O mural decide.",
    });
    // a 2ª mint em aberto (0087) — sem nome escolhido
    expect(
      reescreveTitulo(
        "solicitacao_registrada",
        "Pedido de especialista em aberto",
        "Igor Batista pediu apoio de especialista sem escolher um nome — o mural decide."
      )
    ).toEqual({
      titulo: "Igor Batista pediu apoio de especialista sem escolher um nome",
      corpo: "O mural decide.",
    });
  });

  it("Pedido liberado (0101): a frase diz quem liberou", () => {
    expect(
      reescreveTitulo(
        "solicitacao_registrada",
        "Pedido liberado",
        "A coordenação liberou seu pedido de especialista."
      )
    ).toEqual({
      titulo: "A coordenação liberou seu pedido de especialista",
      corpo: null,
    });
  });

  it("Nova proposta de horário (0087): a contra-proposta vira título", () => {
    expect(
      reescreveTitulo(
        "solicitacao_proposta",
        "Nova proposta de horário",
        "Chegou uma contra-proposta pro pedido de especialista."
      )
    ).toEqual({
      titulo: "Chegou uma contra-proposta pro pedido de especialista",
      corpo: null,
    });
  });

  it("Pedido aceito / Proposta aceita: o desfecho fica no corpo", () => {
    expect(
      reescreveTitulo(
        "especialista_aceitou",
        "Pedido de especialista aceito",
        "Seu pedido pra Ana Beatriz foi aceito — sessão marcada."
      )
    ).toEqual({
      titulo: "Seu pedido pra Ana Beatriz foi aceito",
      corpo: "Sessão marcada.",
    });
    expect(
      reescreveTitulo(
        "especialista_aceitou",
        "Proposta aceita",
        "Sua proposta de horário foi aceita — sessão marcada."
      )
    ).toEqual({
      titulo: "Sua proposta de horário foi aceita",
      corpo: "Sessão marcada.",
    });
  });

  it("Dupla concluiu/reta final: o checklist fica no corpo", () => {
    expect(
      reescreveTitulo(
        "dupla_formada",
        "Dupla concluiu a jornada",
        "Último encontro de Ana Beatriz registrado — falta o checklist de encerramento na ficha."
      )
    ).toEqual({
      titulo: "Último encontro de Ana Beatriz registrado",
      corpo: "Falta o checklist de encerramento na ficha.",
    });
    expect(
      reescreveTitulo(
        "dupla_reta_final",
        "Dupla na reta final",
        "Ana Beatriz e o mentor têm 2 encontros pela frente — dá pra adiantar o encerramento."
      )
    ).toEqual({
      titulo: "Ana Beatriz e o mentor têm 2 encontros pela frente",
      corpo: "Dá pra adiantar o encerramento.",
    });
  });

  it("Resposta de terceiros e intervenção da Liza", () => {
    expect(
      reescreveTitulo(
        "terceiro_respondeu",
        "Resposta de avaliação por terceiros",
        "Rafaela Duarte respondeu sobre Ana Beatriz Souza."
      )
    ).toEqual({
      titulo: "Rafaela Duarte respondeu sobre Ana Beatriz Souza",
      corpo: null,
    });
    expect(
      reescreveTitulo(
        "plano_intervencao",
        "Intervenção sugerida pela Liza",
        "A Liza sugeriu uma intervenção pra uma dupla — veja o contexto na ficha."
      )
    ).toEqual({
      titulo: "A Liza sugeriu uma intervenção pra uma dupla",
      corpo: "Veja o contexto na ficha.",
    });
  });
});

describe("reescreveTitulo — fail-safe", () => {
  it("par fora da tabela passa intacto", () => {
    expect(
      reescreveTitulo("comunicado", "Reunião de supervisão", "corpo qualquer")
    ).toBeNull();
    expect(
      reescreveTitulo("avaliacao_pendente", "Como foi seu encontro?", "Conte em 1 minuto.")
    ).toBeNull();
  });

  it("título da tabela sem corpo não é reescrito", () => {
    expect(
      reescreveTitulo("solicitacao_registrada", "Sugestão confirmada", null)
    ).toBeNull();
    expect(
      reescreveTitulo("solicitacao_registrada", "Sugestão confirmada", "   ")
    ).toBeNull();
  });

  it("corpo que não bate no formato mintado não é reescrito", () => {
    // "mural" exige o sufixo; "emdash" sem " — " cai pro frase e promove o
    // corpo inteiro — a frase promovida é sempre conteúdo real mintado
    expect(
      reescreveTitulo(
        "solicitacao_registrada",
        "Pedido de especialista em aberto",
        "Corpo sem o sufixo esperado."
      )
    ).toBeNull();
  });
});

describe("relerTitulosNotificacao — aplicação na lista", () => {
  const base: Notificacao = {
    id: "n1",
    tipo: "solicitacao_registrada",
    titulo: "Sugestão confirmada",
    corpo: "Ana Beatriz Souza confirmou a sua sugestão de especialista — o pedido seguiu.",
    href: "/duplas/d1",
    lida_em: null,
    created_at: "2026-11-20T10:00:00-03:00",
    created_by: null,
  } as Notificacao;

  it("reescreve a row alvo e preserva os demais campos", () => {
    const foraDaTabela: Notificacao = {
      ...base,
      id: "n2",
      tipo: "comunicado",
      titulo: "Aviso qualquer",
    };
    const [reescrita, intacta] = relerTitulosNotificacao([base, foraDaTabela]);
    expect(reescrita.titulo).toBe(
      "Ana Beatriz Souza confirmou a sua sugestão de especialista"
    );
    expect(reescrita.corpo).toBe("O pedido seguiu.");
    expect(reescrita.href).toBe("/duplas/d1");
    expect(intacta.titulo).toBe("Aviso qualquer");
    // a row original não é mutada — a guarda da 0019 proíbe update, e a
    // cópia reativa mantém o item referência-estável pro React
    expect(base.titulo).toBe("Sugestão confirmada");
  });
});
