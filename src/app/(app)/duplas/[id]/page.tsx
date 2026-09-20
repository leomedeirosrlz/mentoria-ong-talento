import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BookOpen,
  CaretDown,
  ClockCounterClockwise,
  HandHeart,
  VideoCamera,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { getCicloEventos, getDupla, getMateriais, getMe } from "@/lib/queries";
import { getAnexosPorRegistros } from "@/lib/anexos";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { DuplaNomes } from "@/components/dupla-nomes";
import { VoltarLink } from "@/components/voltar-link";
import {
  DIFICULDADE_LABEL,
  PROXIMO_PASSO_LABEL,
  alvoAgendamento,
  eventoDaSemana,
  formatDate,
  formatDateTime,
  formatDiaMes,
  jornadaDaDupla,
  saudadeDaDupla,
  toDateStr,
  totalEncontros,
  waLink,
} from "@/lib/ciclo";
import { AvaliacaoBadge, SemaforoBadge } from "@/components/semaforo";
import { NudgeButton } from "@/components/nudge-button";
import { NotaEncontro } from "@/components/nota-encontro";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { EditarDuplaDialog } from "@/components/editar-dupla-dialog";
import { NaoAconteceuButton, DesfazerNaoAconteceuButton } from "@/components/nao-aconteceu-button";
import { RegistroForm } from "@/components/registro-form";
import {
  RegistroInline,
  RegistroInlinePanel,
  RegistroInlineTrigger,
} from "@/components/registro-inline";
import { EditarRegistro } from "@/components/editar-registro";
import { EncaminhamentosList } from "@/components/encaminhamentos-list";
import { RevelarApos } from "@/components/revelar-apos";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import { TrajetoriaAvaliacoes } from "@/components/trajetoria-avaliacoes";
import { TrilhaJornada } from "@/components/trilha-jornada";
import { MarcoNotifier } from "@/components/marco-notifier";
import { AnexosRegistro } from "@/components/anexos-registro";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CicloEvento, Encaminhamento, Encontro, Material, RegistroAnexo } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const dupla = await getDupla(id);
  return {
    title: dupla
      ? `${dupla.mentor.nome} e ${dupla.mentorado.nome} · Realiza.vc`
      : "Dupla · Realiza.vc",
  };
}

