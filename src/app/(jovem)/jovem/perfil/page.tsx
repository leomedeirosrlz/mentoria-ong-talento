import { MapPin } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getJovemPerfil } from "@/lib/queries-jovem";
import { getMe } from "@/lib/queries";
import { getChamados, getChamadoDetalhe } from "@/lib/queries-chamados";
import { JovemChamados } from "@/components/jovem-chamados";
import { papelLabel } from "@/lib/ciclo";
import { avatarPublicUrl } from "@/lib/avatar";
import { gravatarUrlSeExiste } from "@/lib/gravatar";
import { Badge } from "@/components/ui/badge";
import { PessoaBanner } from "@/components/pessoa-banner";
import {
  ContaSecao,
  DadosSecao,
  DisponibilidadeCard,
  FichaSecao,
  FotoPerfil,
} from "./perfil-form";
import { PrivacidadeCard } from "./privacidade-card";
import { TokensMcp } from "@/components/tokens-mcp";
import { demoRole } from "@/lib/demo/mode";
import { TEMA_COOKIE, temaValido } from "@/lib/tema";
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
  const cSel = c && UUID_RE.test(c) ? c : null;
  // detalhe junto com a lista: getChamadoDetalhe reaproveita a linha do
  // getChamados (React.cache) em vez de esperar a lista terminar
  const [me, perfil, meusChamados, detalhe] = await Promise.all([
    getMe(),
    getJovemPerfil(),
    getChamados(),
    cSel ? getChamadoDetalhe(cSel) : Promise.resolve(null),
  ]);
  if (!me) redirect("/login"); // o layout já barra — convenção das páginas
  const tema = temaValido((await cookies()).get(TEMA_COOKIE)?.value);
  const demo = await demoRole();

  const nomeTela = me.nome_social || me.nome;
  // a foto do jovem mora em mentorados.avatar_path (é o que jovem_perfil
  // projeta); profiles.avatar_path é a dos adultos
  const avatarUrl = perfil?.avatar_path
    ? avatarPublicUrl(perfil.avatar_path)
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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* o mesmo cartão-banner do /perfil de staff: avatar posicionado
          com z-10 sobre o banner, câmera de upload instantâneo (a antiga
          decisão "iniciais só" caiu com a foto liberada, REALIZA-419) e
          a bio por baixo do nome quando preenchida */}
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
            <FotoPerfil
              nome={nomeTela}
              pasta={me.id}
              src={avatarUrl}
              fallbackSrc={demo ? null : await gravatarUrlSeExiste(me.email)}
            />
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
          {me.bio?.trim() ? (
            <p className="mt-3 max-w-2xl text-sm text-pretty whitespace-pre-wrap">
              {me.bio}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Sem foto, usamos a do seu e-mail.
          </p>
        </div>
      </header>

      {/* mesma partição do /perfil de staff em xl: coluna principal com o
          que o jovem edita e acompanha; trilho com os cartões de conta
          (privacidade, IA externa, sessão) — abaixo de xl empilha tudo na
          ordem mobile que já existia */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <DadosSecao me={me} />

          {/* a grade semanal é dele e editável (REALIZA-114) — só renderiza
              com a ficha vinculada: sem ela a escrita não teria onde pousar e
              o badge "não vinculada" da gaveta abaixo já explica */}
          {perfil && (
            <DisponibilidadeCard
              grade={(perfil.disponibilidade as Disponibilidade | null) ?? null}
            />
          )}

          <FichaSecao perfil={perfil} />

          {/* 0084: "Meus pedidos" do jovem mora no perfil — trilha pública
              dos chamados dele, sem comentário interno nem vitrine pro
              mentor */}
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
        </div>

        <div className="min-w-0 space-y-6">
          <PrivacidadeCard
            compartilhado={perfil?.contato_compartilhado ?? false}
            temWhatsapp={perfil?.whatsapp != null}
          />
          {/* PAT de IA externa — a credencial pessoal do jovem mora junto da
              Conta; demo não monta (sem sessão real a RLS derrubaria o
              insert) */}
          {!demo && (
            <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
              <h2 className="text-base font-semibold">Conectar IA externa</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Conecte uma IA externa (Claude, ChatGPT…) à sua conta com um
                token. Ela só vê e faz o que você mesmo faria aqui no app.
              </p>
              <TokensMcp
                className="mt-4"
                textos={{
                  gerar: "Gerar token",
                  campoRotulo: {
                    label: "Nome do token",
                    placeholder: "ex.: ChatGPT",
                  },
                }}
              />
            </section>
          )}
          <ContaSecao me={me} tema={tema} />
        </div>
      </div>
    </div>
  );
}
