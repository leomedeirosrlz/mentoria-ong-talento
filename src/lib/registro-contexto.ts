import { passoEsp, passosCobertosCandidatos, type PassoGuia } from "./ciclo";
import type { Dupla, Encaminhamento, Encontro } from "./types";

// Derivações puras da rota dedicada de registro (REALIZA-473). A ficha e a
// rota compartilham estas réguas — duplicar a decisão em cada superfície é a
// forma mais rápida de o servidor recusar o que a tela ofereceu. Sem Next,
// sem Supabase: só domínio, consumido pela página, pela ficha e pelos testes.

export type BloqueioRegistro =
  /** 404 — não é UUID, ou o encontro não pertence a esta dupla. */
  | "sem_encontro"
  /** Não é o mentor da dupla: coord/sup leem, não registram. */
  | "nao_e_mentor"
  /** Pausada/encerrada, ou concluída sem rito pendente. */
  | "dupla_inativa"
  /** status ≠ realizado e o horário ainda não chegou (ou nem existe). */
  | "ainda_nao_aconteceu"
  /** Já existe registro: editar mora na ficha. */
  | "ja_registrado";

export type EstadoRotaRegistro =
  | { tipo: "ok"; encontro: Encontro; passo: PassoGuia | null }
  | { tipo: "bloqueado"; motivo: BloqueioRegistro; encontro?: Encontro };

/** Passo do guia que um encontro cobre. DPP: o `numero` é a identidade do
 *  passo. Especialista: o `numero` é a TENTATIVA — o passo é o rank entre os
 *  realizados (`passoEsp`), a mesma régua da ficha. */
export function passoDoEncontro(
  dupla: Dupla,
  encontro: Encontro,
  passos: PassoGuia[]
): PassoGuia | null {
  const numero =
    dupla.trilha === "especialista"
      ? passoEsp(encontro, dupla.encontros)
      : encontro.numero;
  return passos.find((p) => p.numero === numero) ?? null;
}

/** A tabela de decisão da rota, na ordem em que cada condição vence. Espelha
 *  o que o `salvarRegistro` revalida no servidor — a página é a camada de
 *  experiência, a action é a barreira de escrita. */
export function estadoDaRotaRegistro(input: {
  dupla: Dupla;
  encontroId: string;
  passos: PassoGuia[];
  meId: string;
  agora: Date;
  /** `dupla.status === "concluida"` com encerramento ainda não decidido
   *  (0102): o mentor segue registrando o último encontro que fechou a
   *  jornada — o mesmo recorte do `podeEditar` da ficha. */
  ritoPendente: boolean;
  /** Marca explícita do pós-save (`?salvo=1`, posta na URL pelo client ao
   *  montar o form): a action revalida a própria rota no mesmo roundtrip e
   *  o registro recém-gravado faria o guard cair em `ja_registrado`,
   *  expulsando o mentor pra ficha antes da etapa de evidências (K1). Só
   *  este motivo é afetado — acesso direto nunca carrega a marca, então o
   *  redirect pra ficha segue valendo pra quem não veio do salvar. */
  recemSalvo?: boolean;
}): EstadoRotaRegistro {
  const { dupla, encontroId, passos, meId, agora, ritoPendente, recemSalvo } = input;
  const encontro = dupla.encontros.find((e) => e.id === encontroId);
  if (!encontro) return { tipo: "bloqueado", motivo: "sem_encontro" };

  if (dupla.mentor.id !== meId) {
    return { tipo: "bloqueado", motivo: "nao_e_mentor", encontro };
  }

  const ativa = dupla.status === "ativa";
  const concluidaComRito = dupla.status === "concluida" && ritoPendente;
  if (!ativa && !concluidaComRito) {
    return { tipo: "bloqueado", motivo: "dupla_inativa", encontro };
  }

  if (encontro.registro != null && !recemSalvo) {
    return { tipo: "bloqueado", motivo: "ja_registrado", encontro };
  }

  // A action aceita qualquer status passado (ela corrige pro realizado ao
  // salvar); o que ela barra é o horário que ainda não chegou.
  const aconteceu =
    encontro.status === "realizado" ||
    (encontro.data_hora != null && new Date(encontro.data_hora) <= agora);
  if (!aconteceu) {
    return { tipo: "bloqueado", motivo: "ainda_nao_aconteceu", encontro };
  }

  return {
    tipo: "ok",
    encontro,
    passo: passoDoEncontro(dupla, encontro, passos),
  };
}

/** Combinados ainda abertos da dupla — prazo primeiro, sem prazo no fim.
 *  Alimentam o "Da última vez: marcar como feito?" do form. */
export function combinadosPendentesDaDupla(dupla: Dupla): Encaminhamento[] {
  return (dupla.encaminhamentos ?? [])
    .filter((e) => e.status !== "feito")
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
}

/** Encontros que ainda devem registro, em ordem de número — a fila do
 *  "Registrar o Nº também" no pós-save. Inclui realizado sem registro e
 *  agendado/remarcado já vencido; futuro com data fica de fora. */
export function filaRegistrosPendentes(
  dupla: Dupla,
  opts: { excluirEncontroId?: string; agora: Date }
): { encontroId: string; numero: number }[] {
  return dupla.encontros
    .filter(
      (e) =>
        e.id !== opts.excluirEncontroId &&
        !e.registro &&
        (e.status === "realizado" ||
          ((e.status === "agendado" || e.status === "remarcado") &&
            e.data_hora != null &&
            new Date(e.data_hora) <= opts.agora))
    )
    .sort((a, b) => a.numero - b.numero)
    .map((e) => ({ encontroId: e.id, numero: e.numero }));
}

/** Passos do guia que a MESMA sessão pode cobrir junto do registro (007 US11):
 *  a régua é `passosCobertosCandidatos`, revalidada pelo `salvarRegistro` —
 *  ficha e rota oferecem exatamente o que o servidor aceita. A trilha
 *  especialista fica de fora: cada sessão é a própria linha, não um passo do
 *  guia de 16. `numero` é o nº do PASSO (não a tentativa). */
export function coberturaDaSessao(input: {
  dupla: Dupla;
  numero: number;
  passos: PassoGuia[];
  agora: Date;
}): { numero: number; titulo: string }[] | null {
  if (input.dupla.trilha === "especialista") return null;
  return passosCobertosCandidatos(
    input.passos,
    input.dupla.encontros,
    input.numero,
    input.agora
  );
}
