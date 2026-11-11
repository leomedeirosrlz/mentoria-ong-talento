// Cores de escrita do domínio (lib/escritas, REALIZA-126): a fronteira
// onde a regra mora — actions e tools de IA consomem o mesmo corpo, então
// o que se prova aqui vale pros dois caminhos. O supabase fake é o mesmo
// padrão do ia-tools.test.ts: as linhas voltam prontas (a RLS real não
// roda aqui) e as escritas são registradas pra assertar payload e alvo.

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agendarEncontroCore,
  editarCampoPessoaCore,
  marcarSaidaMentoradoCore,
  registrarInteracaoCore,
  salvarCampoRelatorioCore,
  type AtorEscrita,
} from "@/lib/escritas";

const UUID = "11111111-2222-4333-8444-555555555555";
const OUTRO = "99999999-8888-4777-8666-555555555555";
const FUTURO = "2099-01-05T19:00:00-03:00";

const COORD: AtorEscrita = { id: "coord-1", role: "coordenacao" };
const MENTOR: AtorEscrita = { id: "mentor-1", role: "mentor_dpp" };
const ESP: AtorEscrita = { id: "esp-1", role: "mentor_especialista" };

type Escrita = { tabela: string; op: "insert" | "update" | "delete"; payload: unknown };

function supaFake({ tabelas = {} }: { tabelas?: Record<string, unknown[]> } = {}) {
  const escritas: Escrita[] = [];
  const builder = (tabela: string) => {
    const rows = () => tabelas[tabela] ?? [];
    const b: Record<string, unknown> = {
      select: () => b,
      in: () => b,
      eq: () => b,
      neq: () => b,
      gt: () => b,
      gte: () => b,
      lte: () => b,
      order: () => b,
      limit: () => b,
      insert: (p: unknown) => {
        escritas.push({ tabela, op: "insert", payload: p });
        return b;
      },
      update: (p: unknown) => {
        escritas.push({ tabela, op: "update", payload: p });
        return b;
      },
      delete: () => {
        escritas.push({ tabela, op: "delete", payload: null });
        return b;
      },
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      maybeSingle: () =>
        Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (
        res: (v: unknown) => unknown,
        rej?: (e: unknown) => unknown
      ) => Promise.resolve({ data: rows(), error: null }).then(res, rej),
    };
    return b;
  };
  const supabase = { from: (t: string) => builder(t) };
  return { supabase: supabase as unknown as SupabaseClient, escritas };
}

const erroDe = (r: object) => {
  const erro = "error" in r ? (r as { error?: string }).error : undefined;
  expect(erro).toBeTruthy();
  return erro as string;
};

