"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import dynamic from "next/dynamic";
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
import {
  PAPEL_TURMA_LABEL,
  STATUS_PESSOA_LABEL,
  rankNaTurma,
  slugDocMentorado,
  statusDePessoa,
  termoOkMentorado,
  termoOkProfile,
  turmasDePessoa,
  type MapasTurma,
  type PapelTurma,
  type StatusPessoa,
  type StatusPessoas,
} from "@/lib/pessoas-status";
import { turmaLonga, turmaAno } from "@/lib/turma";
import { cn, normaliza } from "@/lib/utils";
import {
  comparaNome,
  foraDoPrograma,
  idade,
  SITUACAO_MENTORADO_LABEL,
} from "@/lib/ciclo";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { PessoaActions } from "@/components/pessoa-actions";
import { MentoradoActions } from "@/components/mentorado-actions";
import { ImportarCsvDialog } from "@/components/importar-csv-dialog";
import { CapacidadeMentorDialog } from "@/components/capacidade-mentor-dialog";
import { NovaPessoaDialog, NovoMentoradoDialog } from "@/components/pessoas-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChipRow, filterChipCls } from "@/components/ui/filter-chip";
import { FiltrosButton } from "@/components/ui/filtros-button";
import {
  OpcaoCheck,
  OpcaoPilula,
  OVERLINE,
} from "@/components/ui/filtro-opcoes";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// o card da fila só existe pra coordenação — quase 1k linhas fora do
// chunk de quem visita /pessoas como mentor/supervisor (SSR mantido)
const FilaEspera = dynamic(() =>
  import("@/components/fila-espera").then((m) => m.FilaEspera)
);

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

/** Rascunho do modal de filtros — aplica tudo de uma vez no "Aplicar"
 *  (gramática de /registros). Agrupar e ordenar são controles de visão:
 *  não contam no selo de ativos e o "Limpar" os preserva. */
type DraftFiltros = {
  agrupar: "papel" | "turma";
  cat: string;
  status: StatusPessoa | "todos";
  trilha: "todas" | "dpp" | "especialista";
  pendencias: boolean;
  ordem: OrdemPessoas;
};

/** Grupos da lista unificada — "por cargo" é o agrupamento padrão (a
 *  inversão da REALIZA-39 pra turma foi revertida na 376; a leitura por
 *  ciclo segue como alternativa). "sempapel" = pré-cadastro aguardando
 *  papel, grupo que só a coordenação enxerga. */
type Grupo = "equipe" | "supervisores" | "mentores" | "mentorados" | "sempapel";

const GRUPO_ORDEM: Grupo[] = [
  "equipe",
  "supervisores",
  "mentores",
  "mentorados",
  "sempapel",
];

