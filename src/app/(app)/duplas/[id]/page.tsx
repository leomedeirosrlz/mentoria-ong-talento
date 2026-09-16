import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, HandHeart } from "@phosphor-icons/react/dist/ssr";
import { getCicloEventos, getDupla, getMe } from "@/lib/queries";
import { formatDate, formatDateTime, saudadeDaDupla } from "@/lib/ciclo";
import { SemaforoBadge } from "@/components/semaforo";
import { NudgeButton } from "@/components/nudge-button";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { RegistroForm } from "@/components/registro-form";
import { EncaminhamentosList } from "@/components/encaminhamentos-list";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function DuplaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dupla, eventos, me] = await Promise.all([getDupla(id), getCicloEventos(), getMe()]);
  if (!dupla || !me) notFound();

  const souMentor = dupla.mentor.id === me.id;
  const souCoord = me.role === "coordenacao";
  const saude = saudadeDaDupla(dupla, eventos);
  const encontroEventos = eventos.filter((e) => e.tipo === "encontro");

  return (
    <div className="space-y-6">
      <div>
        <Link href={souCoord || me.role === "supervisor" ? "/duplas" : "/"} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Voltar
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dupla.mentor.nome} <span className="text-muted-foreground font-normal">e</span>{" "}
            {dupla.mentorado.nome}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SemaforoBadge nivel={saude.semaforo} motivo={saude.motivo} />
            <span className="font-mono">{saude.feitos}/16 encontros</span>
            {dupla.supervisor && <span>Supervisor: {dupla.supervisor.nome}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NudgeButton
            telefone={dupla.mentor.whatsapp}
            mensagem={`Oi ${dupla.mentor.nome.split(" ")[0]}, tudo bem? Passando pra acompanhar a mentoria com ${dupla.mentorado.nome.split(" ")[0]}. Como estao as coisas?`}
          />
          {(souMentor || souCoord) && (
            <AgendarEncontroDialog
              duplaId={dupla.id}
              numero={Math.min(saude.feitos + 1, 16)}
              atual={saude.proximo}
            />
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Timeline dos encontros</h2>
          {encontroEventos.map((ev) => {
            const enc = dupla.encontros.find((e) => e.numero === ev.numero);
            return (
              <EncontroRow
                key={ev.id}
                evento={ev}
                encontro={enc ?? null}
                duplaId={dupla.id}
                podeEditar={souMentor || souCoord}
                souCoord={souCoord}
              />
            );
          })}
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-medium mb-2">Encaminhamentos</h2>
            <EncaminhamentosList
              itens={dupla.encaminhamentos}
              duplaId={dupla.id}
              podeEditar={souMentor || souCoord}
            />
          </section>

          <section className="rounded-xl border bg-card p-4 text-sm space-y-2">
            <h2 className="font-medium">Mentorado(a)</h2>
            <p className="text-muted-foreground">
              {dupla.mentorado.ong_origem ?? "Origem nao informada"}
            </p>
            {dupla.mentorado.whatsapp && (
              <NudgeButton
                telefone={dupla.mentorado.whatsapp}
                mensagem={`Oi ${dupla.mentorado.nome.split(" ")[0]}, tudo bem? Aqui e da equipe do Realiza.vc. Como esta indo a mentoria?`}
                label="Falar com mentorado(a)"
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
  souCoord,
}: {
  evento: { numero: number | null; data: string; titulo: string; fase: string | null; instrumentos: string[] };
  encontro: import("@/lib/types").Encontro | null;
  duplaId: string;
  podeEditar: boolean;
  souCoord: boolean;
}) {
  const feito = encontro?.status === "realizado";
  const reg = encontro?.registro;

  return (
    <div
      id={`registrar-${encontro?.id}`}
      className={cn(
        "rounded-xl border bg-card overflow-hidden",
        reg?.precisa_apoio && "border-[var(--danger)]/50"
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold",
            feito ? "bg-[var(--ok)]/15 text-[var(--ok)]" : "bg-muted text-muted-foreground"
          )}
        >
          {evento.numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{evento.titulo}</p>
          <p className="text-xs text-muted-foreground">
            sugerido {formatDate(evento.data)}
            {encontro?.data_hora && ` · ${feito ? "realizado" : "agendado"} ${formatDateTime(encontro.data_hora)}`}
            {encontro?.origem === "externo" && " · marcado fora da plataforma"}
            {encontro?.status === "nao_aconteceu" && " · nao aconteceu"}
          </p>
        </div>
        {feito && !reg && (
          <Badge variant="outline" className="border-[var(--warn)] text-[var(--warn)] shrink-0">
            sem registro
          </Badge>
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

      {reg && (
        <div className="border-t bg-muted/40 px-4 py-3.5 text-sm space-y-2">
          {reg.tema && (
            <p>
              <span className="text-muted-foreground">Tema: </span>
              {reg.tema}
              {reg.ferramenta && <span className="text-muted-foreground"> · {reg.ferramenta}</span>}
            </p>
          )}
          {reg.reflexoes && <p className="leading-relaxed">{reg.reflexoes}</p>}
          {reg.observacoes && (
            <p className="text-muted-foreground leading-relaxed">Obs: {reg.observacoes}</p>
          )}
        </div>
      )}

      {encontro && !reg && podeEditar && (
        <div className="border-t px-4 py-4">
          <RegistroForm encontroId={encontro.id} duplaId={duplaId} evento={evento as never} />
        </div>
      )}
    </div>
  );
}
