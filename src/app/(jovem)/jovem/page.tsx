import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  CaretDown,
  BookOpen,
  FileArrowDown,
  Flag,
  FolderOpen,
  Handshake,
  HourglassMedium,
  LinkSimple,
  ListChecks,
  Megaphone,
  PuzzlePiece,
  ShareNetwork,
  Signature,
  Siren,
  Star,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { JovemAvaliacoes } from "@/components/jovem-avaliacoes";
import { JovemCombinados } from "@/components/jovem-combinados";
import { JovemEspecialistas } from "@/components/jovem-especialistas";
import { JovemParaFazer } from "@/components/jovem-para-fazer";
import { ProximoEncontro } from "@/components/jovem-proximo-encontro";
import { PedirAjudaLinha } from "@/components/jovem-pedir-ajuda";
import { LembreteDisponibilidade } from "@/components/lembrete-disponibilidade";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  disponibilidadeVazia,
  formatDate,
  formatDateTime,
  formatDiaMes,
  linkSeguro,
  maxEncontros,
  passoEsp,
  toDateStr,
  waLink,
} from "@/lib/ciclo";
import { agrupaContatosPorPessoa } from "@/lib/jovem-contatos";
import {
  datasOficiaisDe,
  encCorrenteDe,
  materialLiberadoParaJovem,
} from "@/lib/jornada";
import { avatarPublicUrl } from "@/lib/avatar";
import {
  getJovemAssinaturas,
  getJovemContatos,
  getJovemDuplas,
  getJovemEncaminhamentos,
  getJovemEncontros,
  getJovemJornada,
  getJovemPedidosEspecialista,
  getJovemPerfil,
  type JovemEncontro,
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

// Ordem da home: o encontro primeiro (hero), o que fazer agora, a jornada,
// os adultos, e por fim o que é consulta (especialistas só com ação,
// avaliações, combinados, documentos, avisos e materiais).
export default async function JovemHome() {
  const [me, perfil, duplas, contatos, encaminhamentos, assinaturas, encontros, avisos, materiais, avaliacoes, pedidosEsp, jornada] =
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
      // além do cronograma oficial (a régua do acervo embaixo), a RPC é a
      // auto-cura da jornada — chamar na visita da home já dispara a
      // emissão do que a data oficial abriu (0123)
      getJovemJornada().catch(() => null),
    ]);
  if (!me) return null; // o layout já barra — convenção das páginas

  const nomeTela = me.nome_social || me.nome;
  const primeiroNome = nomeTela.split(" ")[0];
  const agora = new Date();
  const hoje = toDateStr(agora);

  // a dupla "atual" é a DPP ativa/pausada — ela é o eixo da mentoria e o
  // mentor não pode sumir porque uma trilha esp (mais nova) entrou depois;
  // sem DPP viva cai na esp ativa (a mentoria dela é a que está em curso) e
  // por último na mais recente (concluída segue referência de contatos)
  const ativas = duplas.filter(
    (d) => d.status === "ativa" || d.status === "pausada"
  );
  const duplaAtual =
    ativas.find((d) => d.trilha !== "especialista") ??
    ativas[0] ??
    duplas[0] ??
    null;
  const duplaEmCurso = duplaAtual?.status === "ativa" || duplaAtual?.status === "pausada";

  // régua do acervo progressivo (REALIZA-160): a vitrine da home só mostra
  // o que já liberou — material marcado pra encontro futuro não vaza na
  // prévia. Só a dupla DPP ancora (trilha esp tem outra escala, 5 sessões);
  // sem DPP viva → null = acervo livre. A rede de segurança da data
  // oficial (0123) entra quando o cronograma da RPC é desta mesma dupla.
  const encCorrAcervo =
    duplaEmCurso &&
    duplaAtual?.id != null &&
    duplaAtual.trilha !== "especialista"
      ? encCorrenteDe(encontros.filter((e) => e.dupla_id === duplaAtual.id), {
          datasOficiais:
            jornada?.dupla_id === duplaAtual.id
              ? datasOficiaisDe(jornada.cronograma)
              : undefined,
          ativa: duplaAtual.status === "ativa",
          inicio: duplaAtual.iniciada_em,
        })
      : null;
  const materiaisVisiveis = materiais.filter((m) =>
    materialLiberadoParaJovem(m, encCorrAcervo)
  );

  // contatos de TODAS as duplas vivas + a coordenação (dupla_id null na
  // view) — o especialista da trilha esp é contato real, não some porque a
  // "dupla atual" é a DPP
  const idsVivas = new Set(ativas.map((d) => d.id));
  const contatosAtuais = contatos.filter(
    (c) =>
      c.dupla_id == null ||
      idsVivas.has(c.dupla_id) ||
      c.dupla_id === duplaAtual?.id
  );
  // a view repete a pessoa por dupla — dedupe por papel com a dupla mais
  // viva vencendo (mesma régua de /jovem/pessoas; mata a React key
  // duplicada e a linha do supervisor repetida)
  const porDupla = new Map(
    duplas.map((d) => [d.id, { status: d.status, trilha: d.trilha }])
  );
  const porPapel = (papel: string): JovemContato[] =>
    agrupaContatosPorPessoa(
      contatosAtuais.filter((c) => c.papel === papel),
      porDupla
    );
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

  // trilha por dupla (a view jovem_duplas entrega — a tabela `duplas` não é
  // legível pro papel mentorado e o join acontece com o que ele já pode ver)
  const trilhaPorDupla = new Map(duplas.map((d) => [d.id, d.trilha ?? "dpp"]));
  const encPorId = new Map(encontros.map((e) => [e.id, e]));

  // quem aparece no rótulo do encontro: o mentor DPP ou o especialista da
  // trilha (contato com papel 'especialista'; 'mentor' é o legado da DPP)
  const nomeDaDupla = (duplaId: string, esp: boolean): string => {
    const contato = contatosAtuais.find(
      (c) =>
        c.dupla_id === duplaId &&
        (c.papel === "especialista" || c.papel === "mentor")
    );
    const dupla = duplas.find((d) => d.id === duplaId);
    const nome =
      contato?.nome_social ||
      contato?.nome ||
      dupla?.mentor_nome_social ||
      dupla?.mentor_nome ||
      "";
    return nome.split(" ")[0] || (esp ? "seu especialista" : "seu mentor");
  };

  // DPP: "5º encontro com Ricardo". Especialista: "3ª sessão com Sofia" — o
  // passo do guia (rank entre os realizados), não a tentativa.
  const rotuloEncontro = (e: JovemEncontro): string => {
    const esp = trilhaPorDupla.get(e.dupla_id) === "especialista";
    const nome = nomeDaDupla(e.dupla_id, esp);
    if (esp) {
      const passo = passoEsp(
        e,
        encontros.filter((x) => x.dupla_id === e.dupla_id)
      );
      return `${passo}ª sessão com ${nome}`;
    }
    return `${e.numero}º encontro com ${nome}`;
  };

  // progresso da jornada: encontros realizados por trilha (a contagem não
  // soma mentor e especialista num número só)
  const realizados = encontros.filter((e) => e.status === "realizado");
  const feitosDpp = realizados.filter(
    (e) => trilhaPorDupla.get(e.dupla_id) !== "especialista"
  ).length;
  const feitosEsp = realizados.length - feitosDpp;
  const temDpp = duplas.some((d) => d.trilha !== "especialista");

  // avaliação estrela (0071): pendente = realizado sem linha dele
  const avaliados = new Set(avaliacoes.map((a) => a.encontro_id));
  const avaliacoesPendentes = encontros
    .filter((e) => e.status === "realizado" && !avaliados.has(e.id))
    .map((e) => ({
      encontroId: e.id,
      numero: e.numero,
      realizado_em: e.realizado_em,
      trilha: trilhaPorDupla.get(e.dupla_id) ?? "dpp",
      rotulo: rotuloEncontro(e),
    }));
  const avaliacoesFeitas = avaliacoes.map((a) => {
    const enc = encPorId.get(a.encontro_id);
    return {
      ...a,
      trilha: trilhaPorDupla.get(a.dupla_id) ?? "dpp",
      rotulo: enc
        ? rotuloEncontro(enc)
        : a.encontro?.numero
          ? `${a.encontro.numero}º encontro`
          : undefined,
    };
  });

  // combinado aberto com o prazo mais próximo (sem prazo vai por último)
  const combinadoProximo = encaminhamentos
    .filter((c) => c.status === "pendente" && c.id != null && c.descricao != null)
    .sort((a, b) =>
      (a.prazo ?? "9999-12-31").localeCompare(b.prazo ?? "9999-12-31")
    )[0];
  const combinado = combinadoProximo
    ? {
        id: combinadoProximo.id!,
        descricao: combinadoProximo.descricao!,
        prazo: combinadoProximo.prazo ?? null,
      }
    : null;

  // agendar: só a DPP ativa agenda (a RPC recusa a trilha esp). O nº é o
  // primeiro livre depois do último realizado — o mesmo critério da agenda.
  const duplaDppId =
    duplas.find((d) => d.status === "ativa" && d.trilha !== "especialista")?.id ??
    null;
  const ocupados = new Set(
    encontros.filter((e) => e.dupla_id === duplaDppId).map((e) => e.numero)
  );
  const livres = duplaDppId
    ? Array.from({ length: maxEncontros("dpp") }, (_, i) => i + 1).filter(
        (n) => !ocupados.has(n)
      )
    : [];
  const maxRealizado = Math.max(
    0,
    ...encontros
      .filter((e) => e.dupla_id === duplaDppId && e.status === "realizado")
      .map((e) => e.numero)
  );
  const numeroAgendar = livres.find((n) => n > maxRealizado) ?? livres[0] ?? null;
  const agendar =
    duplaDppId != null && numeroAgendar != null
      ? { duplaId: duplaDppId, numero: numeroAgendar }
      : null;

  // o lápis "trocar link" do próximo encontro — mesmo recorte da agenda:
  // agendado de dupla ativa e DPP (a RPC do jovem não escreve na trilha esp)
  const linkEditavelProximo =
    proximo != null &&
    proximo.status === "agendado" &&
    duplas.find((d) => d.id === proximo.dupla_id)?.status === "ativa" &&
    (trilhaPorDupla.get(proximo.dupla_id) ?? "dpp") !== "especialista";

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

  // recolhidos da seção Documentos: tudo que não está pendente
  const docsRecolhidos = [...docsAssinados, ...docsExpirados, ...docsOutros];

  // avisos: urgente e importante à vista; o comum recolhe numa linha
  const avisosDestacados = avisos.filter((a) => a.prioridade !== "normal");
  const avisosComuns = avisos.filter((a) => a.prioridade === "normal");
  const renderAviso = (a: (typeof avisos)[number]) => {
    const prio = PRIORIDADE[a.prioridade];
    const Icone = prio?.icone;
    return (
      <article key={a.id} className={cn("px-4 py-3", prio?.tinte)}>
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
  };

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

  // card-CTA da home: a trilha de especialista mais "viva" — a que tem a
  // próxima sessão mais perto; sem sessão marcada, a mais nova (até 3
  // trilhas podem correr em paralelo, mas o card mostra uma — a página de
  // especialistas lista todas)
  const trilhaResumo = (() => {
    const ativasEsp = duplas.filter(
      (d) =>
        d.trilha === "especialista" &&
        (d.status === "ativa" || d.status === "pausada") &&
        d.id != null
    );
    const comProx = ativasEsp
      .map((d) => {
        const enc = encontros.filter((e) => e.dupla_id === d.id);
        // a próxima sessão marcada; sem ela, a tentativa que cobriria o
        // próximo passo (o passoEsp dá o rank entre realizados nos dois)
        const prox = futuros.find((e) => e.dupla_id === d.id) ?? null;
        const alvo = prox ?? {
          numero: enc.reduce((m, e) => Math.max(m, e.numero), 0) + 1,
          status: "agendado" as const,
        };
        return { d, prox, sessao: passoEsp(alvo, enc) };
      })
      .sort((a, b) => {
        if (a.prox && b.prox)
          return (
            new Date(a.prox.data_hora!).getTime() -
            new Date(b.prox.data_hora!).getTime()
          );
        if (a.prox) return -1;
        if (b.prox) return 1;
        return (b.d.iniciada_em ?? "").localeCompare(a.d.iniciada_em ?? "");
      })[0];
    if (!comProx) return null;
    return {
      tema: comProx.d.demanda ?? "Trilha de especialista",
      espNome:
        (
          comProx.d.mentor_nome_social ||
          comProx.d.mentor_nome ||
          ""
        ).split(" ")[0] || "seu especialista",
      sessao: comProx.sessao,
      proxima: comProx.prox?.data_hora ?? null,
      pausada: comProx.d.status === "pausada",
    };
  })();

  const jornadaTotal = maxEncontros("dpp");
  const jornadaTotalEsp = maxEncontros("especialista");
  const jornadaAtual = temDpp ? feitosDpp : feitosEsp;
  const jornadaMeta = temDpp ? jornadaTotal : jornadaTotalEsp;
  const jornadaPct = Math.min(100, Math.round((jornadaAtual / jornadaMeta) * 100));
  const jornadaTexto = [
    temDpp ? `${feitosDpp} de ${jornadaTotal} com seu mentor` : null,
    feitosEsp > 0
      ? `${feitosEsp} ${feitosEsp === 1 ? "sessão" : "sessões"} com especialista`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const concluida =
    duplaAtual?.status === "concluida" && duplaAtual.trilha !== "especialista";

  return (
    <div className="grid grid-cols-1 gap-5">
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

      {/* o próximo encontro é o motivo de abrir o app: vem logo depois da
          saudação, com uma única ação conforme o estado */}
      <ProximoEncontro
        proximo={proximo}
        rotulo={proximo ? rotuloEncontro(proximo) : null}
        hoje={hoje}
        agendar={agendar}
        linkEditavel={linkEditavelProximo}
        emCurso={duplaEmCurso}
        concluida={concluida}
        primeiroNome={primeiroNome}
      />

      {/* pendência da grade — some quando a pessoa preenche (sem ficha não
          tem onde gravar: a faixa nem promete o gesto) */}
      {gradeVazia && <LembreteDisponibilidade />}

      <JovemParaFazer
        pendentes={avaliacoesPendentes}
        combinado={combinado}
        hoje={hoje}
        primeiroNome={primeiroNome}
      />

      {/* canal de segurança sempre à mão, sem competir com o encontro: uma
          linha discreta logo abaixo do que fazer agora */}
      <PedirAjudaLinha waCoord={waCoord} />

      {(temDpp || feitosEsp > 0) && (
        <section
          aria-labelledby="jornada-titulo"
          className="animate-enter space-y-2.5"
          style={{ "--i": 2 } as CSSProperties}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="jornada-titulo" className="font-semibold">
              Sua jornada
            </h2>
            <Link
              href="/jovem/materiais"
              className="group inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver jornada
              <ArrowRight
                size={14}
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
          <div
            role="progressbar"
            aria-label={jornadaTexto}
            aria-valuemin={0}
            aria-valuemax={jornadaMeta}
            aria-valuenow={jornadaAtual}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="fill-grow h-full rounded-full bg-[var(--destaque)]"
              style={{ width: `${jornadaPct}%` }}
            />
          </div>
          <p className="text-sm">{jornadaTexto}</p>
        </section>
      )}

      {/* Minha dupla — os adultos que caminham com o jovem. Lista compacta:
          uma linha por pessoa e WhatsApp com alvo de 44px. */}
      <section aria-labelledby="dupla-titulo">
        <h2 id="dupla-titulo" className="mb-2.5 flex items-center gap-2 font-semibold">
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
          <Card className="animate-enter">
            <CardContent className="space-y-3 px-4 py-2">
              {duplaAtual.status === "pausada" && (
                <p className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm">
                  <span className="font-medium">Mentoria pausada.</span> A
                  coordenação retoma quando for a hora. Seus contatos seguem
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
                    key={`${c.papel}-${c.id ?? c.nome}`}
                    c={c}
                    papel="Seu mentor"
                    nomeJovem={nomeTela}
                  />
                ))}
                {especialistas.map((c) => (
                  <ContatoLinha
                    key={`${c.papel}-${c.id ?? c.nome}`}
                    c={c}
                    papel="Seu especialista"
                    nomeJovem={nomeTela}
                  />
                ))}
                {supervisores.map((c) => (
                  <ContatoLinha
                    key={`${c.papel}-${c.id ?? c.nome}`}
                    c={c}
                    papel="Auxiliar executivo(a) da dupla"
                    nomeJovem={nomeTela}
                  />
                ))}
                {coordenacao.map((c) => (
                  <ContatoLinha
                    key={`${c.papel}-${c.id ?? c.nome}`}
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

      {/* Especialistas: só quando pede ação (sugestão, negociação ou sessão
          sem horário). O catálogo segue no menu. */}
      <JovemEspecialistas
        disponivel={perfil != null}
        solicitacoes={pedidosEsp.solicitacoes}
        trilha={trilhaResumo}
      />

      {/* Suas avaliações (0071) — as pendentes e as duas últimas respondidas;
          o resto recolhe em "Ver todas as avaliações" dentro do componente */}
      {(avaliacoesPendentes.length > 0 || avaliacoesFeitas.length > 0) && (
        <section aria-labelledby="avaliacoes-titulo">
          <h2 id="avaliacoes-titulo" className="mb-2.5 flex items-center gap-2 font-semibold">
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

      {/* Combinados — a lista que o jovem controla: abertos à vista, feitos
          recolhidos */}
      <section aria-labelledby="combinados-titulo">
        <h2 id="combinados-titulo" className="mb-2.5 flex items-center gap-2 font-semibold">
          <ListChecks size={18} className="text-muted-foreground" aria-hidden />
          Meus combinados
        </h2>
        <Card className="animate-enter">
          <CardContent className="px-4 py-0 sm:px-5">
            <JovemCombinados itens={encaminhamentos} hoje={hoje} />
          </CardContent>
        </Card>
      </section>

      {/* Documentos pra assinar — o termo é do jovem; a autorização vai pro
          responsável (link tokenizado funciona logado ou não, 0070). O que
          está pendente fica à vista; o resto recolhe numa linha. */}
      <section aria-labelledby="docs-titulo">
        <h2 id="docs-titulo" className="mb-2.5 flex items-center gap-2 font-semibold">
          <Signature size={18} className="text-muted-foreground" aria-hidden />
          Documentos
        </h2>
        <Card className="animate-enter">
          <CardContent className="p-0">
            {assinaturas.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Nenhum documento por enquanto. Quando a coordenação emitir o
                seu termo ou a autorização do responsável, eles chegam aqui.
              </p>
            ) : (
              <>
                {docsPendentes.length > 0 && (
                  <div className="divide-y divide-border/60">
                    {docsPendentes.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                        <div className="min-w-0 flex-1 basis-48">
                          <p className="text-sm font-medium">{a.titulo}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {a.slug === "autorizacao-responsavel"
                              ? "Quem assina é seu responsável. Encaminhe o link."
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
                  </div>
                )}

                {docsRecolhidos.length > 0 && (
                  <details className={cn("group", docsPendentes.length > 0 && "border-t border-border/60")}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                      {docsPendentes.length > 0
                        ? `Ver outros documentos (${docsRecolhidos.length})`
                        : `Ver documentos (${docsRecolhidos.length})`}
                      <CaretDown
                        size={16}
                        aria-hidden
                        className="shrink-0 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="divide-y divide-border/60 border-t border-border/60">
                      {docsAssinados.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
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
                        <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
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
                    </div>
                  </details>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Avisos da coordenação (audiência 'todos' — a RLS já entrega só o
          que o jovem pode ler). Urgente e importante ficam à vista; os
          comuns recolhem numa linha. */}
      {avisos.length > 0 && (
        // id="avisos": a notificação do aviso aponta pra "/#avisos" — o
        // redirect do (app) devolve pra cá e o fragmento ancora na seção
        <section id="avisos" aria-labelledby="avisos-titulo">
          <h2 id="avisos-titulo" className="mb-2.5 flex items-center gap-2 font-semibold">
            <Megaphone size={18} className="text-muted-foreground" aria-hidden />
            Avisos
          </h2>
          <Card className="animate-enter">
            <CardContent className="p-0">
              {avisosDestacados.map(renderAviso)}
              {avisosComuns.length > 0 && (
                <details
                  className={cn(
                    "group",
                    avisosDestacados.length > 0 && "border-t border-border/60"
                  )}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                    {avisosDestacados.length > 0
                      ? `Ver outros avisos (${avisosComuns.length})`
                      : avisosComuns.length === 1
                        ? "1 aviso da coordenação"
                        : `${avisosComuns.length} avisos da coordenação`}
                    <CaretDown
                      size={16}
                      aria-hidden
                      className="shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="divide-y divide-border/60 border-t border-border/60">
                    {avisosComuns.map(renderAviso)}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Materiais oficiais — idem: só 'todos' chega pelo RLS, e o gate
          progressivo (REALIZA-160) segura o que é de encontro futuro. Até três
          itens; o resto fica em "Ver todos". */}
      {materiaisVisiveis.length > 0 && (
        <section aria-labelledby="materiais-titulo">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 id="materiais-titulo" className="flex items-center gap-2 font-semibold">
              <FolderOpen size={18} className="text-muted-foreground" aria-hidden />
              Materiais do programa
            </h2>
            <Link
              href="/jovem/materiais"
              className="group inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
              {materiaisVisiveis.slice(0, 3).map((m) => {
                const Icone = TIPO_ICONE_MATERIAL[m.tipo];
                const href = m.path ? `/api/material/${m.id}` : linkSeguro(m.url);
                const interno = (
                  <>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
                      <Icone size={15} aria-hidden />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {m.titulo}
                    </p>
                  </>
                );
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center pr-4 transition-colors",
                      href && "hover:bg-muted/50"
                    )}
                  >
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir ${m.titulo}`}
                        title={m.titulo}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        {interno}
                      </a>
                    ) : (
                      <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-4 py-2">
                        {interno}
                      </div>
                    )}
                    {href && (
                      <ArrowSquareOut
                        size={15}
                        className="shrink-0 text-muted-foreground"
                        aria-hidden
                      />
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
          A coordenação ainda não vinculou sua conta à ficha de mentorado. Se
          isso não se resolver em alguns dias, use o “Precisa de ajuda?” acima.
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
    <li className="flex items-center gap-2 py-0.5">
      <Link
        href={`/jovem/pessoas/${c.id}`}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar
          nome={c.nome_social || c.nome || "?"}
          src={c.avatar_path ? avatarPublicUrl(c.avatar_path) : null}
          size={32}
        />
        <p className="min-w-0 text-sm">
          <span className="font-medium">{c.nome_social || c.nome}</span>
          <span className="text-muted-foreground"> · {papel}</span>
        </p>
      </Link>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          aria-label={`Conversar com ${c.nome_social || c.nome} no WhatsApp (abre em nova aba)`}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "shrink-0"
          )}
        >
          <WhatsappLogo size={18} aria-hidden />
        </a>
      )}
    </li>
  );
}
