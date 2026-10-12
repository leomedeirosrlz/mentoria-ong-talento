import { MapPin } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { getJovemPerfil } from "@/lib/queries-jovem";
import { getMe } from "@/lib/queries";
import { ESCOLARIDADE_LABELS, papelLabel } from "@/lib/ciclo";
import type { Escolaridade } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { PessoaBanner } from "@/components/pessoa-banner";
import { Linha } from "@/app/(app)/perfil/perfil-form";
import { JovemPerfilForm } from "./perfil-form";
import { PrivacidadeCard } from "./privacidade-card";

export const metadata = { title: "Meu perfil — Realiza.vc" };

export default async function JovemPerfil() {
  const [me, perfil] = await Promise.all([getMe(), getJovemPerfil()]);
  if (!me) redirect("/login"); // o layout já barra — convenção das páginas

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* o mesmo cartão-banner do perfil de todo mundo — papel mentorado
          pinta a paleta dele; o avatar aqui é inicial (foto é da ficha
          civil, que não entra no app do jovem) */}
      <section className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <PessoaBanner
          papel="mentorado"
          nome={nomeTela}
          cidade={me.cidade}
          uf={me.uf}
          areas={me.interesses}
          seed={me.id}
        />
        <div className="px-6 pb-6">
          <div className="-mt-9 mb-4">
            <div className="inline-block rounded-full bg-card p-1">
              <Avatar nome={nomeTela} papel="mentorado" size={72} />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">
              {nomeTela}
            </h1>
            <Badge variant="secondary">{papelLabel("mentorado")}</Badge>
          </div>
          {meta ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={14} className="shrink-0" />
              <span>{meta}</span>
            </div>
          ) : null}
        </div>
      </section>

      {/* ficha do programa — leitura honesta: o jovem vê o que a
          coordenação mantém dele, sem campos civis nem notas */}
      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Sua ficha no programa
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Mantida pela coordenação — pra corrigir algo, fale com a equipe.
        </p>
        {!perfil ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Sua ficha de mentorado ainda não está vinculada à sua conta — a
            coordenação faz essa conexão no seu cadastro.
          </p>
        ) : !perfil.objetivos && !escolaridadeRotulo && !perfil.ong_origem ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Sua ficha ainda está vazia — ela é preenchida a partir da sua
            inscrição e do papo com a coordenação.
          </p>
        ) : (
          <dl className="mt-4 space-y-4">
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
      </section>

      <JovemPerfilForm me={me} />
      <PrivacidadeCard
        compartilhado={perfil?.contato_compartilhado ?? false}
        temWhatsapp={perfil?.whatsapp != null}
      />
    </div>
  );
}
