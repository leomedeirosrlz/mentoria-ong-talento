import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  ArrowUpRight,
  Briefcase,
  Buildings,
  Cake,
  CaretRight,
  Certificate,
  CheckCircle,
  CircleHalf,
  Clock,
  EnvelopeSimple,
  GenderIntersex,
  GraduationCap,
  HandHeart,
  Heart,
  IdentificationCard,
  LinkedinLogo,
  LockSimple,
  MapPin,
  Path,
  ShieldCheck,
  Signpost,
  Sparkle,
  Target,
  Users,
  Warning,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { getDocumentosPessoa, getMe, getPessoaPerfil } from "@/lib/queries";
import { getAnamneseMentorado } from "@/lib/forms/queries";
import { getSupervisoesDaPessoa } from "@/lib/queries-supervisao";
import { getResumoFormacao } from "@/lib/queries-presenca";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";
import {
  COR_RACA_LABELS,
  disponibilidadeTexto,
  ESCOLARIDADE_LABELS,
  formatDate,
  GENERO_LABELS,
  idade,
  linkSeguro,
  papelLabel,
  PREF_GENERO_LABELS,
  waLink,
} from "@/lib/ciclo";
import type { DadosCivis } from "@/lib/types";
import { AnamneseMentoradoChip } from "@/components/anamnese-mentorado";
import { DocumentosPessoa } from "@/components/documentos-pessoa";
import { AssinaturasPessoa } from "@/components/assinaturas-pessoa";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { MentoradoActions } from "@/components/mentorado-actions";
import { PessoaActions } from "@/components/pessoa-actions";
import { PessoaBanner } from "@/components/pessoa-banner";
import { PessoaMural, type MuralNota } from "@/components/pessoa-mural";
import { SupervisoesSection } from "@/components/supervisoes-section";
import { VoltarLink } from "@/components/voltar-link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const perfil = await getPessoaPerfil(id);
  return { title: perfil ? perfil.pessoa.nome : "Pessoa" };
}

const STATUS_DUPLA: Record<string, string> = {
  ativa: "ativa",
  pausada: "pausada",
  concluida: "concluída",
  encerrada: "encerrada",
};

/** Campo da ficha — ícone de escaneio + rótulo uppercase pequeno sobre o
 *  valor: leitura de perfil, não de resposta de formulário. Some quando o
 *  valor é vazio, exceto pra coordenação (`sempre` → "Não informado"
 *  distingue "não preenchido" de "sem permissão": pros demais os sensíveis
 *  nem chegam — vêm null do grant). O ícone é opcional: blocos documentais
 *  (dados civis) não o usam. */
function Linha({
  icone,
  rotulo,
  valor,
  sempre,
  className,
}: {
  icone?: React.ReactNode;
  rotulo: string;
  valor: string | null | undefined;
  sempre?: boolean;
  className?: string;
}) {
  if (!valor && !sempre) return null;
  return (
    <div className={cn("flex items-start gap-2.5 py-3", className)}>
      {icone && (
        <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground/70">
          {icone}
        </span>
      )}
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {rotulo}
        </dt>
        <dd className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
          {valor || <span className="text-muted-foreground">Não informado</span>}
        </dd>
      </div>
    </div>
  );
}

/** Título de subseção do cadastro — foreground + xs: um degrau real acima
 *  dos rótulos de campo (11px muted), abaixo do h2 do card. */
function SubFicha({ titulo }: { titulo: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/85">
      {titulo}
    </h3>
  );
}

/** Chips de informação secundária (áreas, interesses) — fundo neutro claro,
 *  sem o peso do badge secondary. */
function Chips({ itens }: { itens: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {itens.map((i) => (
        <Badge key={i} variant="outline" className="bg-muted font-normal">
          {i}
        </Badge>
      ))}
    </div>
  );
}

/** Stat do resumo de mentoria — valor com estado: "ok" verde com check,
 *  "pendente" amber com Warning (o que pede ação da coordenação). */
