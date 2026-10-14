import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  BookOpen,
  CalendarDots,
  FileArrowDown,
  Signature,
  Flag,
  FolderOpen,
  HandHeart,
  Handshake,
  HourglassMedium,
  LinkSimple,
  ListChecks,
  Megaphone,
  PuzzlePiece,
  ShareNetwork,
  Siren,
  Star,
  VideoCamera,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import { JovemAvaliacoes } from "@/components/jovem-avaliacoes";
import { JovemCombinados } from "@/components/jovem-combinados";
import { JovemEspecialistas } from "@/components/jovem-especialistas";
import { PedirAjudaDialog } from "@/components/jovem-pedir-ajuda";
import { LembreteDisponibilidade } from "@/components/lembrete-disponibilidade";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  disponibilidadeVazia,
  formatDate,
  formatDateTime,
  formatDiaMes,
  linkSeguro,
  toDateStr,
  waLink,
} from "@/lib/ciclo";
import { avatarPublicUrl } from "@/lib/avatar";
import {
  getJovemAssinaturas,
  getJovemContatos,
  getJovemDuplas,
  getJovemEncaminhamentos,
  getJovemEncontros,
  getJovemPedidosEspecialista,
  getJovemPerfil,
} from "@/lib/queries-jovem";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import { getComunicados, getMateriais, getMe } from "@/lib/queries";
import type { Disponibilidade, JovemContato } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

// prioridade do aviso — mesma gramática da home de staff (cor nunca sozinha)
const PRIORIDADE = {
  urgente: {
    tinte: "bg-[var(--danger)]/8",
    icone: Siren,
    texto: "Urgente",
    cls: "border-[var(--danger)]/50 text-[var(--danger)]",
  },
  importante: {
    tinte: "bg-[var(--warn)]/10",
    icone: Flag,
    texto: "Importante",
    cls: "border-[var(--warn)]/50 text-[var(--warn-text)]",
  },
  normal: null,
} as const;