describe("agendarEncontroCore", () => {
  const duplaAtiva = [
    { status: "ativa", trilha: "dpp", cronograma_id: "cron-1" },
  ];
  const agendaOk = {
    dupla_id: UUID,
    numero: 6,
    data_hora: FUTURO,
    link: null,
  };

  it("coord recebe a recusa real 'quem agenda é a dupla' — o guard mora no core", async () => {
    const { supabase, escritas } = supaFake({ tabelas: { duplas: duplaAtiva } });
    const r = await agendarEncontroCore(supabase, COORD, agendaOk);
    expect(erroDe(r)).toBe(
      "Quem agenda é a dupla. A coordenação acompanha o andamento."
    );
    // e não tocou em nada
    expect(escritas).toHaveLength(0);
  });

  it("dupla inexistente ou escondida pela RLS → 'não encontrada'", async () => {
    const { supabase } = supaFake();
    const r = await agendarEncontroCore(supabase, MENTOR, agendaOk);
    expect(erroDe(r)).toBe("Dupla não encontrada.");
  });

  it.each(["pausada", "encerrada", "concluida"])(
    "dupla %s recusa — só ativa agenda",
    async (status) => {
      const { supabase } = supaFake({
        tabelas: { duplas: [{ status, trilha: "dpp", cronograma_id: "c" }] },
      });
      const r = await agendarEncontroCore(supabase, MENTOR, agendaOk);
      expect(erroDe(r)).toBe("Essa dupla não está ativa.");
    }
  );

  it("trilha especialista sem tentativa existente recusa criar do zero", async () => {
    const { supabase, escritas } = supaFake({
      tabelas: {
        duplas: [{ status: "ativa", trilha: "especialista", cronograma_id: null }],
        encontros: [],
      },
    });
    const r = await agendarEncontroCore(supabase, ESP, agendaOk);
    expect(erroDe(r)).toContain("pedidos aceitos");
    expect(escritas).toHaveLength(0);
  });

  it("trilha especialista remarca tentativa existente", async () => {
    const { supabase, escritas } = supaFake({
      tabelas: {
        duplas: [{ status: "ativa", trilha: "especialista", cronograma_id: null }],
        encontros: [{ id: "enc-1", status: "agendado", data_hora: "2099-01-01T19:00:00-03:00" }],
      },
    });
    const r = await agendarEncontroCore(supabase, ESP, {
      ...agendaOk,
      motivo: "imprevisto",
    });
    expect(r).toEqual({ ok: true });
    expect(escritas[0]).toMatchObject({ tabela: "encontros", op: "update" });
    // o preset vira o label auditado
    expect((escritas[0].payload as Record<string, unknown>).motivo_reagendamento).toBe(
      "Doença ou imprevisto"
    );
  });

  it("encontro já realizado não é remarcável", async () => {
    const { supabase, escritas } = supaFake({
      tabelas: {
        duplas: duplaAtiva,
        encontros: [{ id: "e", status: "realizado", data_hora: FUTURO }],
      },
    });
    const r = await agendarEncontroCore(supabase, MENTOR, agendaOk);
    expect(erroDe(r)).toContain("já foi realizado");
    expect(escritas).toHaveLength(0);
  });

  it("data no passado recusa com o caminho do registro retroativo", async () => {
    const { supabase } = supaFake({ tabelas: { duplas: duplaAtiva } });
    const r = await agendarEncontroCore(supabase, MENTOR, {
      ...agendaOk,
      data_hora: "2020-01-05T19:00:00-03:00",
    });
    expect(erroDe(r)).toContain("já passou");
  });

  it("número acima do teto do cronograma da dupla recusa", async () => {
    const { supabase } = supaFake({
      tabelas: { duplas: duplaAtiva, ciclo_eventos: [{ numero: 16 }] },
    });
    const r = await agendarEncontroCore(supabase, MENTOR, { ...agendaOk, numero: 20 });
    expect(erroDe(r)).toBe("Escolha um encontro da lista.");
  });

  it("insere o encontro agendado com created_by do ator", async () => {
    const { supabase, escritas } = supaFake({
      tabelas: { duplas: duplaAtiva, ciclo_eventos: [{ numero: 16 }] },
    });
    const r = await agendarEncontroCore(supabase, MENTOR, {
      ...agendaOk,
      link: "https://meet.exemplo.com/abc",
    });
    expect(r).toEqual({ ok: true });
    expect(escritas).toHaveLength(1);
    expect(escritas[0]).toMatchObject({
      tabela: "encontros",
      op: "insert",
      payload: {
        dupla_id: UUID,
        numero: 6,
        status: "agendado",
        created_by: "mentor-1",
        link: "https://meet.exemplo.com/abc",
      },
    });
  });

  it("remarcar sem motivo pede o porquê", async () => {
    const { supabase } = supaFake({
      tabelas: {
        duplas: duplaAtiva,
        encontros: [{ id: "e", status: "agendado", data_hora: "2099-01-01T19:00:00-03:00" }],
        ciclo_eventos: [{ numero: 16 }],
      },
    });
    const r = await agendarEncontroCore(supabase, MENTOR, agendaOk);
    expect(erroDe(r)).toBe("Conte o motivo do reagendamento.");
  });
});

