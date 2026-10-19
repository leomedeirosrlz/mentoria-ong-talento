import { Check, Circle, Clock, Quotes } from "@phosphor-icons/react/dist/ssr";
import { formatDateTime, passoEsp } from "@/lib/ciclo";
import { stepperCicloDeVida } from "@/lib/jovem-especialista";
import type {
  Devolutiva,
  Dupla,
  JovemDupla,
  SolicitacaoEspecialista,
} from "@/lib/types";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EstadoPasso = "feito" | "marcado" | "a_confirmar" | "furou" | "futuro";

/** Estado do passo pro jovem — sem o conceito de registro (o registro é do
 *  mentor). O nº gravado é a tentativa: o passo é o rank entre realizados
 *  (passoEsp, 0074) e o nó mostra a última cartada. */
function estadoPasso(
  encontros: JovemEncontro[],
  passo: number,
  agoraMs: number
): { estado: EstadoPasso; encontro: JovemEncontro | null } {
  let alvo: JovemEncontro | null = null;
  for (const e of encontros) {
    if (passoEsp(e, encontros) !== passo) continue;
    if (
      !alvo ||
      e.status === "realizado" ||
      (alvo.status !== "realizado" && e.numero > alvo.numero)
    ) {
      alvo = e;
    }
  }
  if (!alvo) return { estado: "futuro", encontro: null };
  if (alvo.status === "realizado") return { estado: "feito", encontro: alvo };
  if (
    alvo.status === "agendado" &&
    alvo.data_hora != null &&
    new Date(alvo.data_hora).getTime() < agoraMs
  ) {
    return { estado: "a_confirmar", encontro: alvo };
  }
  if (alvo.status === "agendado" || alvo.status === "remarcado") {
    return { estado: "marcado", encontro: alvo };
  }
  return { estado: "furou", encontro: alvo };
}

const DOT: Record<EstadoPasso, string> = {
  feito: "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
  marcado: "ring-1 ring-inset ring-muted-foreground/60 text-muted-foreground",
  a_confirmar: "ring-2 ring-inset ring-[var(--warn)]/70 text-[var(--warn-text)]",
  furou: "bg-muted text-muted-foreground/50 line-through",
  futuro: "bg-muted text-muted-foreground",
};

const SR_ESTADO: Record<EstadoPasso, string> = {
  feito: "aconteceu",
  marcado: "marcada",
  a_confirmar: "a confirmar",
  furou: "não aconteceu",
  futuro: "a caminho",
};

/** Trilha de especialista do jovem (WP6): quem é o especialista, o stepper
 *  dos 5 passos do guia e o feed de devolutivas que a trilha devolve ao
 *  longo do percurso (0086). Nas trilhas encerradas a devolutiva final é o
 *  motivo_encerramento/devolutiva_pdm — o card mostra o desfecho igual. */
