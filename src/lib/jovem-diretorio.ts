import { papelLabel } from "./ciclo";
import type {
  ColegaTurma,
  JovemContato,
  JovemDiretorioEntry,
  JovemDiretorioTipo,
  JovemDupla,
} from "./types";

// Domínio puro do diretório do jovem (0239) — derivações que a página
// /jovem/pessoas e a ficha consomem. A view entrega as pessoas; a rede dele
// continua sendo jovem_contatos + mentorados_turma, então o cruzamento é
// aqui e não em SQL novo.

/** Entrada do diretório enriquecida com a rede resolvida do jovem. */
export type DiretorioPessoa = JovemDiretorioEntry & {
  /** Marca "Sua rede" reparada: a view marca minha_rede, mas o
   *  distinct on (id) prefere a linha de catálogo (prioridade 0) e
   *  perde o `true` do braço adulto — o especialista da própria trilha
   *  chegaria sem a marca. Aqui a rede resolvida (contatos ∪ colegas)
   *  completa a marca sem migration nova. */
  rede: boolean;
  /** Rótulo do vínculo quando a pessoa é da rede ("Seu mentor",
   *  "Colega da turma") — null fora da rede. */
  vinculo: string | null;
  /** Selo de dupla que não está mais em curso ("trilha concluída",
   *  "mentoria pausada") — null quando a dupla vive ou não há dupla. */
  selo: string | null;
  /** WhatsApp projetado do contato da rede (ou do colega com opt-in) —
   *  o mesmo dado que a ficha já mostra; null fora da rede ou quando o
   *  colega não compartilhou. O card da rede abre o canal daqui. */
  whatsapp: string | null;
  /** E-mail do contato da rede — null fora da rede (a view não projeta
   *  e-mail de colega: o canal dele é só o WhatsApp opt-in). */
  email: string | null;
};

/** Selo honesto de dupla não-ativa — o mesmo texto da linha e da ficha. */
export function seloDuplaLabel(
  status: JovemDupla["status"] | null | undefined,
  trilha: JovemDupla["trilha"] | null | undefined
): string | null {
  if (!status || status === "ativa") return null;
  const base = trilha === "especialista" ? "trilha" : "mentoria";
  const rotulo =
    { pausada: "pausada", concluida: "concluída", encerrada: "encerrada" }[
      status
    ] ?? status;
  return `${base} ${rotulo}`;
}

/** O vínculo do contato na voz do jovem — o `papel` da jovem_contatos
 *  fala a relação com ele ("mentor", "especialista"), não o cargo. */
export function vinculoDeContato(c: JovemContato): string {
  switch (c.papel) {
    case "mentor":
      return "Seu mentor";
    case "especialista":
      return "Seu especialista";
    case "supervisor":
      return "Auxiliar da sua dupla";
    case "coordenacao":
      return papelLabel("coordenacao");
    default:
      return papelLabel(c.role);
  }
}

/** Cruza o diretório com a rede resolvida — a mesma régua dos selos e das
 *  linhas do perfil, então "Sua rede" na página e no perfil mostram
 *  exatamente as mesmas pessoas. Dedup por pessoa vem da view; a dedup
 *  da rede é por id aqui (o contato que repete por dupla vira uma
 *  marca só). */
export function enriqueceDiretorio(
  entradas: JovemDiretorioEntry[],
  contatos: JovemContato[],
  colegas: ColegaTurma[],
  duplas: JovemDupla[]
): DiretorioPessoa[] {
  const porDupla = new Map(
    duplas.map((d) => [d.id, { status: d.status, trilha: d.trilha }])
  );
  const contatoPorId = new Map<string, JovemContato>();
  for (const c of contatos) {
    if (c.id == null) continue;
    const atual = contatoPorId.get(c.id);
    // a dupla mais viva vence pra etiqueta — mesma régua do agrupaPorPessoa
    const peso = (x: JovemContato | undefined) =>
      pesoStatus(x?.dupla_id ? porDupla.get(x.dupla_id)?.status : null);
    if (!atual || peso(c) < peso(atual)) contatoPorId.set(c.id, c);
  }
  const colegaPorId = new Map<string, ColegaTurma>();
  for (const c of colegas) {
    if (c.id != null) colegaPorId.set(c.id, c);
  }

  return entradas.map((e) => {
    const contato = contatoPorId.get(e.id);
    const colega = colegaPorId.get(e.id);
    const rede = e.minha_rede || contato != null || colega != null;
    const vinculo = contato
      ? vinculoDeContato(contato)
      : colega
        ? "Colega da turma"
        : null;
    const dupla =
      contato?.dupla_id != null ? porDupla.get(contato.dupla_id) : undefined;
    return {
      ...e,
      rede,
      vinculo,
      selo: seloDuplaLabel(dupla?.status, dupla?.trilha),
      // o canal mora na mesma fonte da ficha: jovem_contatos pros adultos
      // da rede, mentorados_turma pro colega (whatsapp null sem opt-in)
      whatsapp: contato?.whatsapp ?? colega?.whatsapp ?? null,
      email: contato?.email ?? null,
    };
  });
}

function pesoStatus(status: JovemDupla["status"] | null | undefined): number {
  return status === "ativa" ? 0
    : status === "pausada" ? 1
    : status === "concluida" ? 2
    : status === "encerrada" ? 3
    : 0;
}

/** Facetas do diretório — `?papel=` na URL. "rede" e "todos" são lentes,
 *  não baldes: cada pessoa mora em exatamente um balde abaixo. */
export type FacetaDiretorio =
  | "todos"
  | "rede"
  | "colegas"
  | "mentores"
  | "especialistas"
  | "equipe";

export const FACETAS_DIRETORIO: {
  id: FacetaDiretorio;
  rotulo: string;
}[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "rede", rotulo: "Minha rede" },
  { id: "colegas", rotulo: "Colegas" },
  { id: "mentores", rotulo: "Mentores" },
  { id: "especialistas", rotulo: "Especialistas" },
  { id: "equipe", rotulo: "Equipe" },
];

/** O balde de uma linha do diretório — jovem é colega do programa (dentro
 *  ou fora da turma dele), o catálogo manda nos especialistas (inclusive
 *  o híbrido, cuja linha de catálogo vence o dedup), mentor DPP pelo
 *  papel projetado e o resto dos adultos é equipe. */
export function baldeDaEntrada(
  e: Pick<JovemDiretorioEntry, "tipo" | "papel">
): Exclude<FacetaDiretorio, "todos" | "rede"> {
  if (e.tipo === "jovem") return "colegas";
  if (e.tipo === "especialista" || e.papel === "mentor_especialista")
    return "especialistas";
  if (e.papel === "mentor_dpp") return "mentores";
  return "equipe";
}

/** A projeção pública de um tipo de entrada — pra ficha e pros cards. */
export function rotuloTipo(tipo: JovemDiretorioTipo, papel?: string | null): string {
  if (tipo === "jovem") return "Jovem do programa";
  if (tipo === "especialista") return "Mentor especialista";
  return papelLabel(papel);
}
