"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  Briefcase,
  CaretDown,
  EnvelopeSimple,
  FileText,
  GraduationCap,
  MagnifyingGlass,
  MapPin,
  SignOut,
  UserPlus,
  Users,
  UsersThree,
  WhatsappLogo,
  type Icon,
} from "@phosphor-icons/react";
import { temPapel } from "@/lib/types";
import type { Mentorado, Profile } from "@/lib/types";
import type { MentorProfile } from "@/lib/queries";
import { filaMentorados, filaMentores, tetoMentor } from "@/lib/fila";
import { cn, normaliza } from "@/lib/utils";
import {
  comparaNome,
  foraDoPrograma,
  idade,
  papelLabelComposto,
  SITUACAO_MENTORADO_LABEL,
} from "@/lib/ciclo";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { PessoaActions } from "@/components/pessoa-actions";
import { MentoradoActions } from "@/components/mentorado-actions";
import { RoleSelect } from "@/components/role-select";
import { ImportarCsvDialog } from "@/components/importar-csv-dialog";
import { FilaEspera } from "@/components/fila-espera";
import { CapacidadeMentorDialog } from "@/components/capacidade-mentor-dialog";
import { NovaPessoaDialog, NovoMentoradoDialog } from "@/components/pessoas-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ehMentor = (p: Profile) =>
  temPapel(p, "mentor_dpp") || temPapel(p, "mentor_especialista");

/** Status de assinatura de uma pessoa, montado na page a partir do resumo:
 *  `assinado` = slug → ISO da assinatura; `pendente` = slugs com link vivo. */
export type DocsPessoa = {
  /** slug → {id, em} — o id alimenta o link "ver PDF" (/api/assinatura/<id>) */
  assinado: Record<string, { id: string; em: string | null }>;
  pendente: string[];
};

const DOCS_VAZIO: DocsPessoa = { assinado: {}, pendente: [] };

type OrdemPessoas = "nome" | "pendencias";

const ORDEM_PESSOAS_LABEL: Record<OrdemPessoas, string> = {
  nome: "Nome A–Z",
  pendencias: "Pendências primeiro",
};

/** Grupos da lista unificada (rodada out/2026) — a própria agrupação da
 *  página é o filtro: um dropdown só de categorias substituiu os selects
 *  de papel/trilha/status. "sempapel" = pré-cadastro aguardando papel,
 *  grupo que só a coordenação enxerga. */
type Grupo = "equipe" | "supervisores" | "mentores" | "mentorados" | "sempapel";
type CategoriaPessoas = "todos" | Grupo;

const GRUPO_ORDEM: Grupo[] = [
  "equipe",
  "supervisores",
  "mentores",
  "mentorados",
  "sempapel",
];

const GRUPO_LABEL: Record<Grupo, string> = {
  equipe: "Coordenação e equipe",
  supervisores: "Supervisores",
  mentores: "Mentores",
  mentorados: "Mentorados",
  sempapel: "Sem papel",
};

/** Grupo pelo papel primário: supervisor e jovem-com-conta têm seção
 *  própria; mentor (inclusive híbrido) cai em "mentores" e a pill da
 *  linha distingue a trilha; o resto é equipe do programa. */
function grupoDePessoa(p: Profile): Grupo {
  if (p.role == null) return "sempapel";
  if (p.role === "supervisor") return "supervisores";
  if (p.role === "mentorado") return "mentorados";
  if (ehMentor(p)) return "mentores";
  return "equipe";
}

/** Conta pendências do cadastro — mesmas regras dos badges e da região
 *  "Detalhes" da linha: termo, formação do mentor, "ainda não entrou" e
 *  livre pra dupla. Alimenta o sort "Pendências primeiro". */
function pendenciasPessoa(
  p: Profile,
  mp: MentorProfile | undefined,
  livre: boolean,
  docs: DocsPessoa | undefined
): number {
  const d = docs ?? DOCS_VAZIO;
  // não-voluntário não deve o termo (flag "sou voluntário" do cadastro) —
  // a pendência só existe pra quem tem o documento a assinar
  const termoOk =
    p.voluntario === false
      ? true
      : ehMentor(p)
        ? Boolean(mp?.termo_ok)
        : d.assinado["termo-voluntario"] !== undefined ||
          Boolean(p.documento_path);
  let n = 0;
  if (!termoOk) n++;
  if (ehMentor(p) && !mp?.formacao_ok) n++;
  if (p.ativo && !p.user_id) n++;
  if (livre) n++;
  return n;
}

/** Idem pros mentorados — o documento certo depende da idade (autorização
 *  do responsável pra menor, termo de participação pra maior). */
function pendenciasMentorado(
  m: Mentorado,
  livre: boolean,
  docs: DocsPessoa | undefined
): number {
  const d = docs ?? DOCS_VAZIO;
  const anos = idade(m.data_nascimento);
  const menor = anos != null && anos < 18;
  const docOk = menor
    ? Boolean(m.documento_path) ||
      d.assinado["autorizacao-responsavel"] !== undefined
    : d.assinado["termo-mentorando"] !== undefined;
  let n = 0;
  if (!docOk) n++;
  if (livre) n++;
  return n;
}

/** "dd/mm/aaaa" — data da assinatura no detalhe da linha. */
const fmtDia = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

/** "5511999998888" -> "+55 (11) 99999-8888"; fora do padrão BR mostra como veio. */
function formatarWhatsApp(wa: string): string {
  const d = wa.replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 13) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.startsWith("55") && d.length === 12) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return wa;
}