export function JovemTrilhaCard({
  dupla,
  solicitacao,
  passos,
  encontros,
  devolutivas,
  agoraMs,
}: {
  dupla: JovemDupla;
  /** A solicitação que originou a trilha (resolvida pela página — a view
   *  jovem_duplas não carrega solicitacao_id). Alimenta o stepper de ciclo
   *  de vida; null = trilha sem pedido à vista (dado antigo/staff). */
  solicitacao?: SolicitacaoEspecialista | null;
  passos: { numero: number; titulo: string; foco: string | null }[];
  encontros: JovemEncontro[];
  devolutivas: Devolutiva[];
  /** o "agora" vem da página (server component) — fixado uma vez por
   *  request, como a agenda faz */
  agoraMs: number;
}) {
  const nome = dupla.mentor_nome_social || dupla.mentor_nome || "Especialista";
  const daTrilha = encontros.filter((e) => e.dupla_id === dupla.id);
  const feed = devolutivas.filter((v) => v.dupla_id === dupla.id);
  const encerrada =
    dupla.status === "concluida" ||
    dupla.status === "encerrada" ||
    dupla.encerrada_em != null;
  const ativa = !encerrada;
  const feitos = passos.filter(
    (p) => estadoPasso(daTrilha, p.numero, agoraMs).estado === "feito"
  ).length;
  const proximoPasso = ativa
    ? (passos.find(
        (p) =>
          estadoPasso(daTrilha, p.numero, agoraMs).estado !== "feito"
      )?.numero ?? null)
    : null;

  // a view jovem_duplas é achatada (sem a árvore encontros/mentor que o
  // tipo Dupla carrega) — o stepper de ciclo de vida lê só
  // status/iniciada_em/encerrada_em, o nome do mentor e numero+status dos
  // encontros, todos à mão aqui: a montagem entrega exatamente isso
  const duplaVida = {
    id: dupla.id,
    status: dupla.status,
    iniciada_em: dupla.iniciada_em,
    encerrada_em: dupla.encerrada_em,
    mentor: {
      nome: dupla.mentor_nome,
      nome_social: dupla.mentor_nome_social,
    },
    encontros: daTrilha,
  } as unknown as Dupla;
  const vida = stepperCicloDeVida({
    solicitacao: solicitacao ?? null,
    dupla: duplaVida,
    hoje: new Date(agoraMs),
  });

  return (
    <Card className="animate-enter">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center gap-3">
          <Avatar
            nome={nome}
            src={
              dupla.mentor_avatar_path
                ? avatarPublicUrl(dupla.mentor_avatar_path)
                : null
            }
            size={40}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={nome}>
              {nome}
            </p>
            <p className="text-xs text-muted-foreground">
              {dupla.demanda ?? "Trilha de especialista"}
            </p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {feitos}/{passos.length} sessões
          </span>
        </div>

        {/* ciclo de vida pedido→trilha (mock v6 ol.life) — vertical no
            mobile, 5 colunas a partir de md; um nó "atual" por vez marca a
            fase onde a trilha está parada */}
        <ol
          className="grid md:grid-cols-5 md:gap-2"
          aria-label="Ciclo de vida da trilha"
        >
          {vida.map((p, i) => (
            <li
              key={i}
              className="relative flex gap-2.5 pb-3 last:pb-0 md:flex-col md:gap-1.5 md:pb-0"
            >
              {i < vida.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-border md:top-[11px] md:right-[-8px] md:bottom-auto md:left-7 md:h-0.5 md:w-auto"
                />
              )}
              <span
                className={cn(
                  "z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 border-border bg-card text-xs font-extrabold text-muted-foreground",
                  p.estado === "feito" &&
                    "border-[var(--ok)] bg-[var(--ok)] text-white",
                  p.estado === "atual" &&
                    "border-[var(--brand-ink)] bg-[var(--role-mentorado)] text-[var(--brand-ink)]"
                )}
              >
                {p.estado === "feito" ? (
                  <Check size={13} weight="bold" aria-hidden />
                ) : (
                  <span aria-hidden>{i + 1}</span>
                )}
                <span className="sr-only">
                  {p.rotulo} —{" "}
                  {p.estado === "feito"
                    ? "concluído"
                    : p.estado === "atual"
                      ? "em andamento"
                      : "a caminho"}
                </span>
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm leading-snug font-medium",
                    p.estado === "futuro" && "text-muted-foreground"
                  )}
                >
                  {p.rotulo}
                </p>
                {p.data && (
                  <p className="text-xs text-muted-foreground">{p.data}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {/* stepper das sessões — mesma gramática dos dots da TrilhaJornada,
            sem o estado "registro pendente" (o registro é interno do
            especialista) */}
        <ol className="flex items-start" aria-label="Passos da trilha">
          {passos.map((p, i) => {
            const { estado, encontro } = estadoPasso(
              daTrilha,
              p.numero,
              agoraMs
            );
            const atual = ativa && p.numero === proximoPasso;
            return (
              <li
                key={p.numero}
                className={cn(
                  "relative flex flex-col items-center gap-1.5",
                  i < passos.length - 1 && "flex-1"
                )}
              >
                {i < passos.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-[13px] h-px w-full bg-border"
                  />
                )}
                <span
                  title={`${p.titulo} — ${SR_ESTADO[estado]}`}
                  className={cn(
                    "relative z-10 grid size-7 place-items-center rounded-full text-[11px] font-semibold",
                    DOT[estado],
                    atual && "ring-2 ring-[var(--brand-lime)] ring-offset-2 ring-offset-background"
                  )}
                >
                  {estado === "feito" ? (
                    <Check size={13} weight="bold" aria-hidden />
                  ) : (
                    <span aria-hidden>{i + 1}</span>
                  )}
                  <span className="sr-only">
                    {p.titulo} — {SR_ESTADO[estado]}
                  </span>
                </span>
                <span
                  className={cn(
                    "max-w-24 text-center text-[10px] leading-tight",
                    estado === "futuro"
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground"
                  )}
                >
                  {p.titulo.split(",")[0]}
                </span>
                {encontro?.data_hora && estado !== "futuro" && (
                  <span className="text-[10px] tabular-nums text-muted-foreground/70">
                    {formatDateTime(encontro.data_hora)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {feed.length > 0 && (
          <div className="border-t border-border/60 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Quotes size={13} aria-hidden />
              Devolutivas da trilha
            </p>
            <ul className="space-y-3">
              {feed.map((v) => (
                <li key={v.id} className="text-sm">
                  <p className="leading-relaxed">{v.texto}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock size={11} aria-hidden />
                    {v.autor?.nome ?? nome} · {formatDateTime(v.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {encerrada && dupla.motivo_encerramento && (
          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {dupla.motivo_encerramento}
          </p>
        )}
        {!encerrada && feed.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Circle size={11} aria-hidden />
            As devolutivas da trilha aparecem aqui conforme as sessões rolam.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
