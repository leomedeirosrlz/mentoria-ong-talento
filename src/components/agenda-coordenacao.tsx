import Link from "next/link";
import { Eye } from "@phosphor-icons/react/dist/ssr";
import {
  itensDaSemanaPrograma,
  numerosDaSemana,
  paraAcompanhar,
  resumosPorCronograma,
  sinteseMonitoramento,
  type MotivoAcompanhar,
} from "@/lib/agenda-coordenacao";
import { semanaBounds } from "@/lib/ciclo";
import { turmaLonga } from "@/lib/turma";
import { rotuloDiaAgenda } from "@/lib/agenda-minha";
import { msgsContato } from "@/lib/whatsapp-msgs";
import type { Interacao } from "@/lib/interacoes";
import type { CicloEvento, Cronograma, Dupla, Supervisao } from "@/lib/types";
import { FilaAcompanhar, type LinhaFila } from "@/components/fila-acompanhar";
import { NumerosSemanaSecao } from "@/components/numeros-semana";
import { SemanaDoPrograma } from "@/components/semana-do-programa";
import { lembreteDaDupla, mesLongo, semanaIso } from "@/components/agenda-partes";

/** Visão "Monitoramento" da coordenação (REALIZA-195 · mock v8b): faixa
 *  de síntese no topo (a leitura de 2s da fila), a faixa "Semana do
 *  programa" (os oficiais do seg–dom em cards de scroll lateral), os
 *  "Números da semana" (cobertura honesta por turma + semáforo com o
 *  eixo azul do apoio + pulso de registro com a ★ do jovem) e, por
 *  último, o "Painel da semana" — a fila operacional "Para acompanhar"
 *  com chips que filtram de verdade. A coordenação NÃO agenda por
 *  ninguém: a única ação sobre dupla aqui é o nudge. Toda a derivação
 *  mora em lib/agenda-coordenacao (pura); a página é quem busca os
 *  dados — este componente só compõe e renderiza. */