describe("marcarSaidaMentoradoCore", () => {
  it("não-coord é recusada antes de qualquer leitura", async () => {
    const { supabase, escritas } = supaFake();
    const r = await marcarSaidaMentoradoCore(supabase, MENTOR, {
      id: UUID,
      situacao: "concluido",
    });
    expect(erroDe(r)).toBe("Só a coordenação marca a saída de mentorados.");
    expect(escritas).toHaveLength(0);
  });

  it("desistente sem motivo recusa — a ficha precisa do porquê", async () => {
    const { supabase } = supaFake();
    const r = await marcarSaidaMentoradoCore(supabase, COORD, {
      id: UUID,
      situacao: "desistente",
      motivo: "   ",
    });
    expect(erroDe(r)).toContain("motivo da saída");
  });

  it("motivo acima de 300 recusa", async () => {
    const { supabase } = supaFake();
    const r = await marcarSaidaMentoradoCore(supabase, COORD, {
      id: UUID,
      situacao: "desistente",
      motivo: "x".repeat(301),
    });
    expect(erroDe(r)).toContain("300");
  });

  it("dupla viva bloqueia e devolve o id pra UI apontar a ficha", async () => {
    const { supabase, escritas } = supaFake({
      tabelas: { duplas: [{ id: "dupla-viva-1" }] },
    });
    const r = await marcarSaidaMentoradoCore(supabase, COORD, {
      id: UUID,
      situacao: "concluido",
    });
    expect(erroDe(r)).toContain("dupla em andamento");
    expect("error" in r && r.duplaId).toBe("dupla-viva-1");
    expect(escritas).toHaveLength(0);
  });

  it("concluído grava carimbo de saída; ativo limpa os campos", async () => {
    const { supabase, escritas } = supaFake({
      tabelas: { mentorados: [{ id: UUID }] },
    });
    const r1 = await marcarSaidaMentoradoCore(supabase, COORD, {
      id: UUID,
      situacao: "concluido",
    });
    expect(r1).toEqual({ ok: true });
    const p1 = escritas[0].payload as Record<string, unknown>;
    expect(p1.situacao).toBe("concluido");
    expect(p1.saiu_em).toBeTruthy();

    escritas.length = 0;
    const r2 = await marcarSaidaMentoradoCore(supabase, COORD, {
      id: UUID,
      situacao: "ativo",
    });
    expect(r2).toEqual({ ok: true });
    expect(escritas[0].payload).toMatchObject({
      situacao: "ativo",
      saiu_em: null,
      motivo_saida: null,
    });
  });
});

describe("registrarInteracaoCore", () => {
  it("tipo fora de contato/apoio recusa — nudge é artefato do Lembrar", async () => {
    const { supabase, escritas } = supaFake();
    const r = await registrarInteracaoCore(supabase, COORD, {
      dupla_id: UUID,
      // @ts-expect-error — o core valida o que o schema já estreitou
      tipo: "nudge",
    });
    expect(erroDe(r)).toBe("Escolha um tipo válido.");
    expect(escritas).toHaveLength(0);
  });

  it("grava com canal in_app fixo e o autor resolvido", async () => {
    const { supabase, escritas } = supaFake({
      tabelas: { interacoes: [{ id: OUTRO }] },
    });
    const r = await registrarInteracaoCore(supabase, MENTOR, {
      dupla_id: UUID,
      tipo: "contato",
      nota: "combinamos novo horário",
    });
    expect(r).toEqual({ ok: true, id: OUTRO });
    expect(escritas[0]).toMatchObject({
      tabela: "interacoes",
      op: "insert",
      payload: {
        dupla_id: UUID,
        autor_id: "mentor-1",
        canal: "in_app",
        tipo: "contato",
        nota: "combinamos novo horário",
      },
    });
  });
});