const GRUPO_LABEL: Record<Grupo, string> = {
  equipe: "Coordenação e equipe",
  supervisores: "Auxiliares executivos",
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

// ---------- status por pessoa (REALIZA-39) ----------
// O vocabulário fechado do /pessoas — derivado dos mesmos insumos dos
// badges que ele substitui (termo/docs via a mesma régua dos detalhes,
// acesso via a view profiles_acesso da 0192). Só a coordenação vê.

/** Estilo do chip de status — o primário é o badge cheio da régua; os
 *  secundários (pendências que coexistem) vêm esmaecidos. */
const STATUS_CHIP_CLS: Record<StatusPessoa, string> = {
  inativo: "border-[var(--danger)]/50 text-[var(--danger)]",
  convidado: "text-muted-foreground",
  nao_acessou: "border-[var(--warn)]/60 text-[var(--warn-text)]",
  termo_pendente: "border-[var(--warn)]/60 text-[var(--warn-text)]",
  docs_pendentes: "border-[var(--warn)]/60 text-[var(--warn-text)]",
  ativo: "border-[var(--ok)]/50 text-[var(--ok-text,var(--ok))]",
};

function StatusChips({ status }: { status: StatusPessoas }) {
  return (
    <>
      <Badge
        variant="outline"
        className={cn("text-xs shrink-0", STATUS_CHIP_CLS[status.primario])}
      >
        {STATUS_PESSOA_LABEL[status.primario]}
      </Badge>
      {status.secundarios.map((s) => (
        <Badge
          key={s}
          variant="outline"
          className={cn("text-[11px] shrink-0 opacity-80", STATUS_CHIP_CLS[s])}
        >
          {STATUS_PESSOA_LABEL[s]}
        </Badge>
      ))}
    </>
  );
}

/** Status do profile — a mesma régua dos badges antigos (termo pela régua
 *  do papel, "convite enviado" = conta sem onboarding) + o "não acessou"
 *  novo, do último acesso real da 0192. Civis faltantes só contam quando
 *  o termo ainda não saiu assinado (depois disso não há o que completar). */
function statusDeProfile(
  p: Profile,
  mp: MentorProfile | undefined,
  docs: DocsPessoa | undefined,
  faltantesTermo: string[] | undefined,
  ultimoAcessoEm: string | null | undefined
): StatusPessoas {
  const termoOk = termoOkProfile(p, mp, docs);
  return statusDePessoa({
    ativo: p.ativo,
    contaVinculada: Boolean(p.user_id),
    onboardedEm: p.onboarded_em,
    ultimoAcessoEm: ultimoAcessoEm ?? null,
    termoOk,
    docsFaltantes: termoOk ? [] : (faltantesTermo ?? []),
  });
}

/** Idem pro jovem — o documento devido vira "documentos pendentes" (o
 *  slug da autorização não é "termo"); acesso/onboarding via a conta
 *  vinculada (profile_id → profiles_acesso). */
function statusDeMentorado(
  m: Mentorado,
  docs: DocsPessoa | undefined,
  faltantesDoc: string[] | undefined,
  ultimoAcessoEm: string | null | undefined
): StatusPessoas {
  const docOk = termoOkMentorado(m, docs);
  return statusDePessoa({
    ativo: !foraDoPrograma(m),
    contaVinculada: Boolean(m.profile_id),
    onboardedEm: m.conta?.onboarded_em ?? null,
    ultimoAcessoEm: m.profile_id ? (ultimoAcessoEm ?? null) : null,
    termoOk: true,
    docsFaltantes: docOk ? [] : (faltantesDoc?.length ? faltantesDoc : ["x"]),
  });
}

/** Um item da lista unificada no modo turma — a pessoa aparece em CADA
 *  turma a que pertence (não é dedup global); dentro da turma, os papéis
 *  dela naquele recorte viram chips contextuais. */
type ItemTurma =
  | { tipo: "profile"; p: Profile; papeis: PapelTurma[] }
  | { tipo: "mentorado"; m: Mentorado; papeis: PapelTurma[] };

const SEM_TURMA = "__sem_turma__";

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
  mapasTurma,
  acesso,
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
  /** Filiação por turma (REALIZA-39) — duplas (com o rótulo vivo já
   *  resolvido na page) + inscrições + grants escopados. Coord-only: no
   *  diretório chega vazio e o modo turma nem liga. */
  mapasTurma?: MapasTurma;
  /** profile_id → último acesso (profiles_acesso, 0192) — insumo do
   *  status "não acessou". Coord-only. */
  acesso?: Record<string, string | null>;
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
  // categoria = recorte por papel (equipe, mentores, mentorados…) — vive
  // no modal de filtros; na URL vai crua (?cat=mentorados)
  const [cat, setCat] = useState<string>(() => {
    if (typeof window === "undefined") return "todos";
    const c = new URLSearchParams(window.location.search).get("cat");
    return c && !c.startsWith("turma:") ? c : "todos";
  });
  // turma = recorte por ciclo em pills na barra (Todos, Turma 1, Turma 2…);
  // "sem-turma" marca o balde de quem não tem evidência nenhuma. Link
  // antigo mandava a turma namespaced dentro de ?cat=turma:<rótulo> — lê
  // dos dois pra não quebrar deep-link já compartilhado
  const [turmaSel, setTurmaSel] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("cat");
    if (c?.startsWith("turma:")) {
      const v = c.slice(6);
      return v === SEM_TURMA ? SEM_TURMA : v;
    }
    const t = sp.get("turma");
    if (!t) return null;
    return t === "sem-turma" || t === SEM_TURMA ? SEM_TURMA : t;
  });
  // filtros do modal (REALIZA-376): status operacional no vocabulário
  // fechado, trilha do mentor e "somente com pendências"
  const [statusSel, setStatusSel] = useState<StatusPessoa | "todos">(() => {
    if (typeof window === "undefined") return "todos";
    const s = new URLSearchParams(window.location.search).get("status");
    return s && s in STATUS_PESSOA_LABEL ? (s as StatusPessoa) : "todos";
  });
  const [trilhaSel, setTrilhaSel] = useState<"todas" | "dpp" | "especialista">(
    () => {
      if (typeof window === "undefined") return "todas";
      const t = new URLSearchParams(window.location.search).get("trilha");
      return t === "dpp" || t === "especialista" ? t : "todas";
    }
  );
  const [soPendencias, setSoPendencias] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("pendencias") === "1"
  );
  const [foraAberto, setForaAberto] = useState(false);
  const [inativosAberto, setInativosAberto] = useState(false);
  const [ordem, setOrdem] = useState<OrdemPessoas>(() => {
    if (typeof window === "undefined") return "nome";
    return new URLSearchParams(window.location.search).get("ordem") ===
      "pendencias"
      ? "pendencias"
      : "nome";
  });
  // agrupamento da página (REALIZA-376): "por cargo" é o padrão de novo —
  // ?agrupar=turma liga a leitura por ciclo, que segue como alternativa
  // dentro do modal. Só a coordenação tem os mapas de filiação; no
  // diretório o grupo é sempre o papel.
  const [agrupar, setAgrupar] = useState<"papel" | "turma">(() => {
    if (typeof window === "undefined") return "papel";
    return new URLSearchParams(window.location.search).get("agrupar") ===
      "turma"
      ? "turma"
      : "papel";
  });
  const porTurma = souCoord && agrupar === "turma";
  // modal de filtros — o rascunho aplica de uma vez no "Aplicar"
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [draft, setDraft] = useState<DraftFiltros>({
    agrupar: "papel",
    cat: "todos",
    status: "todos",
    trilha: "todas",
    pendencias: false,
    ordem: "nome",
  });
  const emDupla = useMemo(() => new Set(comDupla), [comDupla]);
  const temQualquerDupla = useMemo(() => new Set(comQualquerDupla), [comQualquerDupla]);

  // debounce da busca por nome (300ms) — REALIZA-318
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

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
  // ---------- filtros derivados ----------
  // mapas de filiação (coord) — a turma da pessoa deriva das mesmas 3
  // fontes do modo "por turma": a dupla (turmaDaDupla resolvida na page),
  // turma_inscricoes e o escopo_turma do grant. Sem evidência → "Sem turma"
  const mapas: MapasTurma = useMemo(
    () =>
      mapasTurma ?? {
        duplas: [],
        inscricoes: [],
        papeisEscopo: [],
      },
    [mapasTurma]
  );

  // status operacional — a mesma régua dos badges da linha
  const statusProfile = (p: Profile) =>
    statusDeProfile(
      p,
      mentorProfiles[p.id],
      assinaturas[p.id],
      faltantes?.[p.id]?.["termo-voluntario"],
      acesso?.[p.id]
    );
  const statusMentorado = (m: Mentorado) =>
    statusDeMentorado(
      m,
      assinaturas[m.id],
      faltantes?.[m.id]?.[slugDocMentorado(m)],
      m.profile_id ? acesso?.[m.profile_id] : null
    );

  // opções das pills de turma (coord): turmas presentes na base, mais
  // novas primeiro e "Sem turma" por último; a contagem é de PESSOAS que
  // têm aquela turma — quem está em duas conta nas duas
  const turmasInfo = useMemo(() => {
    const contagem = new Map<string, number>();
    // o diretório não tem pills nem agrupamento por ciclo — os mapas já
    // chegam vazios e derrotar cedo poupa a varredura
    if (!souCoord) return { turmas: [] as string[], contagem, semTurma: 0 };
    let sem = 0;
    const conta = (alvo: { tipo: "profile" | "mentorado"; id: string }) => {
      const ts = turmasDePessoa(alvo, mapas);
      if (!ts.length) {
        sem++;
        return;
      }
      for (const t of new Set(ts.map((x) => x.turma)))
        contagem.set(t, (contagem.get(t) ?? 0) + 1);
    };
    for (const p of basePessoas) conta({ tipo: "profile", id: p.id });
    for (const m of mentorados) conta({ tipo: "mentorado", id: m.id });
    return {
      turmas: [...contagem.keys()].sort((a, b) =>
        b.localeCompare(a, "pt-BR", { numeric: true })
      ),
      contagem,
      semTurma: sem,
    };
  }, [souCoord, basePessoas, mentorados, mapas]);

  // valor efetivo dos recortes — um deep-link pode apontar pra turma que
  // não existe mais (ou "sempapel" no diretório): cai no neutro
  const catEf =
    cat === "todos" ||
    (GRUPO_ORDEM.includes(cat as Grupo) && (souCoord || cat !== "sempapel"))
      ? cat
      : "todos";
  const turmaSelEf =
    !souCoord || turmaSel == null
      ? null
      : turmaSel === SEM_TURMA
        ? turmasInfo.semTurma > 0
          ? SEM_TURMA
          : null
        : turmasInfo.turmas.includes(turmaSel)
          ? turmaSel
          : null;
  // filtros de gestão são coord-only — um deep-link com ?status= ou
  // ?trilha= não pode recortar o diretório em cima de dados que o papel
  // não recebe (os mapas chegam vazios da página)
  const statusSelEf = souCoord ? statusSel : "todos";
  const trilhaSelEf = souCoord ? trilhaSel : "todas";
  const soPendEf = souCoord && soPendencias;
  // "pendências primeiro" precisa dos mapas de gestão — no diretório
  // cairia numa régua vazia; vale o sort por nome
  const ordemEf: OrdemPessoas = souCoord ? ordem : "nome";

  // cada dimensão é um predicado — turma pela mesma derivação do
  // agrupamento por ciclo; categoria pelo grupo de papel; status no
  // vocabulário fechado (primário OU pendência secundária)
  const turmaOkPessoa = (p: Profile) => {
    if (turmaSelEf == null) return true;
    const ts = turmasDePessoa({ tipo: "profile", id: p.id }, mapas);
    return turmaSelEf === SEM_TURMA
      ? ts.length === 0
      : ts.some((t) => t.turma === turmaSelEf);
  };
  const turmaOkMentorado = (m: Mentorado) => {
    if (turmaSelEf == null) return true;
    const ts = turmasDePessoa({ tipo: "mentorado", id: m.id }, mapas);
    return turmaSelEf === SEM_TURMA
      ? ts.length === 0
      : ts.some((t) => t.turma === turmaSelEf);
  };
  const catOkPessoa = (p: Profile) =>
    catEf === "todos" || grupoDePessoa(p) === catEf;
  const catOkMentorado = catEf === "todos" || catEf === "mentorados";
  const statusOk = (s: StatusPessoas) =>
    statusSelEf === "todos" ||
    s.primario === statusSelEf ||
    s.secundarios.includes(statusSelEf);
  const statusOkPessoa = (p: Profile) => statusOk(statusProfile(p));
  const statusOkMentorado = (m: Mentorado) => statusOk(statusMentorado(m));
  // trilha é conceito de mentor (o papel define); o jovem entra pelo
  // vínculo — a trilha dele é a das duplas que já teve
  const trilhaOkPessoa = (p: Profile) =>
    trilhaSelEf === "todas" ||
    temPapel(
      p,
      trilhaSelEf === "dpp" ? "mentor_dpp" : "mentor_especialista"
    );
  const trilhaOkMentorado = (m: Mentorado) =>
    trilhaSelEf === "todas" ||
    mapas.duplas.some(
      (d) => d.mentorado_id === m.id && d.trilha === trilhaSelEf
    );
  // "somente com pendências" segue a régua do dot warn do Detalhes (termo,
  // formação do mentor, "ainda não entrou", documento do jovem) — inativo
  // e quem saiu do programa não têm pendência cobrável
  const pendOkPessoa = (p: Profile) => {
    if (!soPendEf) return true;
    if (!p.ativo) return false;
    const mp = mentorProfiles[p.id];
    const termoOk = termoOkProfile(p, mp, assinaturas[p.id]);
    return ehMentor(p)
      ? !termoOk || !mp?.formacao_ok
      : !termoOk || !p.user_id;
  };
  const pendOkMentorado = (m: Mentorado) =>
    !soPendEf ||
    (!foraDoPrograma(m) && !termoOkMentorado(m, assinaturas[m.id]));
  const filtrosPessoa = (p: Profile) =>
    turmaOkPessoa(p) &&
    catOkPessoa(p) &&
    statusOkPessoa(p) &&
    trilhaOkPessoa(p) &&
    pendOkPessoa(p);
  const filtrosMentorado = (m: Mentorado) =>
    catOkMentorado &&
    turmaOkMentorado(m) &&
    statusOkMentorado(m) &&
    trilhaOkMentorado(m) &&
    pendOkMentorado(m);

  // pra coordenação, cadastro desativado sai do grupo principal e vive na
  // seção "Inativos" no fim — visível, mas sem diluir a leitura de quem segue
  const inativas = useMemo(
    () => (souCoord ? pessoas.filter((p) => !p.ativo) : []),
    [souCoord, pessoas]
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

  // escopo (todos os filtros, sem a busca) — denominador honesto do
  // "N de M" e a base dos grupos; o arquivo continua colapsável no fim
  const pessoasEscopo = basePessoas.filter(
    (p) =>
      // no modo turma o inativo aparece no grupo com o chip "inativo"
      // (a filiação é histórica); no modo papel ele fica no arquivo
      (porTurma || p.ativo) && filtrosPessoa(p)
  );
  const mentoradosEscopo = !catOkMentorado
    ? []
    : mentorados.filter(
        // idem: quem saiu continua contando como membro histórico da
        // turma — a situação dela vira badge própria na linha
        (m) => (porTurma || !foraDoPrograma(m)) && filtrosMentorado(m)
      );

  // quem saiu se ordena pela saída mais recente — arquivo cronológico, não
  // fila de trabalho (pendência não se aplica a quem já partiu)
  const porSaidaRecente = (a: Mentorado, b: Mentorado) =>
    (b.saiu_em ?? "").localeCompare(a.saiu_em ?? "") ||
    comparaNome(a.nome, b.nome);
  const foraExibidos = mentorados
    .filter(
      (m) => filtrosMentorado(m) && foraDoPrograma(m) && qMentorado(m)
    )
    .sort(porSaidaRecente);
  const inativasExibidas = [
    ...inativas.filter((p) => filtrosPessoa(p) && qPessoa(p)),
  ].sort((a, b) => comparaNome(a.nome, b.nome));

  // "pendências primeiro" usa a mesma régua dos badges da linha (termo,
  // formação, não-entrou, sem dupla); dentro de cada grupo
  const pessoasExibidas = pessoasEscopo.filter(qPessoa).sort((a, b) =>
    ordemEf === "pendencias"
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
      ordemEf === "pendencias"
        ? pendenciasMentorado(b, !emDupla.has(b.id), assinaturas[b.id]) -
            pendenciasMentorado(a, !emDupla.has(a.id), assinaturas[a.id]) ||
          comparaNome(a.nome, b.nome)
        : comparaNome(a.nome, b.nome)
    );

  // ---------- agrupamento por turma ----------
  // cada pessoa aparece em TODA turma a que pertence — os papéis dentro
  // dela viram chips da linha. Sem evidência nenhuma → balde "Sem turma"
  // (pré-cadastros, equipe global, quem ainda não entrou em ciclo nenhum).
  // Sem useMemo manual: as fontes (pessoasExibidas etc.) já são derivadas
  // a cada render — o React Compiler memoiza o bloco inteiro sozinho
  const gruposTurma = ((): { turma: string; itens: ItemTurma[] }[] => {
    if (!porTurma) return [];
    const porT = new Map<string, ItemTurma[]>();
    const distribui = (
      item: ItemTurma,
      ts: { turma: string; papel: PapelTurma }[]
    ) => {
      if (!ts.length) {
        const arr =
          porT.get(SEM_TURMA) ?? porT.set(SEM_TURMA, []).get(SEM_TURMA)!;
        arr.push(item);
        return;
      }
      // uma linha por turma com TODOS os papéis dela nela (dedup por turma)
      const unica = new Map<string, PapelTurma[]>();
      for (const t of ts)
        unica.set(t.turma, [...(unica.get(t.turma) ?? []), t.papel]);
      for (const [turma, papeis] of unica) {
        const arr = porT.get(turma) ?? porT.set(turma, []).get(turma)!;
        arr.push({ ...item, papeis });
      }
    };
    for (const p of pessoasExibidas)
      distribui(
        { tipo: "profile", p, papeis: [] },
        turmasDePessoa({ tipo: "profile", id: p.id }, mapas)
      );
    for (const m of mentoradosExibidos)
      distribui(
        { tipo: "mentorado", m, papeis: [] },
        turmasDePessoa({ tipo: "mentorado", id: m.id }, mapas)
      );
    // turmas mais recentes primeiro (número/período desc), "Sem turma" por último
    const pendenciasItem = (i: ItemTurma) =>
      i.tipo === "profile"
        ? pendenciasPessoa(
            i.p,
            mentorProfiles[i.p.id],
            temVaga(i.p),
            assinaturas[i.p.id]
          )
        : pendenciasMentorado(i.m, !emDupla.has(i.m.id), assinaturas[i.m.id]);
    return [...porT.entries()]
      .sort(([a], [b]) =>
        a === SEM_TURMA
          ? 1
          : b === SEM_TURMA
            ? -1
            : b.localeCompare(a, "pt-BR", { numeric: true })
      )
      .map(([turma, itens]) => ({
        turma,
        itens: itens.sort((x, y) => {
          const nomeX = x.tipo === "profile" ? x.p.nome : x.m.nome;
          const nomeY = y.tipo === "profile" ? y.p.nome : y.m.nome;
          // dentro da turma: subseção por papel contextual (mentorados →
          // mentores → staff) e o mesmo sort nome|pendencias da lista
          return (
            rankNaTurma(x.papeis, x.tipo) - rankNaTurma(y.papeis, y.tipo) ||
            (ordemEf === "pendencias"
              ? pendenciasItem(y) - pendenciasItem(x)
              : 0) ||
            comparaNome(nomeX, nomeY)
          );
        }),
      }));
  })();

  // no agrupamento por turma a pill da barra escolhe a seção exibida
  const gruposTurmaVisiveis =
    turmaSelEf == null
      ? gruposTurma
      : gruposTurma.filter((g) => g.turma === turmaSelEf);

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
  const filtrando =
    Boolean(q) ||
    catEf !== "todos" ||
    turmaSelEf != null ||
    statusSelEf !== "todos" ||
    trilhaSelEf !== "todas" ||
    soPendEf;

  // selo do botão "Filtros": só os filtros de verdade — turma e busca já
  // são pills/campo próprios; agrupar e ordenar são controles de visão
  const ativosFiltro =
    (catEf !== "todos" ? 1 : 0) +
    (statusSelEf !== "todos" ? 1 : 0) +
    (trilhaSelEf !== "todas" ? 1 : 0) +
    (soPendEf ? 1 : 0);
  const draftAtivos =
    (draft.cat !== "todos" ? 1 : 0) +
    (draft.status !== "todos" ? 1 : 0) +
    (draft.trilha !== "todas" ? 1 : 0) +
    (draft.pendencias ? 1 : 0);

  const limparFiltros = () => {
    setBusca("");
    setCat("todos");
    setTurmaSel(null);
    setStatusSel("todos");
    setTrilhaSel("todas");
    setSoPendencias(false);
    setOrdem("nome");
  };

  const abrirFiltros = () => {
    setDraft({
      agrupar,
      cat: catEf,
      status: statusSel,
      trilha: trilhaSel,
      pendencias: soPendencias,
      ordem,
    });
    setFiltrosAberto(true);
  };
  const aplicarDraft = () => {
    setAgrupar(draft.agrupar);
    setCat(draft.cat);
    setStatusSel(draft.status);
    setTrilhaSel(draft.trilha);
    setSoPendencias(draft.pendencias);
    setOrdem(draft.ordem);
    setFiltrosAberto(false);
  };

  // re-key por busca/filtro/ordem — a troca re-roda o animate-enter das
  // linhas (convenção de movimento)
  const chaveFiltros = [
    q,
    catEf,
    turmaSelEf ?? "",
    statusSelEf,
    trilhaSelEf,
    soPendEf ? "1" : "0",
    ordemEf,
  ].join("|");

  // persistência dos recortes na URL (deep-link) — agrupar e ordenar
  // viajam também, como preferência de leitura
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (busca) sp.set("busca", busca);
    else sp.delete("busca");
    if (catEf !== "todos") sp.set("cat", catEf);
    else sp.delete("cat");
    if (turmaSelEf != null)
      sp.set("turma", turmaSelEf === SEM_TURMA ? "sem-turma" : turmaSelEf);
    else sp.delete("turma");
    if (statusSelEf !== "todos") sp.set("status", statusSelEf);
    else sp.delete("status");
    if (trilhaSelEf !== "todas") sp.set("trilha", trilhaSelEf);
    else sp.delete("trilha");
    if (soPendEf) sp.set("pendencias", "1");
    else sp.delete("pendencias");
    if (ordemEf !== "nome") sp.set("ordem", ordemEf);
    else sp.delete("ordem");
    if (souCoord && agrupar === "turma") sp.set("agrupar", "turma");
    else sp.delete("agrupar");
    const qs = sp.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname
    );
  }, [
    busca,
    catEf,
    turmaSelEf,
    statusSelEf,
    trilhaSelEf,
    soPendEf,
    ordemEf,
    agrupar,
    souCoord,
  ]);

  return (
    <>
      {/* barra de filtros (REALIZA-376): busca + pills de turma são os
          principais; categoria, status, trilha, pendências, ordenar e o
          agrupamento alternativo moram no modal — gramática de /registros
          e /duplas. Pro diretório (não-coord) a categoria segue em select
          simples — é o único recorte que eles têm */}
      <div className="space-y-2.5">
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
          {souCoord ? (
            <FiltrosButton ativos={ativosFiltro} onClick={abrirFiltros} />
          ) : (
            <Select
              value={catEf}
              onValueChange={(v) => setCat(v ?? "todos")}
              items={{
                todos: "Todos",
                ...Object.fromEntries(
                  GRUPO_ORDEM.filter((g) => g !== "sempapel").map((g) => [
                    g,
                    GRUPO_LABEL[g],
                  ])
                ),
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
                {GRUPO_ORDEM.filter((g) => g !== "sempapel").map((g) => (
                  <SelectItem key={g} value={g}>
                    {GRUPO_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {exibidos} de {totalSecao}{" "}
            {totalSecao === 1 ? "pessoa" : "pessoas"}
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
        {/* pills de turma — uma linha só, rola na horizontal quando passa
            da largura (o fade lateral do FilterChipRow marca o corte) */}
        {souCoord &&
          turmasInfo.turmas.length + (turmasInfo.semTurma > 0 ? 1 : 0) >
            1 && (
            <FilterChipRow
              role="group"
              aria-label="Filtrar por turma"
              className="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0"
            >
              <button
                type="button"
                aria-pressed={turmaSelEf == null}
                onClick={() => setTurmaSel(null)}
                className={filterChipCls(turmaSelEf == null)}
              >
                Todas
              </button>
              {turmasInfo.turmas.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={turmaSelEf === t}
                  onClick={() =>
                    setTurmaSel(turmaSelEf === t ? null : t)
                  }
                  className={filterChipCls(turmaSelEf === t)}
                  /* o chip mostra o nome longo; o rótulo cru segue no
                     title pra desambiguar ciclos homônimos */
                  title={t}
                >
                  {turmaLonga(t)}
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      turmaSelEf === t
                        ? "text-background/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {turmasInfo.contagem.get(t)}
                  </span>
                </button>
              ))}
              {(turmasInfo.semTurma > 0 || turmaSelEf === SEM_TURMA) && (
                <button
                  type="button"
                  aria-pressed={turmaSelEf === SEM_TURMA}
                  onClick={() =>
                    setTurmaSel(turmaSelEf === SEM_TURMA ? null : SEM_TURMA)
                  }
                  className={filterChipCls(turmaSelEf === SEM_TURMA)}
                >
                  Sem turma
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      turmaSelEf === SEM_TURMA
                        ? "text-background/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {turmasInfo.semTurma}
                  </span>
                </button>
              )}
            </FilterChipRow>
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

      {/* lista única agrupada — por cargo (REALIZA-376, padrão: leitura
          global por função) ou por turma (a pessoa aparece em cada turma
          dela, chips de papel contextual na linha). Grade 2 colunas no
          desktop, coluna única no mobile — "achar o perfil" é a tarefa */}
      <div className="space-y-5">
        {porTurma &&
          gruposTurmaVisiveis.map(({ turma, itens }) => (
            <section key={turma} className="space-y-2">
              <h2 className="text-sm font-semibold tabular-nums">
                {turma === SEM_TURMA
                  ? "Sem turma"
                  : turmaAno(turma)
                    ? `${turmaLonga(turma)} · ${turmaAno(turma)}`
                    : turmaLonga(turma)}{" "}
                <span className="font-normal text-muted-foreground">
                  ({itens.length})
                </span>
              </h2>
              <div
                key={`${chaveFiltros}|${turma}`}
                className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2"
              >
                {itens.map((item, i) =>
                  item.tipo === "profile" ? (
                    <PessoaRow
                      key={`${turma}:${item.p.id}`}
                      p={item.p}
                      indice={i}
                      temHistorico={temQualquerDupla.has(item.p.id)}
                      podeExcluir={
                        !item.p.user_id && !temQualquerDupla.has(item.p.id)
                      }
                      mentorProfile={mentorProfiles[item.p.id]}
                      usadas={{
                        dpp: contagemPorMentor[`${item.p.id}:dpp`] ?? 0,
                        especialista:
                          contagemPorMentor[`${item.p.id}:especialista`] ?? 0,
                      }}
                      docs={assinaturas[item.p.id]}
                      faltantesTermo={
                        faltantes?.[item.p.id]?.["termo-voluntario"] ?? []
                      }
                      status={statusProfile(item.p)}
                      papeisTurma={item.papeis}
                      souCoord={souCoord}
                    />
                  ) : (
                    <MentoradoRow
                      key={`${turma}:${item.m.id}`}
                      m={item.m}
                      indice={i}
                      emDupla={emDupla.has(item.m.id)}
                      temDupla={temQualquerDupla.has(item.m.id)}
                      duplaVivaId={duplaVivaPorMentorado[item.m.id] ?? null}
                      docs={assinaturas[item.m.id]}
                      faltantes={faltantes?.[item.m.id]}
                      status={statusMentorado(item.m)}
                      papeisTurma={item.papeis}
                      souCoord={souCoord}
                    />
                  )
                )}
              </div>
            </section>
          ))}
        {!porTurma &&
          grupos.map(({ g, pessoas: gp, mentorados: gm }) => (
          <section key={g} className="space-y-2">
            <h2 className="text-sm font-semibold tabular-nums">
              {GRUPO_LABEL[g]}{" "}
              <span className="font-normal text-muted-foreground">
                ({gp.length + gm.length})
              </span>
            </h2>
            <div
              key={`${chaveFiltros}|${g}`}
              // items-start: o Detalhes aberto cresce só o próprio card —
              // sem ele a linha do grid assume a altura do maior item e o
              // card vizinho estica vazio junto. grid-cols-1 explícito: sem
              // template abaixo de sm a coluna implícita dimensiona por
              // max-content (474px com bio longa) e alarga a página —
              // o FAB fixo ia parar fora da tela (mesma falha da agenda)
              className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2"
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
                  status={souCoord ? statusProfile(p) : undefined}
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
                  status={souCoord ? statusMentorado(m) : undefined}
                  souCoord={souCoord}
                />
              ))}
            </div>
          </section>
        ))}

        {(porTurma ? gruposTurmaVisiveis.length : grupos.length) === 0 && (
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
          busca força aberto pra o nome ainda ser encontrável. No modo
          turma quem saiu já aparece no grupo dela — o arquivo só faz
          sentido na leitura por papel */}
      {!porTurma && foraExibidos.length > 0 && (
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
            <div className="grid grid-cols-1 items-start gap-2 opacity-80 sm:grid-cols-2">
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
                  status={souCoord ? statusMentorado(m) : undefined}
                  souCoord={souCoord}
                />
              ))}
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      {/* idem pros cadastros desativados da equipe — mesma gramática do
          arquivo de saídas (só coord vê; pros demais nem chegam). Modo
          turma absorve os inativos nos grupos com chip próprio */}
      {!porTurma && souCoord && inativasExibidas.length > 0 && (
        <Collapsible.Root
          open={
            inativosAberto || Boolean(q) || statusSelEf === "inativo"
          }
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
            <div className="grid grid-cols-1 items-start gap-2 opacity-80 sm:grid-cols-2">
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
                  status={statusProfile(p)}
                  souCoord={souCoord}
                />
              ))}
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      {/* modal de filtros (REALIZA-376) — gramática de /registros e
          /duplas: fieldsets com rótulo OVERLINE, pílulas e checks, e um
          rascunho que aplica tudo de uma vez. Agrupar e Ordenar são
          controles de visão: não entram no selo de ativos e o "Limpar"
          os preserva */}
      <Dialog open={filtrosAberto} onOpenChange={setFiltrosAberto}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <fieldset>
              <legend className={OVERLINE}>Agrupar</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <OpcaoPilula
                  nome="flt-agrupar"
                  valor="papel"
                  atual={draft.agrupar}
                  onSelect={(v) =>
                    setDraft((d) => ({
                      ...d,
                      agrupar: v as "papel" | "turma",
                    }))
                  }
                >
                  Por cargo
                </OpcaoPilula>
                <OpcaoPilula
                  nome="flt-agrupar"
                  valor="turma"
                  atual={draft.agrupar}
                  onSelect={(v) =>
                    setDraft((d) => ({
                      ...d,
                      agrupar: v as "papel" | "turma",
                    }))
                  }
                >
                  Por turma
                </OpcaoPilula>
              </div>
            </fieldset>
            <fieldset>
              <legend className={OVERLINE}>Categoria</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <OpcaoPilula
                  nome="flt-cat"
                  valor="todos"
                  atual={draft.cat}
                  onSelect={(v) => setDraft((d) => ({ ...d, cat: v }))}
                >
                  Todos
                </OpcaoPilula>
                {GRUPO_ORDEM.filter((g) => souCoord || g !== "sempapel").map(
                  (g) => (
                    <OpcaoPilula
                      key={g}
                      nome="flt-cat"
                      valor={g}
                      atual={draft.cat}
                      onSelect={(v) => setDraft((d) => ({ ...d, cat: v }))}
                    >
                      {GRUPO_LABEL[g]}
                    </OpcaoPilula>
                  )
                )}
              </div>
            </fieldset>
            <fieldset>
              <legend className={OVERLINE}>Status</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <OpcaoPilula
                  nome="flt-status"
                  valor="todos"
                  atual={draft.status}
                  onSelect={(v) =>
                    setDraft((d) => ({
                      ...d,
                      status: v as StatusPessoa | "todos",
                    }))
                  }
                >
                  Todos
                </OpcaoPilula>
                {(
                  Object.entries(STATUS_PESSOA_LABEL) as [
                    StatusPessoa,
                    string,
                  ][]
                ).map(([v, l]) => (
                  <OpcaoPilula
                    key={v}
                    nome="flt-status"
                    valor={v}
                    atual={draft.status}
                    onSelect={(x) =>
                      setDraft((d) => ({
                        ...d,
                        status: x as StatusPessoa | "todos",
                      }))
                    }
                  >
                    {l}
                  </OpcaoPilula>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={OVERLINE}>Trilha</legend>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <OpcaoPilula
                  nome="flt-trilha"
                  valor="todas"
                  atual={draft.trilha}
                  onSelect={(v) =>
                    setDraft((d) => ({
                      ...d,
                      trilha: v as DraftFiltros["trilha"],
                    }))
                  }
                >
                  Todas
                </OpcaoPilula>
                <OpcaoPilula
                  nome="flt-trilha"
                  valor="dpp"
                  atual={draft.trilha}
                  onSelect={(v) =>
                    setDraft((d) => ({
                      ...d,
                      trilha: v as DraftFiltros["trilha"],
                    }))
                  }
                >
                  DPP
                </OpcaoPilula>
                <OpcaoPilula
                  nome="flt-trilha"
                  valor="especialista"
                  atual={draft.trilha}
                  onSelect={(v) =>
                    setDraft((d) => ({
                      ...d,
                      trilha: v as DraftFiltros["trilha"],
                    }))
                  }
                >
                  Especialista
                </OpcaoPilula>
              </div>
            </fieldset>
            <fieldset>
              <legend className={OVERLINE}>Pendências</legend>
              <div className="mt-1.5 -mx-1 space-y-0.5">
                <OpcaoCheck
                  marcado={draft.pendencias}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, pendencias: v }))
                  }
                >
                  Somente com pendências
                </OpcaoCheck>
              </div>
            </fieldset>
            <fieldset>
              <legend className={OVERLINE}>Ordenar</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(
                  Object.entries(ORDEM_PESSOAS_LABEL) as [
                    OrdemPessoas,
                    string,
                  ][]
                ).map(([v, l]) => (
                  <OpcaoPilula
                    key={v}
                    nome="flt-ordem"
                    valor={v}
                    atual={draft.ordem}
                    onSelect={(x) =>
                      setDraft((d) => ({ ...d, ordem: x as OrdemPessoas }))
                    }
                  >
                    {l}
                  </OpcaoPilula>
                ))}
              </div>
            </fieldset>
          </div>
          <DialogFooter sticky>
            <Button
              type="button"
              variant="ghost"
              className="sm:me-auto"
              disabled={draftAtivos === 0}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  cat: "todos",
                  status: "todos",
                  trilha: "todas",
                  pendencias: false,
                }))
              }
            >
              Limpar
            </Button>
            <Button type="button" onClick={aplicarDraft}>
              Aplicar{draftAtivos > 0 ? ` (${draftAtivos})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  status,
  papeisTurma,
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
  /** vocabulário de status do /pessoas (REALIZA-39) — substitui os badges
   *  soltos de antes ("inativa", "convite enviado", "termo pendente") */
  status?: StatusPessoas;
  /** papéis contextuais NA turma da seção — chips no modo turma */
  papeisTurma?: PapelTurma[];
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
  // trilha do mentor no meta do não-coord: dentro de "Mentores" um DPP e
  // um especialista seriam indistinguíveis sem ela (as seções separam por
  // papel, não por trilha) — vocabulário curto do papelCurto
  const trilha = mentor
    ? temPapel(p, "mentor_dpp") && temPapel(p, "mentor_especialista")
      ? "DPP + especialista"
      : temPapel(p, "mentor_dpp")
        ? "DPP"
        : "Especialista"
    : null;
  // anel do avatar por papel: híbrido conta como mentor (lima), equipe =
  // cinza neutro, sem papel fica sem anel — mesmo mapa do Badge de papel
  const papelAvatar =
    temPapel(p, "mentor_dpp") || temPapel(p, "mentor_especialista")
      ? ("mentor" as const)
      : p.role === "mentorado"
        ? ("mentorado" as const)
        : p.role
          ? ("equipe" as const)
          : undefined;
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
          prefetch={false}
          aria-label={`Abrir perfil de ${p.nome_social ?? p.nome}`}
          className="group -my-1 flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar
            nome={p.nome_social ?? p.nome}
            src={p.avatar_path ? avatarPublicUrl(p.avatar_path) : null}
            papel={papelAvatar}
            size={40}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium underline-offset-4 transition-colors group-hover:underline">
              {p.nome_social ?? p.nome}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {/* badge de papel saiu da linha: os grupos já separam por
                  papel e o meta carrega a trilha ("DPP 1/2 · Esp 0/1") —
                  o espaço vai pro contexto/bio da pessoa */}
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
                  [trilha, subtitulo].filter(Boolean).join(" · ") || "\u00A0"
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
        {/* papéis contextuais da turma (modo turma): o que a pessoa faz
            NAQUELE ciclo — mentor DPP, especialista, auxiliar, aguardando */}
        {papeisTurma?.map((pp) => (
          <Badge
            key={pp}
            variant="outline"
            className="text-xs shrink-0 bg-muted/60"
          >
            {PAPEL_TURMA_LABEL[pp]}
          </Badge>
        ))}
        {/* status operacional (REALIZA-39): primário + pendências
            secundárias no vocabulário fechado — substitui os badges
            soltos de antes. "não convidado" fica como dica de ação: quem
            nem conta tem não cabe no vocabulário (cai em "ativo" com as
            pendências dela) mas é o alvo natural do convite em lote */}
        {status && <StatusChips status={status} />}
        {souCoord && status && p.ativo && !p.user_id && !p.onboarded_em && (
          <Badge variant="outline" className="text-xs shrink-0">
            não convidado
          </Badge>
        )}
        {/* sem status (diretório não-coord): sem badge de papel à direita
            — a seção já nomeia o grupo e o subtítulo vale mais */}
        {!status && souCoord && !p.ativo && !emInativos && (
          <Badge variant="outline" className="text-xs shrink-0 border-[var(--danger)]/50 text-[var(--danger)]">
            inativa
          </Badge>
        )}
        {!status && souCoord && p.ativo && !p.onboarded_em && (
          <Badge variant="outline" className="text-xs shrink-0">
            {p.user_id ? "convite enviado" : "não convidado"}
          </Badge>
        )}
        {!status && souCoord && p.ativo && !termoOk && (
          <Badge
            variant="outline"
            className="text-xs shrink-0 border-[var(--warn)]/60 text-[var(--warn-text)]"
          >
            termo pendente
          </Badge>
        )}
        {/* capacidade X/Y e e-mail saíram da linha — ocupação vai no meta,
            contato e pendências em "Detalhes" (rodada out/2026) */}
        {/* a troca de papel mora no ⋮ ("Alterar papel" — ação rara, não é
            do dia a dia): a linha fica só com o ⋮ no cluster e o espaço do
            select vira respiro pro meta. Detalhes + ⋮ num cluster só pra
            quebrarem juntos — badge extra empurrava o ⋮ órfão pra linha 2 */}
        {souCoord && (
          <div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            <DetalhesTrigger temPendencia={temPendencia} />
            <PessoaActions
              pessoa={p}
              // mesma guarda do server: qualquer dupla (até encerrada) bloqueia excluir
              podeExcluir={podeExcluir}
            />
          </div>
        )}
      </div>
      {souCoord && mentor && (
        <DetalhesRegiao id={detalhesId} nome={p.nome_social ?? p.nome}>
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
                  nome={p.nome_social ?? p.nome}
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
                          nome={p.nome_social ?? p.nome}
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
        <DetalhesRegiao id={detalhesId} nome={p.nome_social ?? p.nome}>
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
          {p.ativo && !p.onboarded_em && (
            <ItemDetalhe icone={UserPlus}>
              {p.user_id
                ? "Convite enviado, aguardando o primeiro acesso"
                : "Ainda não entrou na plataforma"}
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
  status,
  papeisTurma,
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
  /** vocabulário de status do /pessoas (REALIZA-39) — fora do programa
   *  segue com a badge de situação (mais informativa que "inativo") */
  status?: StatusPessoas;
  /** papéis contextuais NA turma da seção — chips no modo turma */
  papeisTurma?: PapelTurma[];
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
          prefetch={false}
          aria-label={`Abrir perfil de ${m.nome_social ?? m.nome}`}
          className="group -my-1 flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar
            nome={m.nome_social ?? m.nome}
            src={m.avatar_path ? avatarPublicUrl(m.avatar_path) : null}
            papel="mentorado"
            size={40}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <span
                className={cn(
                  "truncate underline-offset-4 transition-colors group-hover:underline",
                  fora && "text-muted-foreground"
                )}
              >
                {m.nome_social ?? m.nome}
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
        {/* papéis contextuais da turma — "Mentorado(a)" / "Aguardando par"
            por evidência (dupla, inscrição), não pelo cadastro */}
        {papeisTurma?.map((pp) => (
          <Badge
            key={pp}
            variant="outline"
            className="text-xs shrink-0 bg-muted/60"
          >
            {PAPEL_TURMA_LABEL[pp]}
          </Badge>
        ))}
        {/* status operacional (REALIZA-39): docs/vínculo/acesso no
            vocabulário fechado — quem saiu segue com a badge de situação
            acima (Desistente/Concluiu informam mais que "inativo"). "não
            convidado" fica como dica de ação junto aos chips */}
        {status && !fora && <StatusChips status={status} />}
        {souCoord && status && !fora && !m.profile_id && m.email && (
          <Badge variant="outline" className="text-xs shrink-0">
            não convidado
          </Badge>
        )}
        {/* fallback sem o mapa de status (defensivo — hoje toda linha
            coord passa status): mantém os badges antigos */}
        {!status && souCoord && !fora && !docOk && (
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
        {!status && souCoord && !fora && (m.email || m.profile_id) && (
          <Badge variant="outline" className="text-xs shrink-0">
            {m.profile_id
              ? m.conta?.onboarded_em
                ? "conta vinculada"
                : "convite enviado"
              : "não convidado"}
          </Badge>
        )}
        {/* Detalhes + ⋮ no mesmo cluster — quebram juntos pra linha 2, sem
            ⋮ órfão quando o badge de termo empurra a linha */}
        {souCoord && (
          <div className="flex items-center gap-2 ml-auto">
            {temDocs && <DetalhesTrigger temPendencia={temPendencia} />}
            <MentoradoActions
              mentorado={m}
              temDupla={temDupla}
              duplaVivaId={duplaVivaId}
            />
          </div>
        )}
      </div>
      {souCoord && temDocs && (
        <DetalhesRegiao id={detalhesId} nome={m.nome_social ?? m.nome}>
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