export function AgendaCoordenacao({
  duplas,
  eventos,
  cronogramas,
  nudges,
  supervisoes,
  encerramentosPendentes,
  meuNome,
  hoje,
  agora: agoraMs,
}: {
  /** Todas as duplas do ciclo (RLS da coordenação). */
  duplas: Dupla[];
  eventos: CicloEvento[];
  cronogramas: Cronograma[];
  /** getUltimasInteracoes — a lib filtra a tipo 'nudge' pro cap de 48h. */
  nudges: Record<string, Interacao>;
  /** Supervisões recentes — a lib recorta a semana corrente. */
  supervisoes: Supervisao[];
  /** dupla_ids com rito de encerramento aberto (getEncerramentosPendentes)
   *  — a dupla concluída vira linha "concluir na ficha" na fila. */
  encerramentosPendentes: ReadonlySet<string>;
  meuNome?: string;
  /** "YYYY-MM-DD" de hoje em São Paulo. */
  hoje: string;
  /** epoch ms do mesmo "agora" da page — semáforo/limbo/cap ancoram no
   *  snapshot do request, não num segundo `new Date()` do RSC. */
  agora: number;
}) {
  const agora = new Date(agoraMs);
  const { seg, dom } = semanaBounds(agora);
  const resumos = resumosPorCronograma(duplas, cronogramas, eventos, agora);
  const acompanhar = paraAcompanhar(
    duplas,
    eventos,
    nudges,
    agora,
    encerramentosPendentes
  );
  const programa = itensDaSemanaPrograma(
    eventos,
    cronogramas,
    supervisoes,
    agora,
    // meta "N duplas — cada uma marca a sua": a coorte inteira que o
    // RLS da coordenação enxerga
    duplas
  );
  const numeros = numerosDaSemana(
    duplas,
    acompanhar,
    cronogramas,
    eventos,
    agora,
    agoraMs
  );
  const duplasPorId = new Map(duplas.map((d) => [d.id, d]));
  const rotuloHoje = rotuloDiaAgenda(hoje);
  const sintese =
    acompanhar.length > 0
      ? sinteseMonitoramento(acompanhar, resumos, duplas, eventos, agora)
      : null;
  // as linhas saem daqui já prontas pra boundary client da fila: destino,
  // rótulo, texto do lembrete e telefone resolvem no server — Dupla/
  // CicloEvento não cruzam pra lá
  const linhas: LinhaFila[] = acompanhar.map((item) => {
    const dupla = duplasPorId.get(item.duplaId);
    // o caso que assina a mensagem: registro > limbo > atraso > sem data —
    // prioridade própria do lembrete, não a ordem que a lib escolheu
    const caso: MotivoAcompanhar = item.motivos.includes("registro_pendente")
      ? "registro_pendente"
      : item.motivos.includes("limbo")
        ? "limbo"
        : item.motivos.includes("atraso")
          ? "atraso"
          : "sem_data";
    // pedido de apoio que partiu do JOVEM: o domínio diz "chamar o jovem,
    // nunca o mentor" — pode ser sobre o próprio mentor. Destino, rótulo
    // ("Chamar", não cobrança), texto e telefone trocam de ponta.
    const apoioDoJovem =
      item.saude.apoio.aberto &&
      (item.saude.apoio.origem === "mentorado" ||
        item.saude.apoio.origem === "ambos");
    // encerramento pendente: a pendência é da coordenação — a fila desenha
    // o CTA "Concluir rito" (link pra ficha) no lugar do LembreteButton
    const acaoFicha = item.motivos.includes("encerramento");
    return {
      item,
      destino: apoioDoJovem ? "mentorado" : "mentor",
      rotulo: apoioDoJovem ? "Chamar" : item.rotuloLembrete,
      lembrete: acaoFicha
        ? { titulo: "", corpo: "" } // sem nudge — o CTA é o link da ficha
        : apoioDoJovem
          ? {
              titulo: "A equipe quer te ouvir",
              corpo:
                msgsContato("apoio_jovem", {
                  mentoradoNome:
                    dupla?.mentorado?.nome_social || dupla?.mentorado?.nome,
                  autorNome: meuNome,
                }).mentorado ?? "",
            }
          : dupla
            ? lembreteDaDupla(dupla, caso, eventos, meuNome, agora)
            : { titulo: "Lembrete da equipe", corpo: "" },
      telefone: apoioDoJovem
        ? (dupla?.mentorado?.whatsapp ?? null)
        : (dupla?.mentor?.whatsapp ?? null),
      acao: acaoFicha ? ("ficha" as const) : ("lembrete" as const),
    };
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agenda do programa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Semana {semanaIso(hoje)} · {Number(seg.slice(8, 10))} a{" "}
            {Number(dom.slice(8, 10))} de {mesLongo(dom)} · hoje,{" "}
            {rotuloHoje.charAt(0).toLowerCase() + rotuloHoje.slice(1)}
          </p>
        </div>
        {/* o sbox "Você vê/NÃO vê" do mock foi cortado no desenho — fica
            só a etiqueta discreta da postura */}
        <p className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Eye size={14} aria-hidden />
          Monitoramento — a agenda de cada dupla é da dupla
        </p>
      </header>

      {/* faixa de síntese — leitura de 2s do estado da fila antes dos cards.
          Só existe com fila viva (o empty state lá embaixo já cobre o "tudo
          em dia"); o único número com peso é o de críticas */}
      {sintese && (
        <p
          role="note"
          aria-label="Síntese do monitoramento"
          className="text-xs leading-relaxed text-muted-foreground"
        >
          <b className="font-semibold text-foreground">
            {sintese.total} para acompanhar
          </b>
          {" · "}
          <b
            className={
              sintese.criticas > 0
                ? "font-semibold text-destructive"
                : "font-medium"
            }
          >
            {sintese.criticas}{" "}
            {sintese.criticas === 1 ? "crítica" : "críticas"}
          </b>
          {sintese.atencao > 0 && ` · ${sintese.atencao} atenção`}
          {/* "sem agendamento" aqui = denominador das linhas-resumo
              (semAgendamento), não o motivo sem_data da fila — o rótulo
              casa com o "N sem agendamento" delas pra não parecer o mesmo
              número do chip do filtro */}
          {sintese.semData > 0 && ` · ${sintese.semData} sem agendamento`}
          {sintese.registrosPendentes > 0 &&
            ` · ${sintese.registrosPendentes} ${
              sintese.registrosPendentes === 1
                ? "registro pendente"
                : "registros pendentes"
            }`}
          {sintese.lembretesEm48h > 0 &&
            ` · ${sintese.lembretesEm48h} ${
              sintese.lembretesEm48h === 1 ? "lembrete" : "lembretes"
            } em 48h`}
          {/* pedidos de apoio contam TODAS as duplas vivas — o sinal mais
              urgente da tela, e a fila dele é /chamados (uma dupla "em
              dia" com pedido aberto não aparece em "para acompanhar") */}
          {sintese.apoioAberto > 0 && (
            <>
              {" · "}
              <Link
                href="/chamados"
                className="-my-1 py-1 font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-primary"
              >
                {sintese.apoioAberto}{" "}
                {sintese.apoioAberto === 1
                  ? "pedido de apoio"
                  : "pedidos de apoio"}
              </Link>
            </>
          )}
        </p>
      )}

      {/* ---- Semana do programa (v8b): os oficiais do seg–dom em cards
          de scroll lateral — tema, instrumentos e "o que cobre" atrás de
          <details>; "Abrir chamada" só no dia da formação (gate no card) ---- */}
      <SemanaDoPrograma
        itens={programa}
        hoje={hoje}
        modo="coord"
        // "Abrir chamada" é dela — o painel de presença só existe no
        // calendário da coordenação (ehCoord)
        podeChamada
        titulo="Semana do programa"
        ariaLabel="Semana do programa"
        nota="O que a semana cobra — cada card abre o dia no calendário."
      />

      {/* ---- Números da semana (v8b): cobertura honesta por encontro +
          semáforo com apoio em eixo separado + pulso com a ★ do jovem.
          O toggle T1/T2/Todas é estado próprio da seção ---- */}
      <NumerosSemanaSecao opcoes={numeros.opcoes} agregados={numeros.agregados} />

      {/* ---- Painel da semana: a fila operacional — a pergunta dos 5s,
          quem pede ação. Chips filtram de verdade (FilaAcompanhar). ---- */}
      <section aria-label="Painel da semana">
        <h2 className="text-base font-semibold">Painel da semana</h2>
        <p className="mt-1.5 max-w-[78ch] text-xs leading-relaxed text-muted-foreground">
          {resumos.length > 1 ? (
            <>
              As turmas não começaram juntas — na mesma semana,{" "}
              {resumos.map((r, i) => (
                <span key={r.cronogramaId}>
                  {i > 0 && (i === resumos.length - 1 ? " e " : ", ")}
                  <b className="font-medium text-foreground">
                    {turmaLonga(r.turma)} está no encontro{" "}
                    {r.eventoNumero ?? "—"}
                  </b>
                </span>
              ))}
              . Por isso os números acima são por turma, nunca misturados.
            </>
          ) : (
            "A operação da semana — quem pede atenção primeiro."
          )}
        </p>

        <div className="mt-4" role="group" aria-label="Duplas para acompanhar">
          <h3 className="text-sm font-semibold">
            Para acompanhar{" "}
            <span className="font-normal text-muted-foreground">
              · {acompanhar.length}
            </span>
          </h3>
          <p className="mt-1.5 max-w-[78ch] text-xs leading-relaxed text-muted-foreground">
            Sem agendamento ou atrasadas.{" "}
            <b className="font-medium text-foreground">Lembrar</b> envia um
            aviso à dupla (notificação + WhatsApp se houver) — a coordenação
            não marca o encontro por ela.
          </p>
          {acompanhar.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Tudo em dia — nenhuma dupla pede atenção.
            </p>
          ) : (
            <FilaAcompanhar linhas={linhas} />
          )}
        </div>
      </section>
    </div>
  );
}