describe("editarCampoPessoaCore — allowlist", () => {
  const opts = (tabelas: Record<string, unknown[]>) => supaFake({ tabelas });

  it("não-coord é recusada", async () => {
    const { supabase } = supaFake();
    const r = await editarCampoPessoaCore(supabase, MENTOR, {
      pessoa_id: UUID,
      campo: "whatsapp",
      valor: "11987654321",
    });
    expect(erroDe(r)).toBe("Só a coordenação edita cadastros.");
  });

  it("pessoa inexistente nas duas tabelas → 'não encontrada'", async () => {
    const { supabase } = supaFake();
    const r = await editarCampoPessoaCore(supabase, COORD, {
      pessoa_id: UUID,
      campo: "whatsapp",
      valor: "11987654321",
    });
    expect(erroDe(r)).toBe("Pessoa não encontrada.");
  });

  // allowlist, não blocklist: o que não está na lista não existe pra tool
  it.each(["email", "papel", "dados_civis", "nome", "cidade", "uf"])(
    "campo '%s' fora da allowlist → não editável por aqui",
    async (campo) => {
      const { supabase, escritas } = opts({ profiles: [{ id: UUID }] });
      const r = await editarCampoPessoaCore(supabase, COORD, {
        pessoa_id: UUID,
        campo,
        valor: "x",
      });
      expect(erroDe(r)).toBe("Esse campo não é editável por aqui.");
      expect(escritas).toHaveLength(0);
    }
  );

  it("'notas' só existe em mentorados — em profiles recusa", async () => {
    const { supabase, escritas } = opts({ profiles: [{ id: UUID }] });
    const r = await editarCampoPessoaCore(supabase, COORD, {
      pessoa_id: UUID,
      campo: "notas",
      valor: "observação",
    });
    expect(erroDe(r)).toBe("Esse campo não é editável por aqui.");
    expect(escritas).toHaveLength(0);
  });

  it("whatsapp em profiles normaliza 55+DDD+número", async () => {
    const { supabase, escritas } = opts({ profiles: [{ id: UUID }] });
    const r = await editarCampoPessoaCore(supabase, COORD, {
      pessoa_id: UUID,
      campo: "whatsapp",
      valor: "11 98765-4321",
    });
    expect(r).toMatchObject({ ok: true, tabela: "profiles", valor: "5511987654321" });
    expect(escritas[0]).toMatchObject({
      tabela: "profiles",
      op: "update",
      payload: { whatsapp: "5511987654321" },
    });
  });

  it("whatsapp inválido não zera o campo", async () => {
    const { supabase, escritas } = opts({ profiles: [{ id: UUID }] });
    const r = await editarCampoPessoaCore(supabase, COORD, {
      pessoa_id: UUID,
      campo: "whatsapp",
      valor: "abc",
    });
    expect(erroDe(r)).toContain("WhatsApp");
    expect(escritas).toHaveLength(0);
  });

  it("nome_social e notas em mentorados editam — a tabela resolve pelo id", async () => {
    const { supabase, escritas } = opts({
      profiles: [],
      mentorados: [{ id: UUID }],
    });
    const r1 = await editarCampoPessoaCore(supabase, COORD, {
      pessoa_id: UUID,
      campo: "nome_social",
      valor: "maria EDUARDA",
    });
    expect(r1).toMatchObject({ ok: true, tabela: "mentorados", valor: "Maria Eduarda" });
    const r2 = await editarCampoPessoaCore(supabase, COORD, {
      pessoa_id: UUID,
      campo: "notas",
      valor: "  prefere contato de manhã  ",
    });
    expect(r2).toMatchObject({ ok: true, valor: "prefere contato de manhã" });
    expect(escritas.map((e) => e.tabela)).toEqual(["mentorados", "mentorados"]);
  });
});

describe("salvarCampoRelatorioCore — mesma allowlist da grade", () => {
  it("campo fora da grade recusa", async () => {
    const { supabase } = supaFake();
    const r = await salvarCampoRelatorioCore(supabase, COORD, {
      tabela: "profiles",
      id: UUID,
      campo: "notas",
      valor: "x",
    });
    expect(erroDe(r)).toBe("Esse campo não é editável por aqui.");
  });

  it("e-mail de profile já vinculado a conta recusa", async () => {
    const { supabase } = supaFake({
      tabelas: { profiles: [{ id: UUID, user_id: "auth-1" }] },
    });
    const r = await salvarCampoRelatorioCore(supabase, COORD, {
      tabela: "profiles",
      id: UUID,
      campo: "email",
      valor: "novo@mail.com",
    });
    expect(erroDe(r)).toContain("só muda pelo perfil");
  });

  it("nome title-case e devolve o valor gravado", async () => {
    const { supabase, escritas } = supaFake({
      tabelas: { mentorados: [{ id: UUID }] },
    });
    const r = await salvarCampoRelatorioCore(supabase, COORD, {
      tabela: "mentorados",
      id: UUID,
      campo: "nome",
      valor: "joão PEDRO",
    });
    expect(r).toEqual({ ok: true, valor: "João Pedro" });
    expect(escritas[0].payload).toEqual({ nome: "João Pedro" });
  });
});