const TIPO_ICONE_MATERIAL = {
  guia: BookOpen,
  template: Signature,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

export default async function JovemHome() {
  const [me, perfil, duplas, contatos, encaminhamentos, assinaturas, encontros, avisos, materiais, avaliacoes, pedidosEsp] =
    await Promise.all([
      getMe(),
      getJovemPerfil(),
      getJovemDuplas(),
      getJovemContatos(),
      getJovemEncaminhamentos(),
      getJovemAssinaturas(),
      getJovemEncontros(),
      getComunicados(),
      getMateriais(),
      getJovemAvaliacoes(),
      getJovemPedidosEspecialista(),
    ]);
  if (!me) return null; // o layout já barra — convenção das páginas

  const nomeTela = me.nome_social || me.nome;
  const primeiroNome = nomeTela.split(" ")[0];
  const agora = new Date();
  const hoje = toDateStr(agora);

  // a dupla "atual" é a ativa/pausada; sem ela cai na mais recente (uma dupla
  // concluída continua sendo referência — contatos e histórico seguem dela)
  const duplaAtual =
    duplas.find((d) => d.status === "ativa" || d.status === "pausada") ??
    duplas[0] ??
    null;
  const duplaEmCurso = duplaAtual?.status === "ativa" || duplaAtual?.status === "pausada";

  // contatos da dupla atual + a coordenação (dupla_id null na view)
  const contatosAtuais = contatos.filter(
    (c) => c.dupla_id == null || c.dupla_id === duplaAtual?.id
  );
  const porPapel = (papel: string): JovemContato[] =>
    contatosAtuais.filter((c) => c.papel === papel);
  const mentores = porPapel("mentor");
  // a dupla de especialista entrega papel 'especialista' (0076) — antes
  // caía como 'mentor' e a trilha esp ficava sem contato na home
  const especialistas = porPapel("especialista");
  const supervisores = porPapel("supervisor");
  const coordenacao = porPapel("coordenacao");

  const futuros = encontros
    .filter(
      (e) =>
        (e.status === "agendado" || e.status === "remarcado") &&
        e.data_hora != null &&
        new Date(e.data_hora) >= agora
    )
    .sort(
      (a, b) =>
        new Date(a.data_hora!).getTime() - new Date(b.data_hora!).getTime()
    );
  const proximo = futuros[0] ?? null;
  const feitos = encontros.filter((e) => e.status === "realizado").length;

  // avaliação estrela (0071): pendente = realizado sem linha dele; a trilha
  // resolve por dupla (a view jovem_duplas entrega — a tabela `duplas` não
  // é legível pro papel e o join acontece com o que ele já pode ver)
  const trilhaPorDupla = new Map(duplas.map((d) => [d.id, d.trilha ?? "dpp"]));
  // o lápis "trocar link" do próximo encontro — mesmo recorte da agenda:
  // agendado de dupla ativa e DPP (a RPC do jovem não escreve na trilha esp)
  const linkEditavelProximo =
    proximo != null &&
    proximo.status === "agendado" &&
    (duplas.find((d) => d.id === proximo.dupla_id)?.status === "ativa") &&
    (trilhaPorDupla.get(proximo.dupla_id) ?? "dpp") !== "especialista";

  const avaliados = new Set(avaliacoes.map((a) => a.encontro_id));
  const avaliacoesPendentes = encontros
    .filter((e) => e.status === "realizado" && !avaliados.has(e.id))
    .map((e) => ({
      encontroId: e.id,
      numero: e.numero,
      realizado_em: e.realizado_em,
      trilha: trilhaPorDupla.get(e.dupla_id) ?? "dpp",
    }));
  const avaliacoesFeitas = avaliacoes.map((a) => ({
    ...a,
    trilha: trilhaPorDupla.get(a.dupla_id) ?? "dpp",
  }));

  // documentos: pendente com token vencido conta como expirado na UI (a
  // expiração é lazy no banco — quem abre o link carimba, a lista já avisa)
  const docsPendentes = assinaturas.filter(
    (a) =>
      a.status === "pendente" &&
      !(a.token_expira_em && new Date(a.token_expira_em) < agora)
  );
  const docsExpirados = assinaturas.filter(
    (a) =>
      (a.status === "pendente" &&
        a.token_expira_em != null &&
        new Date(a.token_expira_em) < agora) ||
      a.status === "expirado"
  );
  const docsAssinados = assinaturas.filter((a) => a.status === "assinado");
  const docsOutros = assinaturas.filter(
    (a) =>
      !docsPendentes.includes(a) &&
      !docsExpirados.includes(a) &&
      !docsAssinados.includes(a)
  ); // revogado e cia. — raro, mas não pode sumir

  const waCoord = waLink(
    coordenacao[0]?.whatsapp,
    `Olá! Sou ${nomeTela}, mentorado(a) do programa, e preciso falar com a equipe.`
  );

  // lembrete permanente do "Preencher depois" (REALIZA-114): sem grade o
  // cruzamento da agenda não tem com o que cruzar — a faixa fica até a
  // pessoa preencher no Perfil (quem "pulou" no wizard cai no mesmo estado)
  const gradeVazia =
    perfil != null &&
    disponibilidadeVazia(perfil.disponibilidade as Disponibilidade | null);

  // pedidos de especialista (REALIZA-112): o gate da demanda é o da RPC —
  // só quem NÃO tem trilha de especialista ativa/pausada precisa contar o
  // porquê; e sem dupla DPP ativa o pedido entra na triagem da coordenação
  const trilhasAtivasEsp = duplas
    .filter(
      (d) =>
        d.trilha === "especialista" &&
        (d.status === "ativa" || d.status === "pausada") &&
        d.mentor_id != null
    )
    .map((d) => d.mentor_id!);
  const semDuplaDpp = !duplas.some(
    (d) => d.trilha !== "especialista" && d.status === "ativa"
  );

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Olá, {primeiroNome}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {duplaEmCurso
            ? `Sua mentoria ${duplaAtual.trilha === "especialista" ? "com o especialista" : "do programa"} está em curso.`
            : "Sua jornada de mentoria por aqui."}
        </p>
      </header>

      {/* pendência da grade — some quando a pessoa preenche (sem ficha não
          tem onde gravar: a faixa nem promete o gesto) */}
      {gradeVazia && <LembreteDisponibilidade />}

      {/* canal de segurança sempre à mão — a ação mais importante da tela
          pra quem precisa dela não pode morar atrás de scroll nem de nav */}
      <section aria-labelledby="ajuda-titulo">
        <Card className="animate-enter">
          <CardContent className="flex flex-wrap items-center gap-4 py-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--role-mentorado)]/30 text-[var(--brand-ink)]">
              <HandHeart size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 basis-52">
              <h2 id="ajuda-titulo" className="font-semibold">
                Precisa de ajuda?
              </h2>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                A equipe é avisada na hora e fala com você. Se for urgente,
                chame a coordenação direto no WhatsApp.
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <PedirAjudaDialog
                trigger={
                  <Button size="sm">
                    <HandHeart size={16} aria-hidden />
                    Pedir ajuda
                  </Button>
                }
              />
              {waCoord && (
                <a
                  href={waCoord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <WhatsappLogo size={16} aria-hidden />
                  Falar com a coordenação
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Minha dupla — os adultos que caminham com o jovem */}
      <section aria-labelledby="dupla-titulo">
        <h2 id="dupla-titulo" className="mb-3 flex items-center gap-2 font-semibold">
          <Handshake size={18} className="text-muted-foreground" aria-hidden />
          Minha mentoria
        </h2>
        {!duplaAtual ? (
          <Card>
            <CardContent className="py-8 text-center">
              <span aria-hidden className="mx-auto inline-flex">
                <span className="size-8 rounded-full bg-[var(--brand-lime)] ring-2 ring-card" />
                <span className="-ml-2.5 size-8 rounded-full bg-[var(--role-mentorado)] ring-2 ring-card" />
              </span>
              <p className="mt-3 font-medium text-foreground">
                Você ainda não tem uma dupla.
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                A coordenação está formando as duplas. Quando a sua estiver
                pronta, seu mentor aparece aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-enter overflow-hidden">
            <CardContent className="space-y-4 pt-5">
              {duplaAtual.status === "pausada" && (
                <p className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm">
                  <span className="font-medium">Mentoria pausada.</span> A
                  coordenação retoma quando for a hora — seus contatos seguem
                  aqui.
                </p>
              )}
              {duplaAtual.status === "concluida" && (
                <p className="rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/8 px-4 py-3 text-sm">
                  <span className="font-medium">Jornada concluída.</span>{" "}
                  Parabéns por chegar até o fim do ciclo!
                </p>
              )}
              <ul className="divide-y divide-border/60">
                {mentores.map((c) => (
                  <ContatoLinha
                    key={c.id ?? c.nome}
                    c={c}
                    papel="Seu mentor"
                    nomeJovem={nomeTela}
                  />
                ))}
                {especialistas.map((c) => (
                  <ContatoLinha
                    key={c.id ?? c.nome}
                    c={c}
                    papel="Seu especialista"
                    nomeJovem={nomeTela}
                  />
                ))}
                {supervisores.map((c) => (
                  <ContatoLinha
                    key={c.id ?? c.nome}
                    c={c}
                    papel="Supervisor(a) da dupla"
                    nomeJovem={nomeTela}
                  />
                ))}
                {coordenacao.map((c) => (
                  <ContatoLinha
                    key={c.id ?? c.nome}
                    c={c}
                    papel="Coordenação do programa"
                    nomeJovem={nomeTela}
                  />
                ))}
                {!mentores.length && !especialistas.length && !supervisores.length && !coordenacao.length && (
                  <li className="py-3 text-sm text-muted-foreground">
                    A equipe aparece aqui quando a coordenação conectar seu
                    cadastro à plataforma.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Encontros */}
      <section aria-labelledby="encontros-titulo">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="encontros-titulo" className="flex items-center gap-2 font-semibold">
            <CalendarDots size={18} className="text-muted-foreground" aria-hidden />
            Encontros
          </h2>
          <Link
            href="/jovem/agenda"
            className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver agenda
            <ArrowRight
              size={13}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
        <Card className="animate-enter">
          <CardContent>
            {!duplaEmCurso && !encontros.length ? (
              <p className="py-4 text-sm text-muted-foreground">
                Quando sua dupla for formada, vocês marcam os encontros juntos
                e eles aparecem aqui.
              </p>
            ) : proximo ? (
              <div className="flex flex-wrap items-center gap-4 py-2">
                <div className="min-w-0 flex-1 basis-52">
                  <p className="font-medium">
                    {proximo.numero}º encontro{" "}
                    {proximo.status === "remarcado" && (
                      <span className="text-muted-foreground">(remarcado)</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatDateTime(proximo.data_hora)}
                  </p>
                  {proximo.motivo_reagendamento && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Por que mudou: {proximo.motivo_reagendamento}
                    </p>
                  )}
                </div>
                {(linkSeguro(proximo.link) || linkEditavelProximo) && (
                  <div className="flex items-center gap-2">
                    {linkSeguro(proximo.link) && (
                      <a
                        href={linkSeguro(proximo.link)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <VideoCamera size={16} aria-hidden />
                        Entrar na chamada
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    )}
                    {/* sem link ainda o lápis é o "adicionar" — o encontro
                        agendado é quem mais precisa dele */}
                    {linkEditavelProximo && (
                      <EditarLinkDialog
                        encontroId={proximo.id}
                        linkAtual={proximo.link}
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">
                {duplaEmCurso
                  ? "Nenhum encontro marcado ainda — combinem o próximo no papo ou pelo WhatsApp."
                  : "Nenhum encontro marcado por enquanto."}
              </p>
            )}
            {feitos > 0 && (
              <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                {feitos} {feitos === 1 ? "encontro já feito" : "encontros já feitos"} — o histórico completo está na agenda.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Especialistas (REALIZA-112) — o convite pra pedir apoio + os
          pedidos em andamento com a mesa de negociação do jovem. Some quando
          o profile ainda não tem ficha de mentorado vinculada — a RPC
          negaria e a home não promete gesto impossível */}
      <JovemEspecialistas
        disponivel={perfil != null}
        catalogo={pedidosEsp.catalogo}
        solicitacoes={pedidosEsp.solicitacoes}
        propostas={pedidosEsp.propostas}
        slotsPorEsp={pedidosEsp.slotsPorEsp}
        trilhasAtivas={trilhasAtivasEsp}
        semDuplaDpp={semDuplaDpp}
        meuId={me.id}
        waCoord={waCoord}
      />

      {/* Suas avaliações (0071) — pendência com CTA + histórico do que já
          foi dito; o toggle "meu mentor lê" mora no detalhe de cada uma */}
      {(avaliacoesPendentes.length > 0 || avaliacoesFeitas.length > 0) && (
        <section aria-labelledby="avaliacoes-titulo">
          <h2 id="avaliacoes-titulo" className="mb-3 flex items-center gap-2 font-semibold">
            <Star size={18} className="text-muted-foreground" aria-hidden />
            Suas avaliações
          </h2>
          <Card className="animate-enter">
            <CardContent className="p-0">
              <JovemAvaliacoes
                pendentes={avaliacoesPendentes}
                feitas={avaliacoesFeitas}
                primeiroNome={primeiroNome}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Combinados — a lista que o jovem controla */}
      <section aria-labelledby="combinados-titulo">
        <h2 id="combinados-titulo" className="mb-3 flex items-center gap-2 font-semibold">
          <ListChecks size={18} className="text-muted-foreground" aria-hidden />
          Meus combinados
        </h2>
        <Card className="animate-enter">
          <CardContent className="px-5 py-0 sm:px-6">
            <JovemCombinados itens={encaminhamentos} hoje={hoje} />
          </CardContent>
        </Card>
      </section>

      {/* Documentos pra assinar — o termo é do jovem; a autorização vai pro
          responsável (link tokenizado funciona logado ou não, 0070) */}
      <section aria-labelledby="docs-titulo">
        <h2 id="docs-titulo" className="mb-3 flex items-center gap-2 font-semibold">
          <Signature size={18} className="text-muted-foreground" aria-hidden />
          Documentos
        </h2>
        <Card className="animate-enter">
          <CardContent className="divide-y divide-border/60 p-0">
            {assinaturas.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Nenhum documento por enquanto. Quando a coordenação emitir o
                seu termo ou a autorização do responsável, eles chegam aqui.
              </p>
            ) : (
              <>
                {docsPendentes.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-sm font-medium">{a.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.slug === "autorizacao-responsavel"
                          ? "Quem assina é seu responsável — encaminhe o link."
                          : "A assinatura é sua e leva poucos minutos."}
                        {a.token_expira_em && (
                          <> · vale até {formatDate(a.token_expira_em)}</>
                        )}
                      </p>
                    </div>
                    {/* token vem da view (0070: "o token é dele"); sem ele o
                        link não existe — o estado honesto é o do expirado */}
                    {a.token ? (
                      <Link
                        href={`/assinar/${a.token}`}
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          a.slug === "autorizacao-responsavel" &&
                            "border border-border bg-transparent text-foreground shadow-none hover:bg-muted"
                        )}
                      >
                        {a.slug === "autorizacao-responsavel" ? (
                          <ShareNetwork size={15} aria-hidden />
                        ) : (
                          <Signature size={15} aria-hidden />
                        )}
                        {a.slug === "autorizacao-responsavel"
                          ? "Encaminhar para o responsável"
                          : "Assinar"}
                      </Link>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Peça um novo link à coordenação
                      </Badge>
                    )}
                  </div>
                ))}
                {docsAssinados.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-sm font-medium">{a.titulo}</p>
                      <p className="mt-0.5 text-xs text-[var(--ok-text)]">
                        Assinado{a.assinado_em ? ` em ${formatDateTime(a.assinado_em)}` : ""}
                      </p>
                    </div>
                    {/* a via do jovem é a pública por token — a RLS de
                        assinaturas (self+coord) não tem ramo mentorado; a
                        0070 expõe o token na view justamente pra isto */}
                    {a.token && (
                      <a
                        href={`/api/assinar-token/${a.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <FileArrowDown size={15} aria-hidden />
                        Ver PDF assinado
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    )}
                  </div>
                ))}
                {[...docsExpirados, ...docsOutros].map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-sm font-medium">{a.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.status === "revogado"
                          ? "Este documento foi revogado pela coordenação."
                          : "O prazo deste link terminou. Peça um novo à coordenação."}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-muted-foreground">
                      <HourglassMedium size={13} data-icon="inline-start" aria-hidden />
                      {a.status === "revogado" ? "Revogado" : "Expirado"}
                    </Badge>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Avisos da coordenação (audiência 'todos' — a RLS já entrega só o
          que o jovem pode ler) */}
      {avisos.length > 0 && (
        // id="avisos": a notificação do aviso aponta pra "/#avisos" — o
        // redirect do (app) devolve pra cá e o fragmento ancora na seção
        <section id="avisos" aria-labelledby="avisos-titulo">
          <h2 id="avisos-titulo" className="mb-3 flex items-center gap-2 font-semibold">
            <Megaphone size={18} className="text-muted-foreground" aria-hidden />
            Avisos
          </h2>
          <Card className="animate-enter">
            <CardContent className="divide-y divide-border/60 p-0">
              {avisos.map((a) => {
                const prio = PRIORIDADE[a.prioridade];
                const Icone = prio?.icone;
                return (
                  <article
                    key={a.id}
                    className={cn("px-5 py-3.5", prio?.tinte)}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {prio && Icone && (
                        <Badge variant="outline" className={prio.cls}>
                          <Icone data-icon="inline-start" aria-hidden />
                          {prio.texto}
                        </Badge>
                      )}
                      <p className="min-w-0 flex-1 basis-40 text-sm font-medium">
                        {a.titulo}
                      </p>
                      <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                        {formatDiaMes(a.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {a.corpo}
                    </p>
                  </article>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Materiais oficiais — idem: só 'todos' chega pelo RLS */}
      {materiais.length > 0 && (
        <section aria-labelledby="materiais-titulo">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="materiais-titulo" className="flex items-center gap-2 font-semibold">
              <FolderOpen size={18} className="text-muted-foreground" aria-hidden />
              Materiais do programa
            </h2>
            <Link
              href="/jovem/materiais"
              className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver todos
              <ArrowRight
                size={13}
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
          <Card className="animate-enter">
            <CardContent className="divide-y divide-border/60 p-0">
              {materiais.slice(0, 3).map((m) => {
                const Icone = TIPO_ICONE_MATERIAL[m.tipo];
                const href = m.path ? `/api/material/${m.id}` : linkSeguro(m.url);
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
                      <Icone size={16} aria-hidden />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {m.titulo}
                    </p>
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir ${m.titulo}`}
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ArrowSquareOut size={15} aria-hidden />
                      </a>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {/* vazio honesto: sem dupla, sem nada — a home segue útil pelo pedido
          de ajuda e pelos contatos; perfil nulo = vínculo ainda não feito */}
      {!perfil && (
        <p className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm">
          <span className="font-medium">Seu cadastro está sendo conectado.</span>{" "}
          A coordenação ainda não vinculou sua conta à ficha de mentorado — se
          isso não se resolver em alguns dias, use o “Pedir ajuda” acima.
        </p>
      )}
    </div>
  );
}

function ContatoLinha({
  c,
  papel,
  nomeJovem,
}: {
  c: JovemContato;
  papel: string;
  nomeJovem: string;
}) {
  const wa = waLink(
    c.whatsapp,
    `Olá! Sou ${nomeJovem}, mentorado(a) do programa Realiza.vc.`
  );
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Link
        href={`/jovem/pessoas/${c.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar
          nome={c.nome_social || c.nome || "?"}
          src={c.avatar_path ? avatarPublicUrl(c.avatar_path) : null}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {c.nome_social || c.nome}
          </p>
          <p className="text-xs text-muted-foreground">{papel}</p>
        </div>
      </Link>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Conversar com ${c.nome_social || c.nome} no WhatsApp`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0"
          )}
        >
          <WhatsappLogo size={15} aria-hidden />
          <span className="hidden sm:inline">WhatsApp</span>
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      )}
    </li>
  );
}
