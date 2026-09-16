import Link from "next/link";
import { eventoDaSemana, formatDateTime, saudadeDaDupla, type Semaforo } from "@/lib/ciclo";
import type { CicloEvento, Dupla, Profile } from "@/lib/types";
import { SemaforoBadge, SemaforoDot } from "@/components/semaforo";
import { NudgeButton } from "@/components/nudge-button";
import { Card, CardContent } from "@/components/ui/card";

const ORDEM: Record<Semaforo, number> = { risco: 0, atencao: 1, ok: 2 };

export function DashboardCoordenacao({
  duplas,
  eventos,
  me,
  supervisor = false,
}: {
  duplas: Dupla[];
  eventos: CicloEvento[];
  me: Profile;
  supervisor?: boolean;
}) {
  const hoje = new Date();
  const evento = eventoDaSemana(eventos, hoje);

  const saude = duplas
    .filter((d) => d.status === "ativa")
    .map((d) => ({ dupla: d, saude: saudadeDaDupla(d, eventos, hoje) }))
    .sort((a, b) => ORDEM[a.saude.semaforo] - ORDEM[b.saude.semaforo]);

  const risco = saude.filter((s) => s.saude.semaforo === "risco").length;
  const atencao = saude.filter((s) => s.saude.semaforo === "atencao").length;
  const semRegistro = saude.filter((s) => s.saude.registroPendente).length;
  const pedidosApoio = saude.filter((s) => s.saude.pediuApoio).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {supervisor ? "Suas duplas" : "Visao do ciclo"}
        </h1>
        {evento && (
          <p className="text-sm text-muted-foreground mt-1">
            Semana do <span className="font-medium text-foreground">{evento.numero}o encontro</span>
            {evento.fase ? ` · ${evento.fase}` : ""} · {evento.titulo}
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Duplas ativas" valor={saude.length} />
        <Stat label="Em risco" valor={risco} destaque={risco > 0 ? "danger" : undefined} />
        <Stat label="Em atencao" valor={atencao} destaque={atencao > 0 ? "warn" : undefined} />
        <Stat label="Registros pendentes" valor={semRegistro} destaque={semRegistro > 0 ? "warn" : undefined} />
      </div>

      {pedidosApoio > 0 && (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-sm">
          <span className="font-medium">{pedidosApoio} pedido(s) de apoio</span>
          <span className="text-muted-foreground"> sinalizado(s) por mentores nos registros.</span>
        </div>
      )}

      <section className="space-y-3">
        {saude.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma dupla ativa ainda.{" "}
              <Link href="/pessoas" className="underline">Cadastre pessoas</Link> e monte as duplas.
            </CardContent>
          </Card>
        )}

        {saude.map(({ dupla, saude }) => (
          <DuplaCard key={dupla.id} dupla={dupla} saude={saude} />
        ))}
      </section>
    </div>
  );
}

function Stat({ label, valor, destaque }: { label: string; valor: number; destaque?: "warn" | "danger" }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 font-mono text-2xl font-semibold tracking-tight " +
          (destaque === "danger" ? "text-[var(--danger)]" : destaque === "warn" ? "text-[var(--warn)]" : "")
        }
      >
        {valor}
      </p>
    </div>
  );
}

function DuplaCard({ dupla, saude }: { dupla: Dupla; saude: ReturnType<typeof saudadeDaDupla> }) {
  const encontroAtual = dupla.encontros.filter((e) => e.status === "realizado").length;
  const msg = `Oi ${primeiroNome(dupla.mentor.nome)}, tudo bem? Passando pra acompanhar a mentoria com ${primeiroNome(dupla.mentorado.nome)}. ${
    saude.semaforo === "ok"
      ? "Como estao os proximos encontros?"
      : `Vi que temos um ponto de atencao: ${saude.motivo.toLowerCase()}. Posso ajudar em algo?`
  }`;

  return (
    <Link
      href={`/duplas/${dupla.id}`}
      className="block rounded-xl border bg-card p-4 transition-colors hover:border-[var(--brand-teal)]/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <SemaforoDot nivel={saude.semaforo} />
            <p className="font-medium truncate">
              {dupla.mentor.nome} <span className="text-muted-foreground font-normal">e</span>{" "}
              {dupla.mentorado.nome}
            </p>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {saude.motivo}
            {saude.proximo && saude.semaforo !== "ok" && (
              <> · proximo: {formatDateTime(saude.proximo.data_hora)}</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {encontroAtual}/16 encontros
          </span>
          <div onClick={(e) => e.preventDefault()}>
            <NudgeButton telefone={dupla.mentor.whatsapp} mensagem={msg} label="Nudge" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function primeiroNome(nome: string) {
  return nome.split(" ")[0];
}
