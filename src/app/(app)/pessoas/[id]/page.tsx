import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, Buildings, EnvelopeSimple, HandHeart, LinkedinLogo, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
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
import { AnamneseMentoradoChip } from "@/components/anamnese-mentorado";
import { DocumentosPessoa } from "@/components/documentos-pessoa";
import { AssinaturasPessoa } from "@/components/assinaturas-pessoa";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
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
function Linha({ rotulo, valor, sempre }: { rotulo: string; valor: string | null | undefined; sempre?: boolean }) {
  if (!valor && !sempre) return null;
  // os <dl> da ficha moram num rail de ~290px — rótulo sobre o valor
  // (o dt de largura fixa esmagava a linha em telas estreitas)
  return (
    <div className="py-2.5">
      <dt className="text-xs text-muted-foreground/80">{rotulo}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{valor || "—"}</dd>
    </div>
  );
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
  // demais chegam null e a linha some. Pra coord a linha fica com "—" pra
  // distinguir "não preenchido" de "sem permissão".
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
  const temFicha = Boolean(
    p.nome_social || local || interesses.length || p.origem ||
    nascimentoTxt || p.genero || p.cor_raca || p.motivacao || p.pref_genero_par ||
    (prof && (prof.cargo || prof.empresa || mp)) ||
    (ment && (ment.escolaridade || ment.objetivos || dispMentoradoTxt))
  );

  // RLS devolve só as minhas notas — o feed não precisa de autor
  const notas: MuralNota[] = perfil.notas.map((n) => ({
    id: n.id,
    texto: n.texto,
    created_at: n.created_at,
  }));

  return (
    <div className="space-y-6">
      {/* coord volta pra /pessoas; mentor/supervisor voltam pra de onde vieram */}
      <PageHeader
        kicker={<VoltarLink fallback={souCoord ? "/pessoas" : "/"} />}
        media={
          <Avatar
            nome={p.nome}
            src={avatarSrc}
            fallbackSrc={gravatar}
            papel={ehMentorado ? "mentorado" : undefined}
            size={72}
          />
        }
        title={p.nome}
        meta={
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {ehMentorado ? (
              <>
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
                Mentorado
                {"ong_origem" in p && p.ong_origem && ` · ${p.ong_origem}`}
              </>
            ) : (
              <>
                {papelLabel("role" in p ? p.role : null)}
                {"ativo" in p && !p.ativo && (
                  <Badge variant="outline" className="border-[var(--danger)]/50 text-[var(--danger)]">
                    inativa
                  </Badge>
                )}
                {"user_id" in p && !p.user_id && p.ativo && (
                  <Badge variant="outline">ainda não entrou</Badge>
                )}
              </>
            )}
          </p>
        }
        actions={
          souCoord
            ? perfil.tipo === "profile" ? (
                <PessoaActions
                  pessoa={perfil.pessoa}
                  podeExcluir={!perfil.pessoa.user_id && perfil.duplas.length === 0}
                />
              ) : (
                <MentoradoActions
                  mentorado={perfil.pessoa}
                  temDupla={perfil.duplas.length > 0}
                />
              )
            : undefined
        }
      >
        {/* contato — chip real, não texto corrido (mesma gramática dos chips da ficha) */}
        {(wa || ("email" in p && p.email)) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-[var(--brand-lime)]/15 hover:border-[var(--brand-lime)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
              >
                <WhatsappLogo size={15} aria-hidden />
                WhatsApp
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
            {"email" in p && p.email && (
              <a
                href={`mailto:${p.email}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
              >
                <EnvelopeSimple size={15} aria-hidden />
                {p.email}
              </a>
            )}
          </div>
        )}
      </PageHeader>

      {/* minmax(0,1fr) + min-w-0 nos filhos: sem eles o min-content da seção
          "Duplas" subia pelo grid e estourava a página (+66px a 390px).
          items-start impede o card de Notas de esticar até a altura da rail.
          aside vem antes no DOM: no mobile a ficha cadastral é o conteúdo
          primário (o mural descia ~600px); no lg o rail volta pra direita
          via order e o foco segue a mesma ordem da leitura mobile */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="min-w-0 space-y-4 lg:order-2">
          {/* cadastro/matching (0034) — os sensíveis (nascimento, gênero,
              motivação, pref. de par) só chegam preenchidos pra coordenação
              via view; `sempre` deixa o "—" explícito pra ela */}
          {(temFicha || souCoord) && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Cadastro
              </h2>
              {temFicha ? (
                <dl className="mt-2 divide-y divide-border/60">
                  <Linha rotulo="Nome social" valor={p.nome_social} sempre={souCoord} />
                  <Linha rotulo="Nascimento" valor={nascimentoTxt} sempre={souCoord} />
                  {anos != null && anos < 18 && (
                    <p className="my-2.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
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
                    <Linha rotulo="Objetivos" valor={ment.objetivos} sempre={souCoord} />
                  )}
                  {ment && (
                    <Linha rotulo="Disponível" valor={dispMentoradoTxt} sempre={souCoord} />
                  )}
                  <Linha rotulo="Motivação" valor={p.motivacao} sempre={souCoord} />
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
              {interesses.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {interesses.map((i) => (
                    <Badge key={i} variant="secondary" className="font-normal">
                      {i}
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ficha de mentor — mentor_profiles é legível por autenticado; a
              página de profile em si já é restrita a staff */}
          {mp && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Mentoria ({mp.tipo === "dpp" ? "DPP" : "especialista"})
              </h2>
              <dl className="mt-2 divide-y divide-border/60">
                <Linha rotulo="Capacidade" valor={`${mp.capacidade} ${mp.capacidade === 1 ? "dupla" : "duplas"}`} sempre />
                <Linha rotulo="Disponível" valor={dispTxt} sempre={souCoord} />
                <Linha rotulo="Experiência" valor={mp.experiencia_previa} sempre={souCoord} />
                <Linha rotulo="Formação" valor={mp.formacao_externa} sempre={souCoord} />
                <Linha
                  rotulo="Checklist"
                  valor={[
                    mp.termo_ok ? "termo assinado" : "termo pendente",
                    mp.formacao_ok ? "formação concluída" : "formação pendente",
                  ].join(" · ")}
                  sempre
                />
                {/* presença na formação do ciclo (chamada da agenda) — sem
                    encontro de formação no ciclo a linha nem renderiza;
                    podeVerFormacao evita o "0 de M" fora do escopo do
                    supervisor */}
                {resumoFormacao && resumoFormacao.total > 0 && (
                  <Linha
                    rotulo="Formação inicial"
                    valor={`${resumoFormacao.presentes} de ${resumoFormacao.total} ${
                      resumoFormacao.total === 1 ? "encontro" : "encontros"
                    }`}
                    sempre
                  />
                )}
              </dl>
            </section>
          )}

          {/* documentos + termos + anamnese — coord-only ponta a ponta; até
              aqui isso só existia dentro do dialog de edição */}
          {souCoord && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Documentos e assinaturas
              </h2>
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

          {/* vitrine profissional (0030) — bio corrida, LinkedIn externo,
              áreas como chips e voluntariado numa linha discreta */}
          {perfilPro && temPerfilPro && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Perfil profissional
              </h2>
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
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
                >
                  <LinkedinLogo size={15} aria-hidden />
                  LinkedIn
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
              {perfilPro.areas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {perfilPro.areas.map((a) => (
                    <Badge key={a} variant="secondary" className="font-normal">
                      {a}
                    </Badge>
                  ))}
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
            </section>
          )}

        </aside>

        {/* coluna principal — conteúdo de linha do tempo: mural de notas
            (a parte viva da ficha), histórico de duplas e supervisões */}
        <div className="min-w-0 space-y-4 lg:order-1">
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

          <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Duplas
            </h2>
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
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Buildings size={13} aria-hidden />
                Referência da anamnese
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{p.notas}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