export default async function DuplaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dupla, eventos, me, materiais, anexosPorRegistro] = await Promise.all([
    getDupla(id),
    getCicloEventos(),
    getMe(),
    getMateriais(),
    // getDupla é React.cache — a 2ª chamada reusa o mesmo fetch, sem round-trip extra
    getDupla(id).then((d) =>
      getAnexosPorRegistros(
        (d?.encontros ?? []).flatMap((e) => (e.registro ? [e.registro.id] : []))
      )
    ),
  ]);
  if (!dupla || !me) notFound();

  const souMentor = dupla.mentor.id === me.id;
  const souCoord = me.role === "coordenacao";
  const saude = saudadeDaDupla(dupla, eventos);
  const encontroEventos = eventos.filter((e) => e.tipo === "encontro");
  const total = totalEncontros(eventos);
  const { proximoNumero, encontroAlvo, sugeridoProximo, faltantes } =
    alvoAgendamento(dupla, eventos);
  const jornada = jornadaDaDupla(dupla, eventos);

  const primeiroNomeMentor = dupla.mentor.nome.split(" ")[0];
  const primeiroNomeMentorado = dupla.mentorado.nome.split(" ")[0];

  // combinados ainda abertos — alimentam o form de registro e a msg de WhatsApp
  const combinadosPendentes = (dupla.encaminhamentos ?? [])
    .filter((e) => e.status !== "feito")
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
  // registro_id → nº do encontro, pra lista de encaminhamentos dizer de onde veio cada um
  const encontroNumeroPorRegistroId = Object.fromEntries(
    dupla.encontros.flatMap((e) => (e.registro ? [[e.registro.id, e.numero]] : []))
  );

  const msgCombinados =
    `Olá ${primeiroNomeMentorado}! Combinados do nosso último encontro: ` +
    combinadosPendentes
      .map((t, i) => `${i + 1}) ${t.descricao}${t.prazo ? ` (até ${formatDate(t.prazo)})` : ""}`)
      .join(" ") +
    ` — ${primeiroNomeMentor}`;
  const combinadosHref = waLink(dupla.mentorado.whatsapp, msgCombinados);

  // material de apoio por nº de encontro (guia/template daquele encontro)
  const materiaisPorNumero = new Map<number, Material[]>();
  for (const m of materiais) {
    if (m.encontro_num == null) continue;
    const arr = materiaisPorNumero.get(m.encontro_num) ?? [];
    arr.push(m);
    materiaisPorNumero.set(m.encontro_num, arr);
  }

  const hojeStr = toDateStr(new Date());
  const podeRetroativo = souMentor && dupla.status === "ativa" && faltantes.length > 0;

  // encontros depois do oficial da semana ficam colapsados (página tem 16 linhas)
  const numeroSemana = eventoDaSemana(eventos, new Date())?.numero ?? null;
  const encontrosVisiveis = encontroEventos.filter(
    (ev) => numeroSemana == null || ev.numero == null || ev.numero <= numeroSemana
  );
  const encontrosFuturos = encontroEventos.filter(
    (ev) => numeroSemana != null && ev.numero != null && ev.numero > numeroSemana
  );
  // pendência de registro (realizado sem registro ou agendado já vencido) —
  // nunca entra no <details>: o deep link #registrar-{id} precisa sempre existir
  const temPendencia = (enc: Encontro | undefined) =>
    !!enc &&
    !enc.registro &&
    (enc.status === "realizado" ||
      (enc.status === "agendado" &&
        enc.data_hora != null &&
        new Date(enc.data_hora) < new Date()));
  const futurosComPendencia = encontrosFuturos.filter((ev) =>
    temPendencia(dupla.encontros.find((e) => e.numero === ev.numero))
  );
  const encontrosColapsados = encontrosFuturos.filter(
    (ev) => !futurosComPendencia.includes(ev)
  );

  const renderEncontro = (ev: CicloEvento) => {
    const enc = dupla.encontros.find((e) => e.numero === ev.numero);
    return (
      <EncontroRow
        key={ev.id}
        evento={ev}
        encontro={enc ?? null}
        duplaId={dupla.id}
        podeEditar={souMentor && dupla.status === "ativa"}
        podeMarcar={souMentor || souCoord}
        ativa={dupla.status === "ativa"}
        souCoord={souCoord}
        autorId={me.id}
        // evidência: coord anexa em qualquer dupla; mentor só na própria e ativa
        podeEditarAnexos={souCoord || (souMentor && dupla.status === "ativa")}
        anexos={(enc?.registro && anexosPorRegistro[enc.registro.id]) || []}
        materiais={(ev.numero != null && materiaisPorNumero.get(ev.numero)) || []}
        combinadosPendentes={combinadosPendentes}
        nota={dupla.notas?.find((n) => n.numero === ev.numero)?.texto ?? null}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        {/* Voltar contextual: link colado cai em /duplas (o mentor tem lista
            própria agora); vindo de dentro do app retorna à origem real */}
        <VoltarLink fallback="/duplas" />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {/* par de avatares sobrepostos — a dupla como unidade visual (§4);
                cada foto é o link do próprio perfil */}
            <span className="mr-2 inline-flex -space-x-2 align-[-6px]">
              <Link
                href={`/pessoas/${dupla.mentor.id}`}
                aria-label={`Abrir perfil de ${dupla.mentor.nome}`}
                className="relative rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar
                  nome={dupla.mentor.nome}
                  src={dupla.mentor.avatar_path ? avatarPublicUrl(dupla.mentor.avatar_path) : null}
                  fallbackSrc={gravatarUrl(dupla.mentor.email)}
                  size={28}
                  className="ring-2 ring-background"
                />
              </Link>
              <Link
                href={`/pessoas/${dupla.mentorado.id}`}
                aria-label={`Abrir perfil de ${dupla.mentorado.nome}`}
                className="relative rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar
                  papel="mentorado"
                  nome={dupla.mentorado.nome}
                  src={dupla.mentorado.avatar_path ? avatarPublicUrl(dupla.mentorado.avatar_path) : null}
                  size={28}
                  className="ring-2 ring-background"
                />
              </Link>
            </span>
            <DuplaNomes mentor={dupla.mentor.nome} mentorado={dupla.mentorado.nome} />
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SemaforoBadge nivel={saude.semaforo} motivo={saude.motivo} />
            <span className="font-mono">{saude.feitos}/{total} encontros</span>
            <TrajetoriaAvaliacoes encontros={dupla.encontros} />
            {dupla.supervisor && (
              // terciário — não compete em text-sm com o semáforo (§4)
              <span className="text-xs">Supervisor: {dupla.supervisor.nome}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {souCoord && <EditarDuplaDialog dupla={dupla} />}
          {/* nudge é papel de coordenação/supervisão — pro próprio mentor o
              botão abriria conversa consigo mesmo e logaria contato falso */}
          {!souMentor && (
            <NudgeButton
              telefone={dupla.mentor.whatsapp}
              mensagem={`Oi ${dupla.mentor.nome.split(" ")[0]}, tudo bem? Passando pra acompanhar a mentoria com ${dupla.mentorado.nome.split(" ")[0]}. Como estão as coisas?`}
              duplaId={dupla.id}
            />
          )}
          {/* quem agenda é a dupla · coordenação monitora e faz nudge */}
          {souMentor && saude.feitos < total && dupla.status === "ativa" && (
            <AgendarEncontroDialog
              duplaId={dupla.id}
              numero={proximoNumero}
              atual={encontroAlvo}
              sugerido={sugeridoProximo}
              piso={dupla.iniciada_em ?? undefined}
            />
          )}
        </div>
      </header>

      {/* trilha da jornada — visível e read-only pra todos os papéis (é fato,
          não placar); o brinde de marco é só do mentor */}
      <section className="rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)]">
        <TrilhaJornada
          jornada={jornada}
          statusDupla={dupla.status}
          inicioDupla={dupla.iniciada_em}
          duplaId={dupla.id}
        />
      </section>
      {souMentor && (
        <MarcoNotifier duplaId={dupla.id} feitos={jornada.feitos} total={jornada.total} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            {/* rótulo de seção de lista → overline padrão (§3), igual ao
                "Todos os eventos" da agenda. O sufixo carrega o "sugerido"
                uma vez só: as datas das linhas são as do guia do ciclo —
                a dupla confirma ou remarca (a real aparece como "agendado
                {data}" na própria linha) */}
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Encontros
              <span className="font-normal normal-case tracking-normal"> · datas sugeridas pelo guia</span>
            </h2>
            {podeRetroativo && (
              <RegistrarRetroativoDialog
                duplaId={dupla.id}
                faltantes={faltantes}
                trigger={
                  <Button variant="ghost" size="sm" className="-my-1 text-muted-foreground">
                    <ClockCounterClockwise size={14} />
                    Registrar passado
                  </Button>
                }
              />
            )}
          </div>
          {encontrosVisiveis.concat(futurosComPendencia).map(renderEncontro)}
          {encontrosColapsados.length > 0 && (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 py-3 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
                Próximos {encontrosColapsados.length} encontros
                <CaretDown size={14} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3">{encontrosColapsados.map(renderEncontro)}</div>
            </details>
          )}
        </section>

        <aside className="space-y-6">
          <section
            id="encaminhamentos"
            className="scroll-mt-20 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Combinados</h2>
              {souMentor && combinadosPendentes.length > 0 && combinadosHref && (
                <a
                  href={`/api/nudge?d=${dupla.id}&to=${encodeURIComponent(combinadosHref)}&t=contato`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <WhatsappLogo />
                  Enviar combinados
                </a>
              )}
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Tarefas que a dupla combinou nos encontros
              {(souMentor || souCoord) && " — marque quando forem feitas"}.
            </p>
            <EncaminhamentosList
              itens={dupla.encaminhamentos}
              duplaId={dupla.id}
              podeEditar={souMentor || souCoord}
              hoje={hojeStr}
              encontroNumeroPorRegistroId={encontroNumeroPorRegistroId}
            />
          </section>

          <section className="rounded-xl bg-card p-4 text-sm space-y-2 shadow-[var(--shadow-border)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Mentorado
            </h2>
            {/* avatar+nome num link só (padrão da lista de pessoas) */}
            <Link
              href={`/pessoas/${dupla.mentorado.id}`}
              aria-label={`Abrir perfil de ${dupla.mentorado.nome}`}
              className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar
                nome={dupla.mentorado.nome}
                src={dupla.mentorado.avatar_path ? avatarPublicUrl(dupla.mentorado.avatar_path) : null}
                papel="mentorado"
                size={32}
              />
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {!dupla.mentorado.avatar_path && (
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--role-mentorado)]" />
                )}
                <span className="underline-offset-4 transition-colors group-hover:underline">
                  {dupla.mentorado.nome}
                </span>
              </span>
            </Link>
            {dupla.mentorado.ong_origem ? (
              <p className="text-muted-foreground">{dupla.mentorado.ong_origem}</p>
            ) : (
              // dado faltante não imita dado presente — vira nota discreta só
              // pra coordenação, que pode completar o cadastro
              souCoord && (
                <p className="text-xs italic text-muted-foreground/70">
                  sem ONG de origem cadastrada
                </p>
              )
            )}
            {dupla.mentorado.whatsapp &&
              (souMentor || souCoord || me.role === "supervisor") && (
                <NudgeButton
                  telefone={dupla.mentorado.whatsapp}
                  mensagem={
                    souMentor
                      ? `Olá ${primeiroNomeMentorado}! Aqui é ${primeiroNomeMentor}, seu mentor no Programa de Mentoria Social.`
                      : `Oi ${primeiroNomeMentorado}, tudo bem? Aqui é ${me.nome.split(" ")[0]}, da equipe do Realiza.vc. Como está indo a mentoria?`
                  }
                  label="Falar com mentorado"
                  duplaId={dupla.id}
                  t="contato"
                />
              )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function EncontroRow({
  evento,
  encontro,
  duplaId,
  podeEditar,
  podeMarcar,
  ativa,
  souCoord,
  autorId,
  podeEditarAnexos,
  anexos,
  materiais,
  combinadosPendentes,
  nota,
}: {
  evento: CicloEvento;
  encontro: Encontro | null;
  duplaId: string;
  podeEditar: boolean;
  podeMarcar: boolean;
  /** Dupla ativa — badge "sem registro" só aparece quando alguém ainda pode agir. */
  ativa: boolean;
  souCoord: boolean;
  autorId: string;
  podeEditarAnexos: boolean;
  anexos: RegistroAnexo[];
  materiais: Material[];
  combinadosPendentes: Encaminhamento[];
  /** Anotação/plano do mentor pra esse nº do ciclo — null = sem nota. */
  nota: string | null;
}) {
  const feito = encontro?.status === "realizado";
  const naoAconteceu = encontro?.status === "nao_aconteceu";
  const reg = encontro?.registro;
  // realizado sem registro — a dupla deve o follow-up; marca a linha em warn
  // suave. Em dupla pausada/encerrada ninguém pode registrar: a badge e a
  // lavagem viram ruído de algo sem saída e são suprimidas
  const registroPendente = feito && !reg && ativa;
  // realizado_em ≠ data_hora: aconteceu em data diferente da agendada/registrada
  const diverge =
    feito && encontro?.realizado_em != null && encontro.realizado_em !== encontro.data_hora;
  // material do encontro: com destino (arquivo oficial ou url) vira chip; sem, só o título muted
  const material = materiais.find((m) => m.path || m.url) ?? materiais[0] ?? null;
  const materialHref = material?.path
    ? `/api/material/${material.id}`
    : material?.url;
  // a chamada é a ação nº1 na janela do encontro (15 min antes a 2h depois do
  // início) — vira CTA primário; fora da janela fica chip de apoio comum
  const msAteInicio = encontro?.data_hora
    ? new Date(encontro.data_hora).getTime() - new Date().getTime()
    : null;
  const chamadaAgora =
    encontro?.status === "agendado" &&
    msAteInicio != null &&
    msAteInicio <= 15 * 60000 &&
    msAteInicio >= -2 * 3600000;
  // registro feito mais de 3 dias depois do encontro → "registro tardio"
  const aconteceuEm = encontro?.realizado_em ?? encontro?.data_hora ?? null;
  const tardio =
    reg != null &&
    aconteceuEm != null &&
    new Date(reg.created_at).getTime() - new Date(aconteceuEm).getTime() > 3 * 86400000;
  // CTA e form de registro: realizado libera na hora; pros demais status
  // (agendado vencido, não-aconteceu) só depois do horário — RevelarApos cobre
  // a aba que ficou aberta atravessando o encontro, sem depender de re-render
  const liberadoNoHorario = (node: React.ReactNode) =>
    encontro?.status === "realizado"
      ? node
      : encontro?.data_hora
        ? <RevelarApos from={encontro.data_hora}>{node}</RevelarApos>
        : null;
  const podeRegistrar = !!(encontro && !reg && podeEditar);
  // ≤3 ações por linha: status à esquerda, primária da pendência, o resto ghost
  const temAcoes =
    registroPendente ||
    podeRegistrar ||
    (encontro?.status === "agendado" && podeMarcar && !!encontro.data_hora) ||
    (naoAconteceu && podeMarcar) ||
    !!reg?.precisa_apoio;
  // a 1ª cláusula é a data do guia, nua — o "sugerido" mora uma vez no
  // rótulo da seção, não em cada linha. Depois de realizado sem divergência
  // a data oficial é ruído e a meta abre direto no "realizado {data}" (§4).
  // Join com " · " evita separador órfão quando a primeira cláusula some
  const metaEncontro = [
    !(feito && !diverge) && formatDate(evento.data),
    encontro?.data_hora &&
      `${feito && !diverge ? "realizado" : "agendado"} ${formatDateTime(encontro.data_hora)}`,
    diverge && `realizado em ${formatDate(encontro?.realizado_em)}`,
    encontro?.origem === "externo" && "marcado fora da plataforma",
    naoAconteceu && "não aconteceu",
    !materialHref &&
      material &&
      `${material.titulo}${materiais.length > 1 ? ` +${materiais.length - 1}` : ""}`,
    encontro?.motivo_reagendamento && `remarcado: ${encontro.motivo_reagendamento}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const card = (
    <div
      id={encontro ? `registrar-${encontro.id}` : undefined}
      className={cn(
        // border-transparent: a borda fica reservada pro estado de apoio; quem
        // desenha a aresta no estado normal é o anel do shadow-border
        "scroll-mt-20 overflow-hidden rounded-xl border border-transparent bg-card shadow-[var(--shadow-border)]",
        reg?.precisa_apoio && "border-[var(--danger)]/50"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5",
          registroPendente && "bg-[var(--warn)]/5"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span
            className={cn(
              // disco do nº do encontro — mesma gramática da agenda: lime cheio =
              // aconteceu; muted = futuro/agendado; riscado = não aconteceu
              "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums",
              feito
                ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                : naoAconteceu
                  ? "bg-muted text-muted-foreground/60 line-through"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {evento.numero}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-2">{evento.titulo}</p>
            <p className="text-xs text-muted-foreground">{metaEncontro}</p>
            {(encontro?.link || materialHref) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {encontro?.link && (
                  <a
                    href={encontro.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({
                      variant: chamadaAgora ? "default" : "outline",
                      size: "sm",
                    })}
                  >
                    <VideoCamera />
                    Entrar na chamada
                  </a>
                )}
                {materialHref && (
                  <a
                    href={materialHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <BookOpen />
                    Material{materiais.length > 1 ? ` +${materiais.length - 1}` : ""}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
        {temAcoes && (
          // ml-auto ancora as ações à direita do bloco de título mesmo quando o
          // wrap joga o grupo pra linha de baixo no mobile
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {registroPendente && (
              <Badge variant="outline" className="border-[var(--warn)] text-[var(--warn-text)] shrink-0">
                sem registro
              </Badge>
            )}
            {encontro && !reg && podeEditar &&
              liberadoNoHorario(
                <RegistroInlineTrigger encontroId={encontro.id} primario={!naoAconteceu} />
              )}
            {/* o botão só vale depois do horário — RevelarApos faz ele aparecer
                pra quem ficou com a aba aberta atravessando o encontro */}
            {encontro?.status === "agendado" && podeMarcar && encontro.data_hora && (
              <RevelarApos from={encontro.data_hora}>
                <NaoAconteceuButton encontroId={encontro.id} duplaId={duplaId} />
              </RevelarApos>
            )}
            {naoAconteceu && podeMarcar && (
              <DesfazerNaoAconteceuButton encontroId={encontro.id} duplaId={duplaId} />
            )}
            {reg?.precisa_apoio && souCoord && (
              <ResolverApoioButton registroId={reg.id} duplaId={duplaId} />
            )}
            {reg?.precisa_apoio && !souCoord && (
              <Badge variant="outline" className="border-[var(--danger)] text-[var(--danger)] shrink-0">
                <HandHeart size={13} /> apoio solicitado
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* anotações/plano do encontro — o mentor prepara aqui; pra quem não
          edita (coord/sup, dupla inativa) a nota existente vira leitura */}
      {evento.numero != null && (podeEditar || nota) && (
        <div className="border-t px-4 py-2.5">
          <NotaEncontro
            duplaId={duplaId}
            numero={evento.numero}
            nota={nota}
            somenteLeitura={!podeEditar}
          />
        </div>
      )}

      {reg && (
        <div className="border-t bg-muted/40 px-4 py-3.5 text-sm space-y-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              Registrado em {formatDiaMes(reg.created_at)}
              {reg.autor?.nome ? ` por ${reg.autor.nome}` : ""}
            </span>
            {tardio && (
              <Badge
                variant="outline"
                className="border-[var(--warn)]/60 px-1.5 py-0 text-[11px] font-normal text-[var(--warn-text)]"
              >
                registro tardio
              </Badge>
            )}
          </p>
          {(reg.avaliacao || (reg.dificuldade && reg.dificuldade !== "nenhuma")) && (
            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              {reg.avaliacao && <AvaliacaoBadge avaliacao={reg.avaliacao} />}
              {reg.dificuldade && reg.dificuldade !== "nenhuma" && (
                <Badge variant="outline" className="border-[var(--warn)]/60 text-[var(--warn-text)] text-xs">
                  dificuldade: {DIFICULDADE_LABEL[reg.dificuldade]}
                  {reg.dificuldade === "outro" && reg.dificuldade_detalhe
                    ? ` (${reg.dificuldade_detalhe})`
                    : ""}
                </Badge>
              )}
            </div>
          )}
          {reg.atividades.length > 0 && (
            <p>
              <span className="text-muted-foreground">Realizado: </span>
              {reg.atividades.join(", ")}
            </p>
          )}
          {reg.tema && (
            <p>
              <span className="text-muted-foreground">Tema: </span>
              {reg.tema}
              {reg.ferramenta && <span className="text-muted-foreground"> · {reg.ferramenta}</span>}
            </p>
          )}
          {reg.reflexoes && <p className="leading-relaxed">{reg.reflexoes}</p>}
          {reg.proximo_passo && (
            <p>
              <span className="text-muted-foreground">Próximo passo: </span>
              {reg.proximo_passo === "outro" && reg.proximo_passo_detalhe
                ? reg.proximo_passo_detalhe
                : PROXIMO_PASSO_LABEL[reg.proximo_passo]}
            </p>
          )}
          {reg.observacoes && (
            <p className="text-muted-foreground leading-relaxed">Obs: {reg.observacoes}</p>
          )}
          <AnexosRegistro
            registroId={reg.id}
            duplaId={duplaId}
            autorId={autorId}
            podeEditar={podeEditarAnexos}
            anexos={anexos}
          />
          {podeEditar && encontro && (
            <div className="pt-1">
              <EditarRegistro
                encontroId={encontro.id}
                duplaId={duplaId}
                evento={evento}
                registro={reg}
              />
            </div>
          )}
        </div>
      )}

      {encontro && !reg && podeEditar &&
        liberadoNoHorario(
          <RegistroInlinePanel
            encontroId={encontro.id}
            className={cn(
              // região inset do card — mesma gramática do bloco de reg acima;
              // em registro pendente, a lavagem warn da linha continua aqui
              "border-t px-4 py-4",
              registroPendente ? "bg-[var(--warn)]/5" : "bg-muted/40"
            )}
          >
            <RegistroForm
              encontroId={encontro.id}
              duplaId={duplaId}
              evento={evento}
              combinadosPendentes={combinadosPendentes}
            />
          </RegistroInlinePanel>
        )}
    </div>
  );

  // um form de registro aberto por vez: o provider lê o hash #registrar-{id}
  // (mesma âncora do CTA da linha e dos deep-links) e fecha os irmãos
  return encontro && !reg && podeEditar ? (
    <RegistroInline encontroId={encontro.id}>{card}</RegistroInline>
  ) : (
    card
  );
}