function Stat({
  rotulo,
  valor,
  estado = "neutro",
  acao,
}: {
  rotulo: string;
  valor: string;
  estado?: "ok" | "pendente" | "neutro";
  acao?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          "mt-0.5 flex items-center gap-1.5 text-sm font-semibold",
          estado === "ok" && "text-[var(--ok-text)]",
          estado === "pendente" && "text-[var(--warn-text)]"
        )}
      >
        {estado === "ok" && (
          <CheckCircle size={14} weight="fill" aria-hidden className="shrink-0" />
        )}
        {estado === "pendente" && (
          <Warning size={14} weight="fill" aria-hidden className="shrink-0" />
        )}
        <span className="min-w-0">{valor}</span>
      </dd>
      {acao}
    </div>
  );
}

/** Endereço em linha única — "Rua X, 12 · ap 71 · Bairro · Cidade/UF · CEP". */
function enderecoTxt(e: DadosCivis["endereco"] | null | undefined): string | null {
  if (!e) return null;
  const partes = [
    [e.logradouro, e.numero].filter(Boolean).join(", ") || null,
    e.complemento,
    e.bairro,
    [e.cidade, e.uf].filter(Boolean).join("/") || null,
    e.cep ? `CEP ${e.cep}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

export default async function PessoaPerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [perfil, me] = await Promise.all([getPessoaPerfil(id), getMe()]);
  if (!perfil || !me) notFound();

  // o próprio cadastro cai no /perfil (lá se edita). A ficha de colega é
  // interna mas aberta — o que cada papel enxerga nela é decidido seção a
  // seção abaixo, espelhando os grants do banco (sensíveis só chegam
  // preenchidos pra coordenação, contato só pra quem tem vínculo)
  const ehMentor = me.role === "mentor_dpp" || me.role === "mentor_especialista";
  const ehStaff = me.role === "coordenacao" || me.role === "supervisor";
  if (perfil.tipo === "profile" && perfil.pessoa.id === me.id) redirect("/perfil");
  // mentorado fora de vínculo: o RLS já barrou quem não alcança (query voltou null)

  // sessões de supervisão (0041): conduzidas (ficha de supervisor) ou
  // recebidas (ficha de mentor). A RLS escopa o que cada papel lê — mentorado
  // e coordenação não têm sessões, a query nem roda pra eles
  const papelPessoa = perfil.tipo === "profile" ? perfil.pessoa.role : null;
  const supervisoes =
    papelPessoa === "supervisor" ||
    papelPessoa === "mentor_dpp" ||
    papelPessoa === "mentor_especialista"
      ? await getSupervisoesDaPessoa(id)
      : [];

  const p = perfil.pessoa;
  const souCoord = me.role === "coordenacao";
  // escreve no mural: staff sempre; mentor só no mural do mentorado da
  // própria dupla — duplas já vem filtrada pelo RLS, então basta o vínculo
  const podeAnotar =
    ehStaff || (ehMentor && perfil.tipo === "mentorado" && perfil.duplas.some((d) => d.mentor?.id === me.id));

  const ehMentorado = perfil.tipo === "mentorado";
  const avatarSrc = p.avatar_path ? avatarPublicUrl(p.avatar_path) : null;
  const gravatar = !ehMentorado && "email" in p && p.email ? gravatarUrl(p.email) : null;
  const wa = p.whatsapp ? waLink(p.whatsapp, "") : null;

  // apresentação profissional (0030) — só profiles têm; o card some quando
  // nada foi preenchido (perfil vazio não é um estado a exibir)
  const perfilPro =
    perfil.tipo === "profile"
      ? {
          bio: perfil.pessoa.bio,
          linkedin: linkSeguro(perfil.pessoa.linkedin),
          areas: perfil.pessoa.areas ?? [],
          voluntariado: perfil.pessoa.voluntariado,
        }
      : null;
  const temPerfilPro = !!perfilPro && Boolean(
    perfilPro.bio || perfilPro.linkedin || perfilPro.areas.length || perfilPro.voluntariado
  );

  // ---------- ficha de cadastro/matching (0034) ----------
  // Públicas (grant de coluna) preenchem pra quem alcança a página; os 4
  // sensíveis só vêm preenchidos pra coordenação (view *_pessoal) — pros
  // demais chegam null e a linha some. Pra coord a linha diz "Não
  // informado" pra distinguir "não preenchido" de "sem permissão".
  const local = [p.cidade, p.uf].filter(Boolean).join(" · ") || null;
  const anos = idade(p.data_nascimento);
  const nascimentoTxt = p.data_nascimento
    ? `${formatDate(p.data_nascimento)}${anos != null ? ` (${anos} anos)` : ""}`
    : null;
  const interesses = p.interesses ?? [];
  // refs já estreitadas por tipo — cargo/empresa só existem em profile,
  // escolaridade/objetivos só em mentorado
  const prof = perfil.tipo === "profile" ? perfil.pessoa : null;
  const ment = perfil.tipo === "mentorado" ? perfil.pessoa : null;
  const mp = perfil.tipo === "profile" ? perfil.mentorProfile : null;
  const cargoEmpresa =
    prof && [prof.cargo, prof.empresa].filter(Boolean).join(" · ") || null;
  // supervisor só lê presença de mentor que supervisiona (RLS via duplas,
  // 0040) — fora desse escopo a linha mostraria um "0 de 2" falso; coordenação
  // vê sempre. perfil.duplas já vem escopado pelo RLS, então basta o vínculo
  const podeVerFormacao =
    souCoord || perfil.duplas.some((d) => d.mentor?.id === p.id);
  // presença nos encontros de formação do ciclo — derivado de presencas;
  // complementa o checklist: formacao_ok segue valendo (pode ser exceção manual)
  const resumoFormacao =
    mp && podeVerFormacao ? await getResumoFormacao(p.id) : null;
  const dispTxt = disponibilidadeTexto(mp?.disponibilidade);
  const dispMentoradoTxt = disponibilidadeTexto(ment?.disponibilidade);
  // anamnese oficial do mentorado (0042) — escopo coord; null quando a
  // migração ainda não rodou, então a página segue igual antes dela
  const anamnese =
    ehMentorado && souCoord ? await getAnamneseMentorado(p.id) : null;
  // documentos do intake (0054) — coord-only; pra outro papel a query
  // nem dispara
  const documentos = souCoord
    ? await getDocumentosPessoa(perfil.tipo, p.id)
    : [];
  // dados civis + responsável (0046) — chegam null fora da coordenação
  // (view *_pessoal); renderizam fechados num Collapsible no fim do Cadastro
  const civis = p.dados_civis ?? null;
  const resp = ment?.responsavel ?? null;
  const anamneseRef = ehMentorado && "notas" in p ? p.notas : null;
  const temFicha = Boolean(
    p.nome_social || local || interesses.length || p.origem ||
    nascimentoTxt || p.genero || p.cor_raca || p.motivacao || p.pref_genero_par ||
    (prof && (prof.cargo || prof.empresa || mp)) ||
    (ment && (ment.escolaridade || ment.objetivos || dispMentoradoTxt)) ||
    anamneseRef
  );
  // grupos do cadastro — o cabeçalho da subseção só aparece quando há pelo
  // menos um campo visível dentro dele (pra coord `sempre` garante isso)
  const temPessoal = Boolean(
    p.nome_social || nascimentoTxt || p.genero || p.cor_raca || local ||
    (ment && ment.escolaridade)
  );
  const temProf = Boolean(prof && (prof.cargo || prof.empresa));
  const lgpdVisivel = Boolean(
    prof && ehStaff && (prof.consent_lgpd_em != null || souCoord)
  );
  const temPrograma = Boolean(
    p.origem || p.motivacao || p.pref_genero_par ||
    (ment && (ment.objetivos || dispMentoradoTxt)) ||
    lgpdVisivel ||
    (interesses.length > 0 && !temPerfilPro)
  );

  // banner generativo — campo = papel; a linha de dados leva até 3 áreas de
  // atuação PROFISSIONAIS (profile.areas → mentor_profile.areas). Mentor sem
  // áreas fica só com cidade·uf — interesses são hobbies, só entram no
  // banner do mentorado (que não tem área profissional)
  const areasBanner = ehMentorado
    ? interesses
    : (prof?.areas?.length ? prof.areas : (mp?.areas ?? []));

  // presença nos encontros de formação do ciclo vs. checklist — os dois
  // sinais num stat só ("formação" aparece uma vez, consolidada)
  const formacaoTxt = !resumoFormacao
    ? "—"
    : resumoFormacao.total === 0
      ? mp?.formacao_ok
        ? "Concluída"
        : "Pendente"
      : `${resumoFormacao.presentes} de ${resumoFormacao.total} ${
          resumoFormacao.total === 1 ? "encontro" : "encontros"
        }`;
  const formacaoPendente =
    !mp?.formacao_ok ||
    (resumoFormacao != null &&
      resumoFormacao.total > 0 &&
      resumoFormacao.presentes < resumoFormacao.total);

  // RLS devolve só as minhas notas — o feed não precisa de autor
  const notas: MuralNota[] = perfil.notas.map((n) => ({
    id: n.id,
    texto: n.texto,
    created_at: n.created_at,
  }));
  // o rail de 340px só existe quando tem conteúdo — na ficha de colega
  // (sem duplas visíveis, documentos nem notas) ele ficaria um vão morto
  const temRail =
    souCoord || perfil.duplas.length > 0 || podeAnotar || notas.length > 0;

  return (
    <div className="space-y-4">
      {/* todos os papéis têm a aba /pessoas — voltar pra lá; perfil sem
          papel (acesso pendente) cai na home */}
      <VoltarLink fallback={me.role ? "/pessoas" : "/"} />

      {/* capa estilo rede social — banner generativo diz papel + cidade +
          áreas antes de qualquer leitura; avatar sobreposto, nome como h1,
          meta e chips de contato (gesto do /perfil, sem modo edição aqui:
          é a ficha de outra pessoa) */}
      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <PessoaBanner
          papel={ehMentorado ? "mentorado" : (prof?.role ?? null)}
          nome={p.nome}
          cidade={p.cidade}
          uf={p.uf}
          areas={areasBanner}
          seed={p.id}
        />
        <div className="px-4 pb-4 sm:px-6 sm:pb-5">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            {/* size-20!/sm:size-24! sobem por cima do style inline que o
                Avatar fixa via prop (a prop segue ditando o fontSize).
                relative z-10 é obrigatório: sem posição própria o span do
                Avatar pinta na camada in-flow e o banner (div relative)
                cobre a metade que deveria sobrepor a capa */}
            <Avatar
              nome={p.nome}
              src={avatarSrc}
              fallbackSrc={gravatar}
              papel={ehMentorado ? "mentorado" : undefined}
              size={80}
              className="relative z-10 size-20! -mt-10 ring-4 ring-card outline outline-1 outline-[var(--brand-ink)]/15 sm:size-24! sm:-mt-12"
            />
            {/* contato + ações — chips secundários; edição mora no ⋮ */}
            <div className="flex flex-wrap items-center gap-1.5">
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-[var(--brand-lime)]/60 hover:bg-[var(--brand-lime)]/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <WhatsappLogo size={14} aria-hidden />
                  WhatsApp
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
              {"email" in p && p.email && (
                <a
                  href={`mailto:${p.email}`}
                  className="inline-flex min-h-9 max-w-56 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <EnvelopeSimple size={14} aria-hidden className="shrink-0" />
                  <span className="truncate">{p.email}</span>
                </a>
              )}
              {souCoord &&
                (perfil.tipo === "profile" ? (
                  <PessoaActions
                    pessoa={perfil.pessoa}
                    podeExcluir={!perfil.pessoa.user_id && perfil.duplas.length === 0}
                  />
                ) : (
                  <MentoradoActions
                    mentorado={perfil.pessoa}
                    temDupla={perfil.duplas.length > 0}
                  />
                ))}
            </div>
          </div>
          <h1 className="mt-2.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {p.nome}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
            {ehMentorado ? (
              <>
                <Badge variant="outline" className="gap-1.5 font-normal">
                  <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
                  Mentorado
                </Badge>
                {"ong_origem" in p && p.ong_origem && <span>{p.ong_origem}</span>}
              </>
            ) : (
              <>
                <Badge variant="outline" className="font-normal">
                  {papelLabel("role" in p ? p.role : null)}
                </Badge>
                {/* estado operacional do cadastro é coisa de staff — colega
                    não precisa saber se a conta está ativa */}
                {ehStaff && "ativo" in p && !p.ativo && (
                  <Badge variant="outline" className="border-[var(--danger)]/50 text-[var(--danger)]">
                    inativa
                  </Badge>
                )}
                {ehStaff && "user_id" in p && !p.user_id && p.ativo && (
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    Nunca acessou a plataforma
                  </Badge>
                )}
              </>
            )}
            {/* grupos de meta numa linha só, separados por · — sem o
                separador dois spans colados liam como uma frase só */}
            {(cargoEmpresa || local) && (
              <span>{[cargoEmpresa, local].filter(Boolean).join(" · ")}</span>
            )}
          </div>
        </div>
      </header>

      {/* resumo da mentoria — faixa leve logo abaixo do header: o estado
          operacional do mentor pra quem opera o programa (capacidade,
          formação consolidada num stat só, termo, disponibilidade);
          experiência e formação externa vão como linhas secundárias */}
      {mp && ehStaff && (
        <section className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {mp.tipo === "dpp" ? "Mentoria DPP" : "Mentoria especialista"}
          </h2>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-4">
            <Stat
              rotulo="Capacidade"
              valor={`${mp.capacidade} ${mp.capacidade === 1 ? "dupla" : "duplas"}`}
            />
            <Stat
              rotulo="Formação inicial"
              valor={formacaoTxt}
              estado={formacaoPendente ? "pendente" : "neutro"}
            />
            <Stat
              rotulo="Termo"
              valor={mp.termo_ok ? "Assinado" : "Pendente"}
              estado={mp.termo_ok ? "ok" : "pendente"}
              acao={
                souCoord && !mp.termo_ok ? (
                  <a
                    href="#assinaturas"
                    className="mt-0.5 inline-block text-xs font-normal text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    ver assinaturas
                  </a>
                ) : undefined
              }
            />
            <Stat rotulo="Disponibilidade" valor={dispTxt ?? "—"} />
          </dl>
          {(souCoord || mp.experiencia_previa || mp.formacao_externa) && (
            <dl className="mt-1 border-t border-border/60 text-[13px] sm:grid sm:grid-cols-2 sm:gap-x-8">
              <Linha
                icone={<Path size={15} />}
                rotulo="Experiência"
                valor={mp.experiencia_previa}
                sempre={souCoord}
              />
              <Linha
                icone={<Certificate size={15} />}
                rotulo="Formação externa"
                valor={mp.formacao_externa}
                sempre={souCoord}
              />
            </dl>
          )}
        </section>
      )}

      {/* minmax(0,1fr) + min-w-0 nos filhos: sem eles o min-content das
          seções subia pelo grid e estourava a página. items-start impede os
          cards de esticar até a altura do vizinho. No mobile a coluna
          principal vem primeiro no DOM (cadastro é o conteúdo primário);
          no lg o rail estreito cai à direita por ser o segundo filho —
          e só existe quando tem conteúdo (ficha de colega fica em coluna
          única, sem a faixa vazia de 340px) */}
      <div
        className={cn(
          "grid items-start gap-4",
          temRail && "lg:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        <div className="min-w-0 space-y-4">
          {/* vitrine profissional (0030) vira o "Sobre" — bio, LinkedIn,
              áreas, voluntariado e interesses logo abaixo do resumo, como
              nas redes */}
          {perfilPro && temPerfilPro && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)] sm:p-5">
              <h2 className="text-sm font-semibold">Sobre</h2>
              {perfilPro.bio && (
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {perfilPro.bio}
                </p>
              )}
              {perfilPro.linkedin && (
                <a
                  href={perfilPro.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LinkedinLogo size={14} aria-hidden />
                  LinkedIn
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
              {perfilPro.areas.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Áreas de atuação</p>
                  <div className="mt-1.5">
                    <Chips itens={perfilPro.areas} />
                  </div>
                </div>
              )}
              {perfilPro.voluntariado && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <HandHeart size={13} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">Voluntariado:</span>{" "}
                    {perfilPro.voluntariado}
                  </span>
                </p>
              )}
              {interesses.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Interesses</p>
                  <div className="mt-1.5">
                    <Chips itens={interesses} />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* cadastro/matching (0034) — os sensíveis (nascimento, gênero,
              motivação, pref. de par) só chegam preenchidos pra coordenação
              via view; `sempre` deixa o "Não informado" explícito pra ela.
              Subseções com título miúdo + um ícone por campo: leitura de
              perfil (escaneável), não resposta de formulário */}
          {(temFicha || souCoord) && (
            <section className="rounded-xl bg-card p-5 text-sm shadow-[var(--shadow-border)] sm:p-6">
              <h2 className="text-sm font-semibold">Cadastro</h2>
              {temFicha ? (
                <>
                  {(temPessoal || souCoord) && (
                    <div className="mt-4">
                      <SubFicha titulo="Pessoal" />
                      <dl className="mt-1 sm:grid sm:grid-cols-2 sm:gap-x-8">
                        <Linha
                          icone={<IdentificationCard size={15} />}
                          rotulo="Nome social"
                          valor={p.nome_social}
                          sempre={souCoord}
                        />
                        <Linha
                          icone={<Cake size={15} />}
                          rotulo="Nascimento"
                          valor={nascimentoTxt}
                          sempre={souCoord}
                        />
                        <Linha
                          icone={<GenderIntersex size={15} />}
                          rotulo="Gênero"
                          valor={p.genero ? GENERO_LABELS[p.genero] : null}
                          sempre={souCoord}
                        />
                        <Linha
                          icone={<CircleHalf size={15} />}
                          rotulo="Cor/raça"
                          valor={p.cor_raca ? COR_RACA_LABELS[p.cor_raca] : null}
                          sempre={souCoord}
                        />
                        <Linha
                          icone={<MapPin size={15} />}
                          rotulo="Cidade/UF"
                          valor={local}
                          sempre={souCoord}
                        />
                        {ment && (
                          <Linha
                            icone={<GraduationCap size={15} />}
                            rotulo="Escolaridade"
                            valor={ment.escolaridade ? ESCOLARIDADE_LABELS[ment.escolaridade] : null}
                            sempre={souCoord}
                          />
                        )}
                      </dl>
                      {anos != null && anos < 18 && (
                        <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                          Menor de idade: a autorização do responsável precisa
                          estar assinada.
                          {souCoord && " Confira Documentos e assinaturas no painel lateral."}
                        </p>
                      )}
                    </div>
                  )}

                  {temProf && prof && (
                    <div className="mt-5 border-t border-border/60 pt-5">
                      <SubFicha titulo="Profissional" />
                      <dl className="mt-1 sm:grid sm:grid-cols-2 sm:gap-x-8">
                        <Linha
                          icone={<Briefcase size={15} />}
                          rotulo="Cargo"
                          valor={prof.cargo}
                        />
                        <Linha
                          icone={<Buildings size={15} />}
                          rotulo="Empresa"
                          valor={prof.empresa}
                        />
                      </dl>
                    </div>
                  )}

                  {(temPrograma || souCoord) && (
                    <div className="mt-5 border-t border-border/60 pt-5">
                      <SubFicha titulo="No programa" />
                      <dl className="mt-1 sm:grid sm:grid-cols-2 sm:gap-x-8">
                        <Linha
                          icone={<Signpost size={15} />}
                          rotulo="Origem"
                          valor={p.origem}
                          sempre={souCoord}
                        />
                        {ment && (
                          <Linha
                            icone={<Target size={15} />}
                            rotulo="Objetivos"
                            valor={ment.objetivos}
                            sempre={souCoord}
                            className="sm:col-span-2"
                          />
                        )}
                        {ment && (
                          <Linha
                            icone={<Clock size={15} />}
                            rotulo="Disponível"
                            valor={dispMentoradoTxt}
                            sempre={souCoord}
                          />
                        )}
                        <Linha
                          icone={<Heart size={15} />}
                          rotulo="Motivação"
                          valor={p.motivacao}
                          sempre={souCoord}
                          className="sm:col-span-2"
                        />
                        <Linha
                          icone={<Users size={15} />}
                          rotulo="Pref. de par"
                          valor={p.pref_genero_par ? PREF_GENERO_LABELS[p.pref_genero_par] : null}
                          sempre={souCoord}
                        />
                        {/* consent_lgpd_em só existe em profiles — mentorado é
                            coberto pela autorização do responsável. Trilha de
                            compliance, não perfil: fora da visão de colega */}
                        {prof && lgpdVisivel && (
                          <Linha
                            icone={<ShieldCheck size={15} />}
                            rotulo="LGPD"
                            valor={
                              prof.consent_lgpd_em
                                ? `Consentimento em ${formatDate(prof.consent_lgpd_em)}`
                                : "Sem consentimento registrado"
                            }
                            sempre={souCoord}
                          />
                        )}
                        {/* interesses ficam no Cadastro só quando não há card
                            Sobre (mentorado e profiles sem apresentação) */}
                        {interesses.length > 0 && !temPerfilPro && (
                          <div className="flex items-start gap-2.5 py-3 sm:col-span-2">
                            <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground/70">
                              <Sparkle size={15} />
                            </span>
                            <div className="min-w-0">
                              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                Interesses
                              </dt>
                              <dd className="mt-1.5">
                                <Chips itens={interesses} />
                              </dd>
                            </div>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* referência da anamnese (campo notas do intake) —
                      contexto da jornada, mora como subseção do cadastro */}
                  {anamneseRef && (
                    <div className="mt-5 border-t border-border/60 pt-5">
                      <SubFicha titulo="Referência da anamnese" />
                      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                        {anamneseRef}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  Nada preenchido ainda. Edite o cadastro ou peça pra pessoa completar o perfil.
                </p>
              )}

              {/* dados civis (0046) — coord-only, fechados por padrão: o que
                  o termo de adesão precisa, sem pesar a ficha */}
              {souCoord && (civis || resp) && (
                <div className="mt-5 border-t border-border/60 pt-1">
                  <Collapsible.Root>
                    <Collapsible.Trigger className="group flex min-h-9 w-full items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <LockSimple size={14} aria-hidden className="shrink-0" />
                      {resp ? "Dados civis e responsável" : "Dados civis"}
                      <CaretRight
                        size={13}
                        aria-hidden
                        className="ml-auto shrink-0 transition-transform duration-150 group-data-[panel-open]:rotate-90"
                      />
                    </Collapsible.Trigger>
                    <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
                      <dl className="pt-1 sm:grid sm:grid-cols-2 sm:gap-x-8">
                        <Linha rotulo="Nome civil" valor={civis?.nome_civil} sempre />
                        <Linha rotulo="RG" valor={civis?.rg} sempre />
                        <Linha rotulo="CPF" valor={civis?.cpf} sempre />
                        <Linha
                          rotulo="Nascimento"
                          valor={civis?.data_nascimento ? formatDate(civis.data_nascimento) : null}
                          sempre
                        />
                        <Linha
                          rotulo="Endereço"
                          valor={enderecoTxt(civis?.endereco)}
                          sempre
                          className="sm:col-span-2"
                        />
                      </dl>
                      {resp && (
                        <>
                          <p className="mt-1 border-t border-border/60 pt-2.5 text-xs font-medium text-muted-foreground">
                            Responsável legal{resp.parentesco ? ` · ${resp.parentesco}` : ""}
                          </p>
                          <dl className="sm:grid sm:grid-cols-2 sm:gap-x-8">
                            <Linha rotulo="Nome civil" valor={resp.nome_civil} sempre />
                            <Linha rotulo="RG" valor={resp.rg} sempre />
                            <Linha rotulo="CPF" valor={resp.cpf} sempre />
                            <Linha
                              rotulo="Nascimento"
                              valor={resp.data_nascimento ? formatDate(resp.data_nascimento) : null}
                              sempre
                            />
                            <Linha
                              rotulo="Endereço"
                              valor={enderecoTxt(resp.endereco)}
                              sempre
                              className="sm:col-span-2"
                            />
                          </dl>
                        </>
                      )}
                    </Collapsible.Panel>
                  </Collapsible.Root>
                </div>
              )}
            </section>
          )}

          {/* supervisão (0041) — na ficha do supervisor, as sessões que ele
              conduziu; na do mentor, as que recebeu. Vazia = seção some */}
          {supervisoes.length > 0 && (
            <SupervisoesSection
              itens={supervisoes}
              visao={papelPessoa === "supervisor" ? "supervisor" : "mentor"}
              podeExcluir={souCoord}
            />
          )}
        </div>

        {/* rail direito — referência operacional: vínculos, documentos
            (coord) e o caderno privado de notas */}
        {temRail && (
        <aside className="min-w-0 space-y-4">
          {/* Duplas — pra quem não é coord a RLS devolve só os vínculos do
              espectador: lista vazia diria "não tem dupla" e seria mentira
              (Fernanda tem dupla supervisionada por outra pessoa). Então só
              a coord vê o estado vazio; staff/colega vê o card só quando há
              o que mostrar */}
          {(souCoord || perfil.duplas.length > 0) && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)] sm:p-5">
              <h2 className="text-sm font-semibold">Duplas</h2>
              {perfil.duplas.length === 0 ? (
                <p className="mt-2 text-muted-foreground">Nenhuma dupla no histórico.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {perfil.duplas.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/duplas/${d.id}`}
                        className="group flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {d.mentor && d.mentorado && (
                          <DuplaAvatares
                            mentor={d.mentor}
                            mentorado={d.mentorado}
                            size={32}
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          {/* flex + min-w-0: em block o ellipsis do pai
                              suprimia o lockup inteiro e o mentorado
                              sumia; como flex item cada nome corta com
                              "…" próprio */}
                          <span className="flex min-w-0 items-center gap-1 text-sm font-medium">
                            {d.mentor && d.mentorado ? (
                              <DuplaNomes mentor={d.mentor.nome} mentorado={d.mentorado.nome} truncar />
                            ) : (
                              "Dupla"
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {STATUS_DUPLA[d.status]}
                            {d.iniciada_em ? ` · desde ${formatDate(d.iniciada_em)}` : ""}
                          </span>
                        </span>
                        <ArrowUpRight
                          size={13}
                          aria-hidden
                          className="shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-foreground"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* documentos + termos + anamnese — coord-only ponta a ponta. A
              gaveta nasce fechada: o cabeçalho com a contagem já diz o que
              tem dentro e a ficha fica leve; id próprio porque o stat
              "Termo" pendente aponta pra cá */}
          {souCoord && (
            <section
              id="assinaturas"
              className="scroll-mt-20 rounded-xl bg-card text-sm shadow-[var(--shadow-border)]"
            >
              <Collapsible.Root>
                <Collapsible.Trigger className="group flex min-h-12 w-full items-center gap-2 rounded-xl px-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5">
                  <span className="text-sm font-semibold">
                    Documentos e assinaturas
                  </span>
                  <CaretRight
                    size={13}
                    aria-hidden
                    className="ml-auto shrink-0 text-muted-foreground transition-transform duration-150 group-data-[panel-open]:rotate-90"
                  />
                </Collapsible.Trigger>
                <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
                  <div className="border-t border-border/60 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                    {/* anexos do form de inscrição (0054) — RG, comprovante,
                        currículo */}
                    <DocumentosPessoa
                      tipo={ehMentorado ? "mentorado" : "profile"}
                      pessoaId={p.id}
                      documentos={documentos}
                    />
                    <div className="mt-4 border-t border-border pt-3">
                      <AssinaturasPessoa
                        tipo={ehMentorado ? "mentorado" : "profile"}
                        id={p.id}
                        nome={p.nome}
                        whatsapp={p.whatsapp}
                      />
                    </div>
                    {/* Anamnese Social (0042) — o form oficial respondido
                        pelo(a) jovem sem login; coord envia/reenvia daqui */}
                    {anamnese && (
                      <AnamneseMentoradoChip
                        mentoradoId={p.id}
                        nome={p.nome}
                        whatsapp={p.whatsapp}
                        anamnese={anamnese}
                      />
                    )}
                  </div>
                </Collapsible.Panel>
              </Collapsible.Root>
            </section>
          )}

          {/* mural de notas — o cadeado no título carrega sozinho o sinal
              de privacidade; some quando não há nada pra ler nem permissão
              pra escrever (ficha de colega) */}
          {(podeAnotar || notas.length > 0) && (
            <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                Notas
                <LockSimple
                  size={13}
                  role="img"
                  aria-label="Privadas — só você vê"
                  className="text-muted-foreground"
                />
              </h2>
              <PessoaMural
                pessoaId={p.id}
                tipo={perfil.tipo}
                notas={notas}
                podeAnotar={podeAnotar}
                nomePessoa={p.nome}
              />
            </section>
          )}
        </aside>
        )}
      </div>
    </div>
  );
}