export function PessoasListas({
  pessoas,
  mentorados,
  comDupla,
  comQualquerDupla,
  duplaVivaPorMentorado,
  mentorProfiles,
  contagemPorMentor,
  assinaturas,
  faltantes,
  euNome,
  souCoord,
}: {
  pessoas: Profile[];
  mentorados: Mentorado[];
  comDupla: string[];
  /** Ids com QUALQUER dupla (até encerrada) — espelha a guarda das actions de exclusão. */
  comQualquerDupla: string[];
  /** mentorado_id → id da dupla ativa/pausada (0077) — o dialog de saída
   *  bloqueia quem tem par em andamento e linka direto pra ficha da dupla. */
  duplaVivaPorMentorado: Record<string, string>;
  mentorProfiles: Record<string, MentorProfile>;
  contagemPorMentor: Record<string, number>;
  /** id da pessoa → documentos assinados/pendentes (badge "assinou vs. não"). */
  assinaturas: Record<string, DocsPessoa>;
  /** id → slug → labels de faltante civil (coord-only, calculado na page) —
   *  alimenta o "civis incompletos" do Detalhes quando o doc ainda não saiu
   *  assinado. Labels, nunca valores. */
  faltantes?: Record<string, Record<string, string[]>>;
  /** Nome de quem opera — assina a mensagem pronta de WhatsApp na fila. */
  euNome?: string | null;
  /** false = diretório de colegas (supervisor/mentores): mesma lista, sem
   *  badges operacionais, filtros de gestão nem ações — os mapas acima já
   *  chegam vazios da página e nem são consultados nesse modo. */
  souCoord: boolean;
}) {
  const [busca, setBusca] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("busca") ?? "";
  });
  const [buscaDebounced, setBuscaDebounced] = useState(busca);
  // categoria = o próprio agrupamento da lista usado como filtro
  // (rodada out/2026 — antes: selects de papel, trilha e status)
  const [cat, setCat] = useState<CategoriaPessoas>(() => {
    if (typeof window === "undefined") return "todos";
    const v = new URLSearchParams(window.location.search).get("cat");
    return (GRUPO_ORDEM as string[]).includes(v ?? "") || v === "todos"
      ? (v as CategoriaPessoas)
      : "todos";
  });
  // "Fora do programa" inverte o recorte: a lista passa a mostrar SÓ quem
  // saiu (0077); desligado, eles moram no arquivo colapsável do fim
  const [verFora, setVerFora] = useState(false);
  // "Aguardando par": recorta a lista pros membros da fila do card —
  // mentorados sem par + mentores DPP com vaga
  const [verFila, setVerFila] = useState(false);
  const [foraAberto, setForaAberto] = useState(false);
  const [inativosAberto, setInativosAberto] = useState(false);
  const [ordem, setOrdem] = useState<OrdemPessoas>("nome");
  const emDupla = useMemo(() => new Set(comDupla), [comDupla]);
  const temQualquerDupla = useMemo(() => new Set(comQualquerDupla), [comQualquerDupla]);

  // debounce da busca por nome (300ms) — REALIZA-318
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  // persistência da busca/categoria na URL (deep-link)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (busca) sp.set("busca", busca);
    else sp.delete("busca");
    if (cat !== "todos") sp.set("cat", cat);
    else sp.delete("cat");
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [busca, cat]);

  const q = normaliza(buscaDebounced.trim());
  // diretório de colegas: sem papel ainda não é colega — pré-cadastro que
  // só a coordenação precisa enxergar; cadastro inativo (saiu da equipe)
  // idem — pro diretório ele não é mais colega. A base filtrada também é o
  // denominador do contador — mostrar o total cru mentiria
  const basePessoas = souCoord
    ? pessoas
    : pessoas.filter((p) => p.role != null && p.ativo);

  // pra não-coord o e-mail não chega (view profiles_contato só devolve o
  // escopo do papel) — a busca é por nome (+ nome social, que é público)
  const qPessoa = (p: Profile) =>
    !q ||
    normaliza(p.nome).includes(q) ||
    normaliza(p.nome_social ?? "").includes(q) ||
    (souCoord && normaliza(p.email).includes(q));
  const qMentorado = (m: Mentorado) =>
    !q ||
    normaliza(m.nome).includes(q) ||
    normaliza(m.nome_social ?? "").includes(q) ||
    normaliza(m.email ?? "").includes(q) ||
    normaliza(m.ong_origem).includes(q);
  const catOkPessoa = (p: Profile) => cat === "todos" || grupoDePessoa(p) === cat;
  const catOkMentorado = cat === "todos" || cat === "mentorados";

  // pra coordenação, cadastro desativado sai do grupo principal e vive na
  // seção "Inativos" no fim — visível, mas sem diluir a leitura de quem segue
  const inativas = useMemo(
    () => (souCoord ? pessoas.filter((p) => !p.ativo) : []),
    [souCoord, pessoas]
  );
  const inativasFiltradas = inativas.filter(
    (p) => catOkPessoa(p) && qPessoa(p)
  );
  const totalFora = useMemo(
    () => mentorados.reduce((n, m) => n + (foraDoPrograma(m) ? 1 : 0), 0),
    [mentorados]
  );

  // fila "Aguardando par" (REALIZA-101): mentorados que NUNCA tiveram dupla
  // + mentores ativos com vaga livre — derivação pura em @/lib/fila
  const filaMds = useMemo(
    () => (souCoord ? filaMentorados(mentorados, emDupla, temQualquerDupla) : []),
    [souCoord, mentorados, emDupla, temQualquerDupla]
  );
  const filaMts = useMemo(
    () => (souCoord ? filaMentores(pessoas, mentorProfiles, contagemPorMentor) : []),
    [souCoord, pessoas, mentorProfiles, contagemPorMentor]
  );
  // fichas completas por id — o ⋯ da fila reusa as mesmas ações das linhas
  const mentoradoPorId = useMemo(
    () => new Map(mentorados.map((m) => [m.id, m])),
    [mentorados]
  );
  const pessoaPorId = useMemo(
    () => new Map(pessoas.map((p) => [p.id, p])),
    [pessoas]
  );

  // modo Parear do card "Aguardando par": "livre" pra mentor é ter VAGA
  // DPP, não estar zerado — com capacidade 2 a dupla 1/2 ainda aceita par.
  // O pool recebe todos os DPP ativos (cheios afundam marcados) e a
  // ocupação pra desenhar o X/Y. Especialista não entra: pareja por
  // demanda no mural, não é reserva obrigatória.
  const vagasDe = (p: Profile) => {
    if (!temPapel(p, "mentor_dpp")) return 0;
    return Math.max(
      0,
      tetoMentor(p, mentorProfiles[p.id], "dpp") -
        (contagemPorMentor[`${p.id}:dpp`] ?? 0)
    );
  };
  const temVaga = (p: Profile) => ehMentor(p) && p.ativo && vagasDe(p) > 0;
  const mentoresDpp = pessoas.filter(
    (p) => temPapel(p, "mentor_dpp") && p.ativo
  );
  const mentoradosLivres = mentorados.filter(
    (m) => !emDupla.has(m.id) && !foraDoPrograma(m)
  );

  // escopo (categoria + chips, sem a busca) — denominador honesto do
  // "N de M" e a base dos grupos; o arquivo continua colapsável no fim
  const filaIds = useMemo(
    () => new Set([...filaMds, ...filaMts].map((i) => i.id)),
    [filaMds, filaMts]
  );
  const totalFila = filaMds.length + filaMts.length;
  const pessoasEscopo = verFora
    ? []
    : basePessoas.filter(
        (p) => p.ativo && catOkPessoa(p) && (!verFila || filaIds.has(p.id))
      );
  const mentoradosEscopo = !catOkMentorado
    ? []
    : mentorados.filter((m) =>
        verFora
          ? foraDoPrograma(m)
          : !foraDoPrograma(m) && (!verFila || filaIds.has(m.id))
      );

  // quem saiu se ordena pela saída mais recente — arquivo cronológico, não
  // fila de trabalho (pendência não se aplica a quem já partiu)
  const porSaidaRecente = (a: Mentorado, b: Mentorado) =>
    (b.saiu_em ?? "").localeCompare(a.saiu_em ?? "") ||
    comparaNome(a.nome, b.nome);
  const foraExibidos = mentorados
    .filter((m) => catOkMentorado && foraDoPrograma(m) && qMentorado(m))
    .sort(porSaidaRecente);
  const inativasExibidas = [...inativasFiltradas].sort((a, b) =>
    comparaNome(a.nome, b.nome)
  );

  // "pendências primeiro" usa a mesma régua dos badges da linha (termo,
  // formação, não-entrou, sem dupla); dentro de cada grupo
  const pessoasExibidas = pessoasEscopo.filter(qPessoa).sort((a, b) =>
    ordem === "pendencias"
      ? pendenciasPessoa(
            b,
            mentorProfiles[b.id],
            temVaga(b),
            assinaturas[b.id]
          ) -
          pendenciasPessoa(
            a,
            mentorProfiles[a.id],
            temVaga(a),
            assinaturas[a.id]
          ) || comparaNome(a.nome, b.nome)
      : comparaNome(a.nome, b.nome)
  );
  const mentoradosExibidos = mentoradosEscopo
    .filter(qMentorado)
    .sort((a, b) =>
      verFora
        ? porSaidaRecente(a, b)
        : ordem === "pendencias"
          ? pendenciasMentorado(b, !emDupla.has(b.id), assinaturas[b.id]) -
              pendenciasMentorado(a, !emDupla.has(a.id), assinaturas[a.id]) ||
            comparaNome(a.nome, b.nome)
          : comparaNome(a.nome, b.nome)
    );

  // a lista unificada em grupos — cada bloco com seu rótulo; grupo vazio
  // não renderiza (busca/filtro que zera um grupo não deixa casca). O grupo
  // "Mentorados" mistura as duas fontes: fichas (MentoradoRow) e contas de
  // jovem com acesso (PessoaRow, profiles role=mentorado)
  const grupos = GRUPO_ORDEM.map((g) => ({
    g,
    pessoas: pessoasExibidas.filter((p) => grupoDePessoa(p) === g),
    mentorados: g === "mentorados" ? mentoradosExibidos : [],
  })).filter(({ pessoas: gp, mentorados: gm }) => gp.length + gm.length > 0);
  const totalSecao = pessoasEscopo.length + mentoradosEscopo.length;
  const exibidos = pessoasExibidas.length + mentoradosExibidos.length;
  const filtrando = Boolean(q) || cat !== "todos" || verFora || verFila;

  const limparFiltros = () => {
    setBusca("");
    setCat("todos");
    setVerFora(false);
    setVerFila(false);
    setOrdem("nome");
  };

  return (
    <>
      {/* barra de filtros enxuta (rodada out/2026): busca + categoria +
          escopos. O select de papel/trilha/status morreu — o próprio
          agrupamento da lista virou o filtro */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <MagnifyingGlass
            aria-hidden
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar pessoa"
            placeholder={
              souCoord ? "Buscar por nome ou e-mail" : "Buscar por nome"
            }
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={cat}
          onValueChange={(v) => setCat(v as CategoriaPessoas)}
          items={{
            todos: "Todos",
            ...GRUPO_LABEL,
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Filtrar por categoria"
            className="w-auto"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="todos">Todos</SelectItem>
            {GRUPO_ORDEM.filter((g) => souCoord || g !== "sempapel").map(
              (g) => (
                <SelectItem key={g} value={g}>
                  {GRUPO_LABEL[g]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        {souCoord && totalFila > 0 && (
          <button
            type="button"
            aria-pressed={verFila}
            onClick={() => {
              setVerFila((v) => !v);
              setVerFora(false);
            }}
            className={filterChipCls(verFila)}
          >
            Aguardando par
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums",
                verFila ? "text-background/70" : "text-muted-foreground/70"
              )}
            >
              {totalFila}
            </span>
          </button>
        )}
        {souCoord && (totalFora > 0 || verFora) && (
          <button
            type="button"
            aria-pressed={verFora}
            onClick={() => {
              setVerFora((v) => !v);
              setVerFila(false);
            }}
            className={filterChipCls(verFora)}
          >
            Fora do programa
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums",
                verFora ? "text-background/70" : "text-muted-foreground/70"
              )}
            >
              {totalFora}
            </span>
          </button>
        )}
        {souCoord && (
          <Select
            value={ordem}
            onValueChange={(v) => setOrdem(v as OrdemPessoas)}
            items={ORDEM_PESSOAS_LABEL}
          >
            <SelectTrigger
              size="sm"
              aria-label="Ordenar"
              className="ml-auto w-auto"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {(
                Object.entries(ORDEM_PESSOAS_LABEL) as [OrdemPessoas, string][]
              ).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {exibidos} de {totalSecao} {totalSecao === 1 ? "pessoa" : "pessoas"}
        </span>
        {filtrando && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-xs"
            onClick={limparFiltros}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* fila + pareamento no mesmo card (fev/2026): a fila é o contexto
          da decisão e o modo Parear transforma as próprias colunas no
          seletor — clicou no jovem, clicou no mentor, afinidade na hora */}
      {souCoord && (
        <FilaEspera
          mentorados={filaMds}
          mentores={filaMts}
          mentoradosPorId={mentoradoPorId}
          pessoasPorId={pessoaPorId}
          semHistorico={temQualquerDupla}
          euNome={euNome}
          mentoradosLivres={mentoradosLivres}
          mentoresDpp={mentoresDpp}
          mentorProfiles={mentorProfiles}
          ocupacao={contagemPorMentor}
          assinaturas={assinaturas}
        />
      )}

      {/* lista única agrupada por categoria (rodada out/2026): um bloco
          por grupo, linhas ricas em grade no desktop e coluna única no
          mobile — "achar o perfil" é a tarefa, a posição do grupo já diz
          a categoria */}
      <div className="space-y-5">
        {grupos.map(({ g, pessoas: gp, mentorados: gm }) => (
          <section key={g} className="space-y-2">
            <h2 className="text-sm font-semibold tabular-nums">
              {verFora && g === "mentorados"
                ? "Fora do programa"
                : GRUPO_LABEL[g]}{" "}
              <span className="font-normal text-muted-foreground">
                ({gp.length + gm.length})
              </span>
            </h2>
            {/* re-key por busca/filtro/ordem — a troca re-roda o
                animate-enter das linhas (convenção) */}
            <div
              key={`${q}|${cat}|${ordem}|${verFora ? 1 : 0}|${verFila ? 1 : 0}|${g}`}
              className="grid gap-2 sm:grid-cols-2"
            >
              {gp.map((p, i) => (
                <PessoaRow
                  key={p.id}
                  p={p}
                  indice={i}
                  temHistorico={temQualquerDupla.has(p.id)}
                  podeExcluir={!p.user_id && !temQualquerDupla.has(p.id)}
                  mentorProfile={mentorProfiles[p.id]}
                  usadas={{
                    dpp: contagemPorMentor[`${p.id}:dpp`] ?? 0,
                    especialista: contagemPorMentor[`${p.id}:especialista`] ?? 0,
                  }}
                  docs={assinaturas[p.id]}
                  faltantesTermo={faltantes?.[p.id]?.["termo-voluntario"] ?? []}
                  souCoord={souCoord}
                />
              ))}
              {gm.map((m, i) => (
                <MentoradoRow
                  key={m.id}
                  m={m}
                  indice={i}
                  emDupla={emDupla.has(m.id)}
                  temDupla={temQualquerDupla.has(m.id)}
                  duplaVivaId={duplaVivaPorMentorado[m.id] ?? null}
                  docs={assinaturas[m.id]}
                  faltantes={faltantes?.[m.id]}
                  souCoord={souCoord}
                />
              ))}
            </div>
          </section>
        ))}

        {grupos.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card py-10 text-center shadow-[var(--shadow-border)]">
            {basePessoas.length === 0 && mentorados.length === 0 ? (
              souCoord ? (
                <>
                  <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <UsersThree aria-hidden size={18} />
                  </span>
                  <p className="text-sm font-medium">Ninguém cadastrado ainda</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Quem faz o programa entra por aqui, um a um ou de uma
                    planilha.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <ImportarCsvDialog />
                    <NovaPessoaDialog />
                    <NovoMentoradoDialog />
                  </div>
                </>
              ) : (
                <>
                  <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <UsersThree aria-hidden size={18} />
                  </span>
                  <p className="text-sm font-medium">Nenhuma pessoa encontrada</p>
                </>
              )
            ) : verFora ? (
              <>
                <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <SignOut aria-hidden size={18} />
                </span>
                <p className="text-sm font-medium">Ninguém fora do programa</p>
                <p className="text-sm text-muted-foreground">
                  Desistências e conclusões registradas no ⋮ do cadastro
                  aparecem aqui.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setVerFora(false)}
                >
                  Ver mentorados
                </Button>
              </>
            ) : (
              <>
                <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <MagnifyingGlass aria-hidden size={18} />
                </span>
                {q ? (
                  <>
                    <p className="text-sm font-medium">
                      Nenhum resultado para “{busca.trim()}”
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {souCoord
                        ? "Tente outro nome, e-mail ou ONG."
                        : "Tente outro nome."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setBusca("")}
                    >
                      Limpar busca
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Nenhum resultado</p>
                    <p className="text-sm text-muted-foreground">
                      Os filtros ativos não retornaram ninguém.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={limparFiltros}
                    >
                      Limpar filtros
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* arquivo de quem saiu do programa (0077) — colapsável, fora do
          grupo principal pra não confundir "ativo" com "desistente"; a
          busca força aberto pra o nome ainda ser encontrável. Com o chip
          ligado a lista principal já é ela — não repete */}
      {!verFora && foraExibidos.length > 0 && (
        <Collapsible.Root
          open={foraAberto || Boolean(q)}
          onOpenChange={setForaAberto}
          className="space-y-2"
        >
          <Collapsible.Trigger className="group flex min-h-11 w-full items-center gap-1.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0">
            <h2 className="text-sm font-semibold tabular-nums">
              Fora do programa ({foraExibidos.length}
              {q && totalFora > foraExibidos.length ? ` de ${totalFora}` : ""})
            </h2>
            <CaretDown
              aria-hidden
              size={13}
              className="text-muted-foreground transition-transform duration-150 group-data-[panel-open]:rotate-180"
            />
          </Collapsible.Trigger>
          <Collapsible.Panel
            keepMounted
            className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
          >
            {/* levemente apagado — arquivo, não fila de trabalho */}
            <div className="grid gap-2 opacity-80 sm:grid-cols-2">
              {foraExibidos.map((m, i) => (
                <MentoradoRow
                  key={m.id}
                  m={m}
                  indice={i}
                  emDupla={emDupla.has(m.id)}
                  temDupla={temQualquerDupla.has(m.id)}
                  duplaVivaId={duplaVivaPorMentorado[m.id] ?? null}
                  docs={assinaturas[m.id]}
                  faltantes={faltantes?.[m.id]}
                  souCoord={souCoord}
                />
              ))}
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      {/* idem pros cadastros desativados da equipe — mesma gramática do
          arquivo de saídas (só coord vê; pros demais nem chegam) */}
      {souCoord && inativasExibidas.length > 0 && (
        <Collapsible.Root
          open={inativosAberto || Boolean(q)}
          onOpenChange={setInativosAberto}
          className="space-y-2"
        >
          <Collapsible.Trigger className="group flex min-h-11 w-full items-center gap-1.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0">
            <h2 className="text-sm font-semibold tabular-nums">
              Inativos ({inativasExibidas.length}
              {q && inativas.length > inativasExibidas.length
                ? ` de ${inativas.length}`
                : ""})
            </h2>
            <CaretDown
              aria-hidden
              size={13}
              className="text-muted-foreground transition-transform duration-150 group-data-[panel-open]:rotate-180"
            />
          </Collapsible.Trigger>
          <Collapsible.Panel
            keepMounted
            className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
          >
            <div className="grid gap-2 opacity-80 sm:grid-cols-2">
              {inativasExibidas.map((p, i) => (
                <PessoaRow
                  key={p.id}
                  p={p}
                  indice={i}
                  emInativos
                  temHistorico={temQualquerDupla.has(p.id)}
                  podeExcluir={!p.user_id && !temQualquerDupla.has(p.id)}
                  mentorProfile={mentorProfiles[p.id]}
                  usadas={{
                    dpp: contagemPorMentor[`${p.id}:dpp`] ?? 0,
                    especialista: contagemPorMentor[`${p.id}:especialista`] ?? 0,
                  }}
                  docs={assinaturas[p.id]}
                  faltantesTermo={faltantes?.[p.id]?.["termo-voluntario"] ?? []}
                  souCoord={souCoord}
                />
              ))}
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}
    </>
  );
}

/** Botão "Detalhes" com chevron — abre a região operacional da linha (vagas,
 *  pendências, autorização), que saiu da linha principal pra não poluir a
 *  leitura. O dot warn sinaliza "tem pendência aqui" sem devolver jargão. */
function DetalhesTrigger({
  temPendencia,
}: {
  temPendencia: boolean;
}) {
  return (
    <Collapsible.Trigger className="group inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8">
      Detalhes
      {temPendencia && (
        <>
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--warn)]" />
          <span className="sr-only">(com pendências)</span>
        </>
      )}
      <CaretDown
        aria-hidden
        size={13}
        className="transition-transform duration-150 group-data-[panel-open]:rotate-180"
      />
    </Collapsible.Trigger>
  );
}

/** Item da região "Detalhes" — ícone discreto + frase completa em linguagem
 *  humana (o que era "pendências: termo · formação" vira uma linha por item). */
function ItemDetalhe({
  icone: Icone,
  warn = false,
  children,
}: {
  icone: Icon;
  /** Pendência que pede ação — ícone e texto ganham destaque discreto. */
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icone
        aria-hidden
        size={15}
        className={cn(
          "mt-0.5 shrink-0",
          warn ? "text-[var(--warn-text)]" : "text-muted-foreground"
        )}
      />
      <span className={warn ? undefined : "text-muted-foreground"}>
        {children}
      </span>
    </li>
  );
}

/** "assinado em dd/mm" clicável — abre o PDF com a página de evidências
 *  (/api/assinatura/<id>, sessão coord). Antes era texto morto: ver o
 *  documento exigia abrir o dialog de edição da pessoa. */
function LinkAssinatura({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a
      href={`/api/assinatura/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm text-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <span className="sr-only"> (abre o PDF assinado em nova aba)</span>
    </a>
  );
}

/** Região colapsável de detalhes — keepMounted pra que o aria-controls do
 *  trigger resolva também fechada (mesma regra do `hidden` anterior); largura
 *  cheia abaixo da linha, segura em 390px. */
function DetalhesRegiao({
  id,
  nome,
  children,
}: {
  id: string;
  /** Nome da pessoa — compõe o aria-label da região. */
  nome: string;
  children: ReactNode;
}) {
  return (
    <Collapsible.Panel
      keepMounted
      id={id}
      role="region"
      aria-label={`Detalhes de ${nome}`}
      className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
    >
      <div className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2.5 shadow-[var(--shadow-inset)]">
        <ul className="space-y-1.5">{children}</ul>
      </div>
    </Collapsible.Panel>
  );
}

/** Linha de pessoa — pra coordenação: avatar, nome e contexto essencial,
 *  com vagas/pendências do mentor na região "Detalhes" colapsável. Pros
 *  demais papéis é uma linha de diretório: papel como badge estático e
 *  cargo/empresa (ou cidade/UF) + áreas/interesses no lugar do contato —
 *  o suficiente pra "ter ideia do perfil do colega". */
function PessoaRow({
  p,
  indice,
  temHistorico,
  podeExcluir,
  mentorProfile: mp,
  usadas,
  docs: docsProp,
  faltantesTermo = [],
  souCoord,
  emInativos = false,
}: {
  p: Profile;
  indice: number;
  /** qualquer dupla — inclusive encerrada: quem tem histórico não é "sem
   *  dupla" (e a exclusão fica bloqueada por isso) */
  temHistorico: boolean;
  podeExcluir: boolean;
  mentorProfile: MentorProfile | undefined;
  /** Duplas em andamento (ativa + pausada) POR TRILHA — o X do "X/Y" da
   *  capacidade; o híbrido tem duas pools (WP6b). */
  usadas: { dpp: number; especialista: number };
  docs: DocsPessoa | undefined;
  /** labels do que falta na ficha pro termo do voluntário — coord-only */
  faltantesTermo?: string[];
  souCoord: boolean;
  /** Na seção "Inativos" o badge "inativa" seria redundante em cada linha —
   *  e as pendências operacionais (termo, não-entrou) não se aplicam mais. */
  emInativos?: boolean;
}) {
  // mentor sem linha em mentor_profiles vale capacidade 1 (mesma regra do
  // createDupla) — por trilha (0073/WP6b: o híbrido tem as duas pools)
  const capDpp = mp?.capacidade ?? 1;
  const capEsp = mp?.capacidade_especialista ?? 1;
  const hibrido =
    temPapel(p, "mentor_dpp") && temPapel(p, "mentor_especialista");
  const trilhaPrimaria =
    p.role === "mentor_especialista" ? "especialista" : "dpp";
  const capacidade = trilhaPrimaria === "especialista" ? capEsp : capDpp;
  const usoPrimario =
    trilhaPrimaria === "especialista" ? usadas.especialista : usadas.dpp;
  const detalhesId = `detalhes-${p.id}`;
  const mentor = ehMentor(p);
  // conta de jovem (role=mentorado no profiles): participante, não
  // voluntária — o documento dela é o termo do mentorado, não o de adesão
  const papelEhMentorado = p.role === "mentorado";
  const docs = docsProp ?? DOCS_VAZIO;
  const assinadoTermo = docs.assinado["termo-voluntario"];
  // o termo de voluntariado vale pra equipe inteira — mentor via termo_ok
  // (que também cobre o upload em papel), demais papéis pela assinatura
  // ou pelo documento_path direto; quem não é voluntário não tem o que cobrar
  const termoOk =
    p.voluntario === false || papelEhMentorado
      ? true
      : mentor
        ? Boolean(mp?.termo_ok)
        : assinadoTermo !== undefined || Boolean(p.documento_path);
  // inativo não tem pendência operacional a cobrar — a seção dele é arquivo;
  // não-voluntário não deve termo (o flag do cadastro decide), só formação.
  // Pra equipe sem papel de mentor, "ainda não entrou" e termo faltando
  // são as pendências cobráveis
  const temPendencia =
    p.ativo &&
    (mentor
      ? (p.voluntario !== false && !mp?.termo_ok) || !mp?.formacao_ok
      : !termoOk || !p.user_id);
  // diretório: subtítulo de contexto profissional (cargo · empresa, senão
  // cidade · UF) + chips do que a pessoa oferece/curte — áreas pra mentor,
  // interesses pro resto; tudo coluna pública do grant (0026/0034)
  const subtitulo =
    [p.cargo, p.empresa].filter(Boolean).join(" · ") ||
    [p.cidade, p.uf].filter(Boolean).join(" · ");
  const chipsPerfil = mentor ? (p.areas ?? []) : (p.interesses ?? []);
  const CHIPS_MAX = 4;
  // meta sob o nome (coord): mentor lê a ocupação de cada pool na linha
  // ("DPP 1/2 · sem vaga"), equipe lê contexto, pré-cadastro lê e-mail
  const metaCoord = mentor
    ? [
        temPapel(p, "mentor_dpp") ? `DPP ${usadas.dpp}/${capDpp}` : null,
        temPapel(p, "mentor_especialista")
          ? `Esp ${usadas.especialista}/${capEsp}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : p.role == null
      ? p.email
      : subtitulo || p.email;
  const semVagaDpp = temPapel(p, "mentor_dpp") && usadas.dpp >= capDpp;
  return (
    // Root do disclosure da linha — o trigger mora no cluster de ações e o
    // painel vem depois da linha principal; uncontrolled, sem estado local.
    // Card próprio (rodada out/2026): a lista unificada em grade 2 colunas
    // pede célula independente em vez de linha dividida
    <Collapsible.Root
      className="animate-enter rounded-xl bg-card px-3.5 py-3 shadow-[var(--shadow-border)]"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* um Link só engloba avatar+nome+meta — tabstop único e alvo
            de toque maior; aria-label pro nome acessível não virar
            "Nome email +55…" (o Avatar já é aria-hidden) */}
        <Link
          href={`/pessoas/${p.id}`}
          aria-label={`Abrir perfil de ${p.nome}`}
          className="group -my-1 flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar
            nome={p.nome}
            src={p.avatar_path ? avatarPublicUrl(p.avatar_path) : null}
            size={40}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium underline-offset-4 transition-colors group-hover:underline">
              {p.nome}
              {!souCoord && p.nome_social && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ({p.nome_social})
                </span>
              )}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {souCoord && p.role && (
                <Badge
                  variant="outline"
                  className="shrink-0 px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
                >
                  {papelLabelComposto(p)}
                </Badge>
              )}
              <span className="truncate">
                {souCoord ? (
                  <>
                    {metaCoord}
                    {semVagaDpp && (
                      <span className="text-[var(--warn-text)]">
                        {" · sem vaga"}
                      </span>
                    )}
                  </>
                ) : (
                  subtitulo || "\u00A0"
                )}
              </span>
            </span>
            {!souCoord && chipsPerfil.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-1">
                {chipsPerfil.slice(0, CHIPS_MAX).map((c) => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="bg-muted font-normal text-muted-foreground"
                  >
                    {c}
                  </Badge>
                ))}
                {chipsPerfil.length > CHIPS_MAX && (
                  <span className="self-center text-[11px] text-muted-foreground">
                    +{chipsPerfil.length - CHIPS_MAX}
                  </span>
                )}
              </span>
            )}
          </span>
        </Link>
        {!souCoord && p.role && (
          <Badge variant="outline" className="ml-auto shrink-0 text-xs font-normal">
            {papelLabelComposto(p)}
          </Badge>
        )}
        {souCoord && !p.ativo && !emInativos && (
          <Badge variant="outline" className="text-xs shrink-0 border-[var(--danger)]/50 text-[var(--danger)]">
            inativa
          </Badge>
        )}
        {souCoord && p.ativo && !p.user_id && (
          <Badge variant="outline" className="text-xs shrink-0">ainda não entrou</Badge>
        )}
        {souCoord && p.ativo && !termoOk && (
          <Badge
            variant="outline"
            className="text-xs shrink-0 border-[var(--warn)]/60 text-[var(--warn-text)]"
          >
            termo pendente
          </Badge>
        )}
        {/* capacidade X/Y e e-mail saíram da linha — ocupação vai no meta,
            contato e pendências em "Detalhes" (rodada out/2026) */}
        {souCoord && <DetalhesTrigger temPendencia={temPendencia} />}
        {/* a 390px o cluster cai pra linha própria — w-full deixa o select de
            papel ocupar a linha toda (alvo generoso) com o ⋮ na direita;
            sm+ volta a ser o cluster compacto colado à direita */}
        {souCoord && (
          <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto">
            <div className="w-full sm:w-40">
              <RoleSelect profileId={p.id} role={p.role} papeis={p.papeis} nome={p.nome} />
            </div>
            <PessoaActions
              pessoa={p}
              // mesma guarda do server: qualquer dupla (até encerrada) bloqueia excluir
              podeExcluir={podeExcluir}
            />
          </div>
        )}
      </div>
      {souCoord && mentor && (
        <DetalhesRegiao id={detalhesId} nome={p.nome}>
          <ItemDetalhe icone={Users}>
            {/* X/Y explícito (REALIZA-116): ativas + pausadas contra o teto
                da pool — o "sem vaga" avisa que o próximo par pede ajuste.
                WP6b: híbrido mostra a pool do papel primário aqui e a
                secundária na linha seguinte, cada uma com seu ajuste */}
            {hibrido && (
              <span className="mr-1 font-medium">
                {trilhaPrimaria === "especialista" ? "Especialista:" : "DPP:"}
              </span>
            )}
            {usoPrimario === 0
              ? temHistorico
                ? `Sem dupla em andamento · ${capacidade === 1 ? "1 vaga" : `${capacidade} vagas`} · histórico na ficha`
                : `Sem dupla em andamento · ${capacidade === 1 ? "1 vaga" : `${capacidade} vagas`} pra parear`
              : `${usoPrimario}/${capacidade} ${capacidade === 1 ? "dupla" : "duplas"} em andamento${usoPrimario >= capacidade ? " · sem vaga" : ""}`}
            {p.ativo && (
              <>
                {" · "}
                <CapacidadeMentorDialog
                  mentorId={p.id}
                  nome={p.nome}
                  atual={capacidade}
                  emUso={usoPrimario}
                  trilha={trilhaPrimaria}
                  trigger={
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="-my-2 sm:my-0"
                    >
                      ajustar
                    </Button>
                  }
                />
              </>
            )}
          </ItemDetalhe>
          {hibrido && (
            <ItemDetalhe icone={Users}>
              {/* segunda pool do híbrido (WP6b) — X/Y e ajuste próprios */}
              <span className="mr-1 font-medium">
                {trilhaPrimaria === "especialista" ? "DPP:" : "Especialista:"}
              </span>
              {(() => {
                const uso2 =
                  trilhaPrimaria === "especialista" ? usadas.dpp : usadas.especialista;
                const cap2 =
                  trilhaPrimaria === "especialista" ? capDpp : capEsp;
                const trilha2 =
                  trilhaPrimaria === "especialista" ? "dpp" : "especialista";
                return (
                  <>
                    {uso2 === 0
                      ? `Sem dupla em andamento · ${cap2 === 1 ? "1 vaga" : `${cap2} vagas`} pra parear`
                      : `${uso2}/${cap2} ${cap2 === 1 ? "dupla" : "duplas"} em andamento${uso2 >= cap2 ? " · sem vaga" : ""}`}
                    {p.ativo && (
                      <>
                        {" · "}
                        <CapacidadeMentorDialog
                          mentorId={p.id}
                          nome={p.nome}
                          atual={cap2}
                          emUso={uso2}
                          trilha={trilha2}
                          trigger={
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="-my-2 sm:my-0"
                            >
                              ajustar
                            </Button>
                          }
                        />
                      </>
                    )}
                  </>
                );
              })()}
            </ItemDetalhe>
          )}
          {/* termo só aparece pra quem é voluntário — não-voluntário não
              tem o documento a assinar, mostrar "pendente" seria ruído */}
          {p.voluntario !== false &&
            (mp?.termo_ok ? (
              <ItemDetalhe icone={FileText}>
                {assinadoTermo !== undefined ? (
                  <LinkAssinatura id={assinadoTermo.id}>
                    {`Termo de adesão assinado${assinadoTermo.em ? ` em ${fmtDia(assinadoTermo.em)}` : ""}`}
                  </LinkAssinatura>
                ) : (
                  "Termo de adesão no arquivo"
                )}
              </ItemDetalhe>
            ) : (
              <ItemDetalhe icone={FileText} warn>
                Termo de adesão pendente de assinatura
              </ItemDetalhe>
            ))}
          {!mp?.formacao_ok && (
            <ItemDetalhe icone={GraduationCap} warn>
              Formação inicial pendente
            </ItemDetalhe>
          )}
          {/* lacuna na ficha importa pro link de assinatura — não bloqueia
              (quem assina completa no ato), mas a coord pode preferir
              completar antes de mandar */}
          {!termoOk && faltantesTermo.length > 0 && (
            <ItemDetalhe icone={FileText} warn>
              {`Civis incompletos pro termo (falta: ${faltantesTermo.join(" · ")}) · quem assina completa na hora`}
            </ItemDetalhe>
          )}
          {/* contato e contexto saíram da linha (rodada out/2026) — vivem
              aqui pra linha principal ficar em duas linhas curtas */}
          {p.email && (
            <ItemDetalhe icone={EnvelopeSimple}>{p.email}</ItemDetalhe>
          )}
          {p.whatsapp && (
            <ItemDetalhe icone={WhatsappLogo}>
              {formatarWhatsApp(p.whatsapp)}
            </ItemDetalhe>
          )}
          {(p.cargo || p.empresa) && (
            <ItemDetalhe icone={Briefcase}>
              {[p.cargo, p.empresa].filter(Boolean).join(" · ")}
            </ItemDetalhe>
          )}
          {(p.cidade || p.uf) && (
            <ItemDetalhe icone={MapPin}>
              {[p.cidade, p.uf].filter(Boolean).join(" · ")}
            </ItemDetalhe>
          )}
        </DetalhesRegiao>
      )}
      {/* equipe sem papel de mentor (coordenação, supervisor, auxiliar,
          pré-cadastro): pendências + contato — mesma gramática do mentor */}
      {souCoord && !mentor && (
        <DetalhesRegiao id={detalhesId} nome={p.nome}>
          {p.voluntario !== false &&
            !papelEhMentorado &&
            (termoOk ? (
              <ItemDetalhe icone={FileText}>
                {assinadoTermo !== undefined ? (
                  <LinkAssinatura id={assinadoTermo.id}>
                    {`Termo de adesão assinado${assinadoTermo.em ? ` em ${fmtDia(assinadoTermo.em)}` : ""}`}
                  </LinkAssinatura>
                ) : (
                  "Termo de adesão no arquivo"
                )}
              </ItemDetalhe>
            ) : (
              <ItemDetalhe icone={FileText} warn>
                Termo de adesão pendente de assinatura
              </ItemDetalhe>
            ))}
          {p.ativo && !p.user_id && (
            <ItemDetalhe icone={UserPlus}>
              Ainda não entrou na plataforma
            </ItemDetalhe>
          )}
          {p.email && (
            <ItemDetalhe icone={EnvelopeSimple}>{p.email}</ItemDetalhe>
          )}
          {p.whatsapp && (
            <ItemDetalhe icone={WhatsappLogo}>
              {formatarWhatsApp(p.whatsapp)}
            </ItemDetalhe>
          )}
          {(p.cargo || p.empresa) && (
            <ItemDetalhe icone={Briefcase}>
              {[p.cargo, p.empresa].filter(Boolean).join(" · ")}
            </ItemDetalhe>
          )}
          {(p.cidade || p.uf) && (
            <ItemDetalhe icone={MapPin}>
              {[p.cidade, p.uf].filter(Boolean).join(" · ")}
            </ItemDetalhe>
          )}
        </DetalhesRegiao>
      )}
    </Collapsible.Root>
  );
}

/** Linha de mentorado — mesma gramática da de pessoa; a autorização do
 *  responsável (LGPD) vira frase completa em "Detalhes", não badge de jargão.
 *  Pros demais papéis é só diretório (nome + ONG + contato já escopado pelo
 *  RLS): sem badges de pendência nem ações. */
function MentoradoRow({
  m,
  indice,
  emDupla,
  temDupla,
  duplaVivaId,
  docs: docsProp,
  faltantes,
  souCoord,
}: {
  m: Mentorado;
  indice: number;
  emDupla: boolean;
  temDupla: boolean;
  /** Id da dupla ativa/pausada (0077) — alimenta o bloqueio do dialog de
   *  saída (quem tem par em andamento encerra a dupla antes) */
  duplaVivaId?: string | null;
  docs: DocsPessoa | undefined;
  /** slug → labels de faltante civil da ficha (coord-only, labels só) */
  faltantes?: Record<string, string[]>;
  souCoord: boolean;
}) {
  const detalhesId = `detalhes-${m.id}`;
  // quem saiu do programa (0077): fora do grupo principal — sem badges de
  // pendência operacional (termo/autorização não se cobram de quem partiu),
  // a situação vira badge própria e o motivo/data vão pra "Detalhes"
  const fora = foraDoPrograma(m);
  // LGPD: parear menor sem a autorização do responsável é pendência jurídica.
  // Vale tanto o upload manual (documento_path) quanto a assinatura por link.
  const docs = docsProp ?? DOCS_VAZIO;
  // 0046: quem assina o termo de participação é o próprio jovem — pra menor
  // de idade a coordenação emite a autorização do responsável NO LUGAR dele.
  // Exigir os dois pra todos marcava adulto como "autorização pendente".
  const anos = idade(m.data_nascimento);
  const menor = anos != null && anos < 18;
  const autData = docs.assinado["autorizacao-responsavel"];
  const termoData = docs.assinado["termo-mentorando"];
  const autorizacaoOk = Boolean(m.documento_path) || autData !== undefined;
  const termoOk = termoData !== undefined;
  const autEnviada = docs.pendente.includes("autorizacao-responsavel");
  const termoEnviado = docs.pendente.includes("termo-mentorando");
  const docOk = menor ? autorizacaoOk : termoOk;
  const docEnviado = menor ? autEnviada : termoEnviado;
  const temPendencia = !docOk && !fora;
  // lacuna civil do documento que vale pra essa pessoa (autorização olha a
  // ficha do responsável; o termo olha a do jovem)
  const faltantesDoc =
    faltantes?.[menor ? "autorizacao-responsavel" : "termo-mentorando"] ?? [];
  const temDocs =
    temPendencia ||
    Object.keys(docs.assinado).length > 0 ||
    docs.pendente.length > 0 ||
    Boolean(m.saiu_em || m.motivo_saida);
  // meta sob o nome: ONG de origem sempre; pra coord a situação de par
  // substitui os badges "em dupla"/"sem dupla" (rodada out/2026); whatsapp
  // dos demais papéis é o contato público do diretório
  const metaLinha = souCoord
    ? `${m.ong_origem ?? "sem ONG"} · ${emDupla ? "em dupla" : fora ? "fora do programa" : "aguardando par"}`
    : `${m.ong_origem ?? "sem ONG"}${m.whatsapp ? ` · ${formatarWhatsApp(m.whatsapp)}` : ""}`;
  return (
    // idem PessoaRow — Root do disclosure: trigger no cluster, painel
    // embaixo; card próprio pra grade 2 colunas da lista unificada
    <Collapsible.Root
      className="animate-enter rounded-xl bg-card px-3.5 py-3 shadow-[var(--shadow-border)]"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={`/pessoas/${m.id}`}
          aria-label={`Abrir perfil de ${m.nome}`}
          className="group -my-1 flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar
            nome={m.nome}
            src={m.avatar_path ? avatarPublicUrl(m.avatar_path) : null}
            papel="mentorado"
            size={40}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {!m.avatar_path && (
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--role-mentorado)]" />
              )}
              <span
                className={cn(
                  "truncate underline-offset-4 transition-colors group-hover:underline",
                  fora && "text-muted-foreground"
                )}
              >
                {m.nome}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {metaLinha}
            </span>
          </span>
        </Link>
        {/* situação do programa (0077) — pra todo papel que alcança a ficha:
            "Desistente"/"Concluiu" é o porquê dela não estar entre os ativos */}
        {fora && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs shrink-0",
              m.situacao === "desistente" &&
                "border-[var(--warn)]/60 text-[var(--warn-text)]"
            )}
          >
            {SITUACAO_MENTORADO_LABEL[m.situacao ?? "ativo"]}
          </Badge>
        )}
        {souCoord && !fora && !docOk && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs shrink-0",
              !docEnviado &&
                "border-[var(--warn)]/60 text-[var(--warn-text)]"
            )}
          >
            {docEnviado
              ? menor
                ? "autorização enviada"
                : "termo enviado"
              : menor
                ? "autorização pendente"
                : "termo pendente"}
          </Badge>
        )}
        {souCoord && temDocs && (
          <DetalhesTrigger temPendencia={temPendencia} />
        )}
        {souCoord && (
          <div className="flex items-center gap-2 ml-auto">
            <MentoradoActions
              mentorado={m}
              temDupla={temDupla}
              duplaVivaId={duplaVivaId}
            />
          </div>
        )}
      </div>
      {souCoord && temDocs && (
        <DetalhesRegiao id={detalhesId} nome={m.nome}>
          {/* whatsapp saiu do meta (rodada out/2026) — contato fica aqui */}
          {m.whatsapp && (
            <ItemDetalhe icone={WhatsappLogo}>
              {formatarWhatsApp(m.whatsapp)}
            </ItemDetalhe>
          )}
          {fora && (
            <ItemDetalhe icone={SignOut}>
              {[
                SITUACAO_MENTORADO_LABEL[m.situacao ?? "ativo"],
                m.saiu_em ? `saiu em ${fmtDia(m.saiu_em)}` : null,
                m.motivo_saida,
              ]
                .filter(Boolean)
                .join(" · ")}
            </ItemDetalhe>
          )}
          {menor && (
            <ItemDetalhe icone={FileText} warn={!autorizacaoOk}>
              {autorizacaoOk ? (
                autData !== undefined ? (
                  <LinkAssinatura id={autData.id}>
                    {`Autorização do responsável assinada${autData.em ? ` em ${fmtDia(autData.em)}` : ""}`}
                  </LinkAssinatura>
                ) : (
                  "Autorização do responsável no arquivo"
                )
              ) : autEnviada ? (
                "Autorização enviada, aguardando a assinatura do responsável"
              ) : (
                "Autorização do responsável ainda não enviada"
              )}
            </ItemDetalhe>
          )}
          {!menor && (
            <ItemDetalhe icone={FileText} warn={!termoOk}>
              {termoOk ? (
                <LinkAssinatura id={termoData!.id}>
                  {`Termo de participação assinado${termoData!.em ? ` em ${fmtDia(termoData!.em)}` : ""}`}
                </LinkAssinatura>
              ) : termoEnviado ? (
                "Termo de participação enviado, aguardando assinatura"
              ) : (
                "Termo de participação ainda não enviado"
              )}
            </ItemDetalhe>
          )}
          {!docOk && faltantesDoc.length > 0 && (
            <ItemDetalhe icone={FileText} warn>
              {`Civis incompletos pro documento (falta: ${faltantesDoc.join(" · ")}) · quem assina completa na hora`}
            </ItemDetalhe>
          )}
        </DetalhesRegiao>
      )}
    </Collapsible.Root>
  );
}
