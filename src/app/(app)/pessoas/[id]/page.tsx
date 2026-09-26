import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  ArrowUpRight,
  Buildings,
  CaretRight,
  CheckCircle,
  EnvelopeSimple,
  HandHeart,
  LinkedinLogo,
  LockSimple,
  Warning,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "cn";
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
import { PessoaMural, type MuralNota } from "@/components/pessoa-mural";
import { SupervisoesSection } from "@/components/supervisoes-section";
import { VoltarLink } from "@/components/voltar-link";

export const metadata: Metadata = { title: "Perfil" };

const STATUS_DUPLA: Record<string, string> = {
  ativa: "ativa",
  pausada: "pausada",
  concluida: "concluída",
  encerrada: "encerrada",
};

/** Linha "rótulo: valor" da ficha — some quando o valor é vazio, exceto pra
 *  coordenação (que precisa distinguir "não preenchido" de "sem permissão":
 *  pros demais papéis os sensíveis nem chegam — vêm null do grant). */
function Linha({
  rotulo,
  valor,
  sempre,
  className,
}: {
  rotulo: string;
  valor: string | null | undefined;
  sempre?: boolean;
  className?: string;
}) {
  if (!valor && !sempre) return null;
  // os <dl> da ficha mostram rótulo sobre o valor — leitura de rede social e
  // sobrevive a qualquer largura; a borda vive na linha (não no divide do dl)
  // porque o dl vira grid de 2 colunas a partir de sm
  return (
    <div className={cn("border-b border-border/60 py-2.5", className)}>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {valor || <span className="text-muted-foreground">Não informado</span>}
      </dd>
    </div>
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
 *  "pendente" amber com Warning (o que pede ação do coordenação). */
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
          "mt-1 flex items-center gap-1.5 font-medium",
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

  // mentor que abre o próprio cadastro cai no /perfil (lá ele edita);
  // perfil de outro staff/mentor não é aberto pra ele
  const ehMentor = me.role === "mentor_dpp" || me.role === "mentor_especialista";
  const ehStaff = me.role === "coordenacao" || me.role === "supervisor";
  if (perfil.tipo === "profile" && perfil.pessoa.id === me.id) redirect("/perfil");
  if (!ehStaff && perfil.tipo === "profile") notFound();
  // mentorado: o RLS já barrou quem não tem vínculo (query voltou null)

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
  // documentos do intake (0054) — coord-only; pra outro papel nem dispara
  const documentos = souCoord
    ? await getDocumentosPessoa(perfil.tipo, p.id)
    : [];
  // dados civis + responsável (0046) — chegam null fora da coordenação
  // (view *_pessoal); renderizam fechados num Collapsible no fim do Cadastro
  const civis = p.dados_civis ?? null;
  const resp = ment?.responsavel ?? null;
  const temFicha = Boolean(
    p.nome_social || local || interesses.length || p.origem ||
    nascimentoTxt || p.genero || p.cor_raca || p.motivacao || p.pref_genero_par ||
    (prof && (prof.cargo || prof.empresa || mp)) ||
    (ment && (ment.escolaridade || ment.objetivos || dispMentoradoTxt))
  );

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

  return (
    <div className="space-y-4">
      {/* coord volta pra /pessoas; mentor/supervisor voltam pra de onde vieram */}
      <VoltarLink fallback={souCoord ? "/pessoas" : "/"} />

      {/* header compacto — a capa-perfil do /perfil reduzida a uma faixa de
          marca; a linha abaixo carrega avatar, nome, meta e à direita os
          contatos + ações. A ficha é operacional: cadastro cede o holofote
          pro acompanhamento */}
      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <div aria-hidden className="capa-perfil h-3" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
          <Avatar
            nome={p.nome}
            src={avatarSrc}
            fallbackSrc={gravatar}
            papel={ehMentorado ? "mentorado" : undefined}
            size={64}
          />
          <div className="min-w-0 flex-1 basis-56">
            <h1 className="text-xl font-semibold tracking-tight">{p.nome}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
              {ehMentorado ? (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
                  <span>
                    Mentorado
                    {"ong_origem" in p && p.ong_origem ? ` · ${p.ong_origem}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="font-normal">
                    {papelLabel("role" in p ? p.role : null)}
                  </Badge>
                  {"ativo" in p && !p.ativo && (
                    <Badge variant="outline" className="border-[var(--danger)]/50 text-[var(--danger)]">
                      inativa
                    </Badge>
                  )}
                  {"user_id" in p && !p.user_id && p.ativo && (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      Nunca acessou a plataforma
                    </Badge>
                  )}
                </>
              )}
              {cargoEmpresa && <span>{cargoEmpresa}</span>}
              {local && <span>{local}</span>}
            </div>
          </div>
          {/* contato + ações — chips menores e secundários; o dropdown de
              ações (coord) ganha um Editar visível ao lado */}
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
                  botaoEditar
                />
              ) : (
                <MentoradoActions
                  mentorado={perfil.pessoa}
                  temDupla={perfil.duplas.length > 0}
                  botaoEditar
                />
              ))}
          </div>
        </div>
      </header>

      {/* resumo da mentoria — faixa inteira logo abaixo do header: o estado
          operacional do mentor antes do cadastro. Capacidade, formação
          (presenças + checklist consolidados num stat só), termo e
          disponibilidade; experiência e formação externa vão como linhas
          secundárias */}
      {mp && (
        <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)] sm:p-5">
          <h2 className="text-sm font-semibold">
            {mp.tipo === "dpp" ? "Mentoria DPP" : "Mentoria especialista"}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
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
            <dl className="mt-3 border-t border-border/60 text-[13px] sm:grid sm:grid-cols-2 sm:gap-x-6">
              <Linha rotulo="Experiência" valor={mp.experiencia_previa} sempre={souCoord} />
              <Linha rotulo="Formação externa" valor={mp.formacao_externa} sempre={souCoord} />
            </dl>
          )}
        </section>
      )}

      {/* minmax(0,1fr) + min-w-0 nos filhos: sem eles o min-content das
          seções subia pelo grid e estourava a página. items-start impede os
          cards de esticar até a altura do vizinho. No mobile a coluna
          principal vem primeiro no DOM (cadastro é o conteúdo primário);
          no lg o rail estreito cai à direita por ser o segundo filho */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
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
              via view; `sempre` deixa o "Não informado" explícito pra ela */}
          {(temFicha || souCoord) && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)] sm:p-5">
              <h2 className="text-sm font-semibold">Cadastro</h2>
              {temFicha ? (
                <dl className="mt-1 sm:grid sm:grid-cols-2 sm:gap-x-6">
                  <Linha rotulo="Nome social" valor={p.nome_social} sempre={souCoord} />
                  <Linha rotulo="Nascimento" valor={nascimentoTxt} sempre={souCoord} />
                  {anos != null && anos < 18 && (
                    <p className="my-2.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 sm:col-span-2 dark:bg-amber-950/40 dark:text-amber-200">
                      Menor de idade: a autorização do responsável precisa estar
                      assinada.
                      {souCoord && " Confira o card Documentos e assinaturas."}
                    </p>
                  )}
                  <Linha
                    rotulo="Gênero"
                    valor={p.genero ? GENERO_LABELS[p.genero] : null}
                    sempre={souCoord}
                  />
                  <Linha
                    rotulo="Cor/raça"
                    valor={p.cor_raca ? COR_RACA_LABELS[p.cor_raca] : null}
                    sempre={souCoord}
                  />
                  <Linha rotulo="Cidade/UF" valor={local} sempre={souCoord} />
                  {prof && (
                    <>
                      <Linha rotulo="Cargo" valor={prof.cargo} />
                      <Linha rotulo="Empresa" valor={prof.empresa} />
                    </>
                  )}
                  {ment && (
                    <Linha
                      rotulo="Escolaridade"
                      valor={ment.escolaridade ? ESCOLARIDADE_LABELS[ment.escolaridade] : null}
                      sempre={souCoord}
                    />
                  )}
                  <Linha rotulo="Origem" valor={p.origem} sempre={souCoord} />
                  {ment && (
                    <Linha
                      rotulo="Objetivos"
                      valor={ment.objetivos}
                      sempre={souCoord}
                      className="sm:col-span-2"
                    />
                  )}
                  {ment && (
                    <Linha rotulo="Disponível" valor={dispMentoradoTxt} sempre={souCoord} />
                  )}
                  <Linha
                    rotulo="Motivação"
                    valor={p.motivacao}
                    sempre={souCoord}
                    className="sm:col-span-2"
                  />
                  <Linha
                    rotulo="Pref. de par"
                    valor={p.pref_genero_par ? PREF_GENERO_LABELS[p.pref_genero_par] : null}
                    sempre={souCoord}
                  />
                  {/* consent_lgpd_em só existe em profiles — mentorado é
                      coberto pela autorização do responsável (documento) */}
                  {prof && (prof.consent_lgpd_em != null || souCoord) && (
                    <Linha
                      rotulo="LGPD"
                      valor={
                        prof.consent_lgpd_em
                          ? `Consentimento em ${formatDate(prof.consent_lgpd_em)}`
                          : "Sem consentimento registrado"
                      }
                    />
                  )}
                </dl>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  Nada preenchido ainda. Edite o cadastro ou peça pra pessoa completar o perfil.
                </p>
              )}
              {/* interesses ficam no Cadastro só quando não há card Sobre
                  (mentorado e profiles sem apresentação pública) */}
              {interesses.length > 0 && !temPerfilPro && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Interesses</p>
                  <div className="mt-1.5">
                    <Chips itens={interesses} />
                  </div>
                </div>
              )}

              {/* dados civis (0046) — coord-only, fechados por padrão: o que
                  o termo de adesão precisa, sem pesar a ficha */}
              {souCoord && (civis || resp) && (
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
                    <dl className="pt-1 sm:grid sm:grid-cols-2 sm:gap-x-6">
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
                        <dl className="sm:grid sm:grid-cols-2 sm:gap-x-6">
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

          {/* anamnese do mentorado — contexto da jornada, fica com o
              histórico na coluna principal */}
          {ehMentorado && "notas" in p && p.notas && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)] sm:p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Buildings size={14} aria-hidden />
                Referência da anamnese
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{p.notas}</p>
            </section>
          )}
        </div>

        {/* rail direito — referência operacional: vínculos, documentos
            (coord) e o caderno privado de notas */}
        <aside className="min-w-0 space-y-4">
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
                        <span className="block truncate text-sm font-medium">
                          {d.mentor && d.mentorado ? (
                            <DuplaNomes mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
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

          {/* documentos + termos + anamnese — coord-only ponta a ponta; até
              aqui isso só existia dentro do dialog de edição. id próprio:
              o stat "Termo" pendente aponta pra cá */}
          {souCoord && (
            <section
              id="assinaturas"
              className="scroll-mt-20 rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)] sm:p-5"
            >
              <h2 className="text-sm font-semibold">Documentos e assinaturas</h2>
              {/* anexos do form de inscrição (0054) — RG, comprovante, currículo */}
              <div className="mt-3">
                <DocumentosPessoa
                  tipo={ehMentorado ? "mentorado" : "profile"}
                  pessoaId={p.id}
                  documentos={documentos}
                />
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <AssinaturasPessoa
                  tipo={ehMentorado ? "mentorado" : "profile"}
                  id={p.id}
                  nome={p.nome}
                  whatsapp={p.whatsapp}
                />
              </div>
              {/* Anamnese Social (0042) — o form oficial respondido pelo(a)
                  jovem sem login; coord envia/reenvia o link daqui */}
              {anamnese && (
                <AnamneseMentoradoChip
                  mentoradoId={p.id}
                  nome={p.nome}
                  whatsapp={p.whatsapp}
                  anamnese={anamnese}
                />
              )}
            </section>
          )}

          {/* mural de notas — espaço modesto basta; fica no rail junto da
              referência operacional em vez de ocupar a coluna principal */}
          <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <h2 className="mb-3 text-sm font-semibold">Notas</h2>
            <PessoaMural
              pessoaId={p.id}
              tipo={perfil.tipo}
              notas={notas}
              podeAnotar={podeAnotar}
              nomePessoa={p.nome}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
