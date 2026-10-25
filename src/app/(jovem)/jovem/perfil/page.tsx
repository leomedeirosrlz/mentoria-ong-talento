import { CaretDown, MapPin } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { getJovemPerfil } from "@/lib/queries-jovem";
import { getMe } from "@/lib/queries";
import { getChamados, getChamadoDetalhe } from "@/lib/queries-chamados";
import { JovemChamados } from "@/components/jovem-chamados";
import { ESCOLARIDADE_LABELS, papelLabel } from "@/lib/ciclo";
import type { Escolaridade } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { PessoaBanner } from "@/components/pessoa-banner";
import { Linha } from "@/app/(app)/perfil/perfil-form";
import { ContaSecao, DadosSecao, DisponibilidadeCard } from "./perfil-form";
import { PrivacidadeCard } from "./privacidade-card";
import type { Disponibilidade } from "@/lib/types";

export const metadata = { title: "Meu perfil" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JovemPerfil({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const [me, perfil, meusChamados] = await Promise.all([
    getMe(),
    getJovemPerfil(),
    getChamados(),
  ]);
  if (!me) redirect("/login"); // o layout já barra — convenção das páginas
  const cSel = c && UUID_RE.test(c) ? c : null;
  const detalhe = cSel ? await getChamadoDetalhe(cSel) : null;

  const nomeTela = me.nome_social || me.nome;
  const escolaridadeRotulo = perfil?.escolaridade
    ? (ESCOLARIDADE_LABELS[perfil.escolaridade as Escolaridade] ??
      perfil.escolaridade)
    : null;
  const meta = [
    perfil?.ong_origem?.trim() || null,
    me.cidade && me.uf
      ? `${me.cidade}, ${me.uf}`
      : me.cidade || me.uf || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const fichaVazia =
    perfil != null &&
    !perfil.objetivos &&
    !escolaridadeRotulo &&
    !perfil.ong_origem;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* o mesmo cartão-banner do perfil de todo mundo — mesma estrutura
          exata do /perfil de staff (avatar posicionado com z-10 sobre o
          banner); sem os botões de foto porque o jovem não faz upload —
          o avatar dele é o disco de iniciais amarelo por decisão de
          privacidade */}
      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <PessoaBanner
          papel="mentorado"
          nome={nomeTela}
          cidade={me.cidade}
          uf={me.uf}
          areas={me.interesses}
          seed={me.id}
        />
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="flex items-end justify-between gap-3">
            <div className="relative z-10 -mt-10 shrink-0 sm:-mt-12">
              <Avatar
                nome={nomeTela}
                papel="mentorado"
                size={80}
                className="size-20! ring-4 ring-card outline outline-1 outline-[var(--brand-ink)]/15 sm:size-24!"
              />
            </div>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
            {nomeTela}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1.5 font-normal">
              {papelLabel("mentorado")}
            </Badge>
            {meta ? (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0" aria-hidden />
                {meta}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* a mesma ordem do /perfil de staff: o que ele edita primeiro,
          depois a ficha burocrática como gaveta (molde de "Dados de
          cadastro" — summary + caret, sem lápis: leitura mantida pela
          coordenação), privacidade e conta por último */}
      <DadosSecao me={me} />

      {/* a grade semanal é dele e editável (REALIZA-114) — só renderiza
          com a ficha vinculada: sem ela a escrita não teria onde pousar e
          o badge "não vinculada" da gaveta abaixo já explica */}
      {perfil && (
        <DisponibilidadeCard
          grade={(perfil.disponibilidade as Disponibilidade | null) ?? null}
        />
      )}

      <details
        className="group/ficha rounded-xl bg-card shadow-[var(--shadow-border)]"
        open={!perfil || fichaVazia}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-6 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-open/ficha:rounded-b-none [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold">Sua ficha no programa</span>
          {perfil ? (
            <span className="text-xs text-muted-foreground">
              {fichaVazia ? "ainda vazia" : "mantida pela coordenação"}
            </span>
          ) : (
            <Badge
              variant="outline"
              className="border-[var(--warn)]/60 font-normal text-[var(--warn-text)]"
            >
              não vinculada
            </Badge>
          )}
          <CaretDown
            size={15}
            aria-hidden
            className="ml-auto shrink-0 text-muted-foreground transition-transform group-open/ficha:rotate-180"
          />
        </summary>
        <div className="border-t border-border px-6 pb-6 pt-5">
          {!perfil ? (
            <p className="text-sm text-muted-foreground">
              Sua ficha de mentorado ainda não está vinculada à sua conta. A
              coordenação faz essa conexão no seu cadastro.
            </p>
          ) : fichaVazia ? (
            <p className="text-sm text-muted-foreground">
              Sua ficha ainda está vazia: ela é preenchida a partir da sua
              inscrição e do papo com a coordenação.
            </p>
          ) : (
            <dl className="space-y-4">
              <Linha
                rotulo="Seus objetivos com a mentoria"
                valor={perfil.objetivos?.trim() || "—"}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Linha rotulo="Escolaridade" valor={escolaridadeRotulo || "—"} />
                <Linha
                  rotulo="Como você chegou"
                  valor={perfil.ong_origem?.trim() || "—"}
                />
              </div>
            </dl>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Pra corrigir algo da ficha, fale com a coordenação.
          </p>
        </div>
      </details>

      {/* 0084: "Meus pedidos" do jovem mora no perfil — trilha pública dos
          chamados dele, sem comentário interno nem vitrine pro mentor */}
      <JovemChamados
        itens={meusChamados.itens}
        meuId={me.id}
        meuNome={me.nome_social || me.nome}
        cSel={cSel}
        detalhe={
          detalhe?.chamado
            ? {
                chamado: detalhe.chamado,
                timeline: detalhe.timeline,
                equipe: detalhe.equipe,
              }
            : null
        }
      />

      <PrivacidadeCard
        compartilhado={perfil?.contato_compartilhado ?? false}
        temWhatsapp={perfil?.whatsapp != null}
      />
      <ContaSecao me={me} />
    </div>
  );
}
