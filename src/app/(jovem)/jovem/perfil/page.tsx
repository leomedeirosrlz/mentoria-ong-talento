import { MapPin } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getJovemDuplas,
  getJovemEncaminhamentos,
  getJovemEncontros,
  getJovemJornada,
  getJovemPerfil,
} from "@/lib/queries-jovem";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import { conquistasDoJovem } from "@/lib/conquistas";
import { papelLabel } from "@/lib/ciclo";
import { getMe } from "@/lib/queries";
import { getChamados, getChamadoDetalhe } from "@/lib/queries-chamados";
import { JovemChamados } from "@/components/jovem-chamados";
import { ConquistasCard } from "./conquistas-card";
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
  const [
    me,
    perfil,
    meusChamados,
    detalhe,
    duplas,
    encontros,
    avaliacoes,
    encaminhamentos,
    jornada,
  ] = await Promise.all([
    getMe(),
    getJovemPerfil(),
    getChamados(),
    cSel ? getChamadoDetalhe(cSel) : Promise.resolve(null),
    // jornada/conquistas: mesmas leituras cacheadas da home
    getJovemDuplas(),
    getJovemEncontros(),
    getJovemAvaliacoes(),
    getJovemEncaminhamentos(),
    // a RPC fora do ar devolve a estante sem os instrumentos — nunca quebra
    getJovemJornada().catch(() => null),
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
  // conquistas v2 (REALIZA-427): toda a derivação mora na lib — marcos
  // datados + instrumentos entregues + contagens + a faixa do próximo
  const conq = conquistasDoJovem({
    encontros,
    duplas,
    jornada,
    avaliacoes,
    encaminhamentos,
  });

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
        </div>
      </header>

      {/* mesma partição do /perfil de staff em xl: coluna principal com o
          que o jovem edita e acompanha; trilho com os cartões de conta
          (privacidade, sessão) — abaixo de xl empilha tudo na ordem
          mobile que já existia */}
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

          {/* mesma condição da home: jornada existe quando há trilha
              DPP ou sessão de especialista já feita */}
          {conq.temJornada && (
            <ConquistasCard
              conquistas={conq.conquistas}
              proximoMarco={conq.proximoMarco}
            />
          )}

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
          <ContaSecao me={me} tema={tema} />
        </div>
      </div>
    </div>
  );
}
