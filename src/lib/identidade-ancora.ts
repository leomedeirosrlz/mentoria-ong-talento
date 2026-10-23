import type { Database } from "./database.types";

// REALIZA-16 — matriz de âncora de identidade do mentorado.
//
// Regra: tudo que é coletado do/para o jovem resolve pra `mentorados.id`
// (a identidade estável de participação — `profile_id` só liga a conta
// quando ela existir), direto ou por cadeia de FKs. Um artefato sem essa
// resolução é um órfão silencioso: não aparece na jornada, não entra em
// export do titular, não migra com a futura conta.
//
// Esta matriz é a fonte única consumida por duas verificações:
//   · `identidade-ancora.test.ts` — cada `colunas` typechecka contra o Row
//     gerado (regressão de schema falha em `tsc`/`vitest`, sem banco);
//   · `scripts/auditoria-identidade-mentorado.mjs` — conta órfãos reais
//     no banco (CI/staging; espelha esta matriz em SQL).
//
// Guard de futuro: tabela nova que guarda dado coletado do jovem entra
// aqui com `mentorado_id`/`dupla_id` (ou cadeia equivalente). Exceção só
// com reconciliação documentada — o padrão é o intake (abaixo).

type Tabelas = Database["public"]["Tables"];
type Tabela = keyof Tabelas & string;
type Coluna<T extends Tabela> = keyof Tabelas[T]["Row"] & string;

export type EntradaAncora = {
  /** tabela que guarda o artefato */
  tabela: Tabela;
  /** colunas que carregam a âncora (a primeira é a mais direta) */
  colunas: readonly string[];
  /** como a âncora resolve pra mentorados.id — texto pro relatório */
  via: string;
  /** único caso sem âncora admitido e como ele reconcilia (se houver) */
  isencao?: string;
};

function ancora<T extends Tabela>(
  tabela: T,
  colunas: readonly Coluna<T>[],
  via: string,
  isencao?: string
): EntradaAncora {
  return { tabela, colunas, via, isencao };
}

export const ANCORAS = [
  ancora(
    "mentorados",
    ["id", "profile_id"],
    "a própria linha é a identidade; profile_id liga à conta quando ela existir (nullable de propósito — 0066)"
  ),
  ancora(
    "formulario_links",
    ["dest_mentorado_id", "dest_profile_id", "dupla_id", "respondido_por_profile_id"],
    "destinatário nominado ou contexto de dupla; respondido_por cobre o submit autenticado num link genérico legado (resolve via mentorados.profile_id)",
    "multi_uso / origem='intake' (0115): link de campanha anônimo por desenho — a resposta reconcilia por promovido_profile_id, nunca fica solta"
  ),
  ancora(
    "formulario_respostas",
    ["link_id", "promovido_profile_id"],
    "link_id → âncora do link; promovido_* carimba a reconciliação do intake"
  ),
  ancora(
    "formulario_anexos",
    ["link_id"],
    "link_id → âncora do link (metadados do upload do intake público)"
  ),
  ancora(
    "assinaturas",
    ["mentorado_id", "profile_id"],
    "XOR por check (0033): termo do jovem sai com mentorado_id; o do voluntário com profile_id"
  ),
  ancora(
    "avaliacoes_encontro",
    ["dupla_id", "respondido_por_profile_id"],
    "dupla_id → duplas.mentorado_id (micro-avaliação pós-encontro, 0071)"
  ),
  ancora(
    "terceiros_contatos",
    ["dupla_id"],
    "dupla_id → duplas.mentorado_id (convite da avaliação por terceiros, 0103)"
  ),
  ancora(
    "registro_anexos",
    ["registro_id"],
    "registros → encontros → duplas.mentorado_id (evidência do encontro)"
  ),
] as const;
