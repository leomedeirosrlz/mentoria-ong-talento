import { MapPin, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getJovemAssinaturas,
  getJovemColegas,
  getJovemContatos,
  getJovemDuplas,
  getJovemEncaminhamentos,
  getJovemEncontros,
  getJovemJornada,
  getJovemPerfil,
} from "@/lib/queries-jovem";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import { getPdmDaDupla } from "@/lib/queries-pdm";
import { conquistasDoJovem } from "@/lib/conquistas";
import { papelLabel } from "@/lib/ciclo";
import { getMe } from "@/lib/queries";
import { getChamados, getChamadoDetalhe } from "@/lib/queries-chamados";
import { JovemChamados } from "@/components/jovem-chamados";
import { ConquistasCard } from "./conquistas-card";
import { SeloNivel } from "./selo-nivel";
import { NivelNotifier } from "@/components/nivel-notifier";
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
import { ContatoLinha, ColegaLinha } from "@/components/jovem-rede";
import { agrupaContatosPorPessoa } from "@/lib/jovem-contatos";
import { seloDuplaLabel, vinculoDeContato } from "@/lib/jovem-diretorio";
import { demoRole } from "@/lib/demo/mode";
import { TEMA_COOKIE, temaValido } from "@/lib/tema";
import type { Disponibilidade } from "@/lib/types";

export const metadata = { title: "Meu perfil" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ordem de leitura da rede — o mentor primeiro, depois o especialista da
// trilha; mesma régua dos grupos da página /pessoas que a seção herdou
const ORDEM_VINCULO: Record<string, number> = {
  mentor: 0,
  especialista: 1,
  supervisor: 2,
  coordenacao: 3,
};

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
    contatosRede,
    colegas,
    encontros,
    avaliacoes,
    encaminhamentos,
    jornada,
    assinaturas,
  ] = await Promise.all([
    getMe(),
    getJovemPerfil(),
    getChamados(),
    cSel ? getChamadoDetalhe(cSel) : Promise.resolve(null),
    // jornada/conquistas: mesmas leituras cacheadas da home
    getJovemDuplas(),
    // "Sua rede" (023): os adultos das duplas + os colegas de turma —
    // mesmas fontes que alimentavam a página /pessoas antiga
    getJovemContatos(),
    getJovemColegas(),
    getJovemEncontros(),
    getJovemAvaliacoes(),
    getJovemEncaminhamentos(),
    // a RPC fora do ar devolve a estante sem os instrumentos — nunca quebra
    getJovemJornada().catch(() => null),
    // a família "termo" das conquistas (024) lê o slug termo-mentorando
    getJovemAssinaturas(),
  ]);
  if (!me) redirect("/login"); // o layout já barra — convenção das páginas
  const tema = temaValido((await cookies()).get(TEMA_COOKIE)?.value);
  const demo = await demoRole();
  // itens do PDM das duplas DPP (024) — um getPdmDaDupla por dupla da
  // régua (React.cache reaproveita a leitura de quem já abriu o PDM);
  // RPC fora do ar devolve null e a família metas/submetas só não nasce
  const pdmDocs = await Promise.all(
    duplas
      .filter((d) => d.id != null && (d.trilha ?? "dpp") !== "especialista")
      .map((d) => getPdmDaDupla(d.id!))
  );
  const pdmItens = pdmDocs.flatMap((doc) =>
    (doc?.itens ?? []).map((i) => ({
      parentId: i.parentId,
      status: i.status,
      atingidaEm: i.atingidaEm,
    }))
  );

  const nomeTela = me.nome_social || me.nome;
  // a foto do jovem mora em mentorados.avatar_path (é o que jovem_perfil
  // projeta); profiles.avatar_path é a dos adultos
  const avatarUrl = perfil?.avatar_path
    ? avatarPublicUrl(perfil.avatar_path)
    : null;
  // conquistas v4 (024): toda a derivação mora na lib — estante (marcos
  // datados + instrumentos entregues + famílias com tiers), futuras e
  // nível; as peças gerais (perfil, termo) chegam sem jornada
  const conq = conquistasDoJovem({
    encontros,
    duplas,
    jornada,
    avaliacoes,
    encaminhamentos,
    assinaturas,
    pdmItens,
    perfil: perfil
      ? {
          whatsapp: perfil.whatsapp,
          disponibilidade: perfil.disponibilidade,
          bioOuInteresses:
            !!me.bio?.trim() || (me.interesses?.length ?? 0) > 0,
        }
      : null,
  });

  const meta = [
    perfil?.ong_origem?.trim() || null,
    me.cidade && me.uf
      ? `${me.cidade}, ${me.uf}`
      : me.cidade || me.uf || null,
  ]
    .filter(Boolean)
    .join(" · ");

  // "Sua rede" (023): os adultos das duplas dedup por pessoa (mesma régua
  // do merge do diretório) + os colegas de turma — as mesmas linhas e os
  // mesmos canais da página /pessoas que a seção substituiu
  const porDupla = new Map(
    duplas.map((d) => [d.id, { status: d.status, trilha: d.trilha }])
  );
  const rede = agrupaContatosPorPessoa(contatosRede, porDupla).sort(
    (a, b) =>
      (ORDEM_VINCULO[a.papel ?? ""] ?? 9) - (ORDEM_VINCULO[b.papel ?? ""] ?? 9)
  );

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
          {/* justify-start + wrap: com a foto o ghost fica colado no
              avatar e o selo (ml-auto) cai pra linha de baixo em vez de
              espremer ilegível em 390px — em uma linha só quando cabe,
              idêntico ao justify-between de antes */}
          <div className="flex flex-wrap items-end justify-start gap-3">
            <FotoPerfil
              nome={nomeTela}
              pasta={me.id}
              src={avatarUrl}
              fallbackSrc={demo ? null : await gravatarUrlSeExiste(me.email)}
            />
            {/* o selo "Seu nível" (024) — a faixa atual na mão do avatar;
                abre o mesmo detalhe da régua do card de conquistas */}
            {conq.nivel && <SeloNivel nivel={conq.nivel} />}
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

          {/* 023: a rede sai do corpo de /jovem/pessoas (virou diretório)
              e ganha seção própria — as mesmas linhas compartilhadas
              (jovem-rede): avatar, vínculo na voz dele, selo de dupla
              não-ativa e os canais de sempre (WhatsApp do colega atrás do
              opt-in dele). O catálogo não se duplica: um link discreto
              aponta pra ele */}
          <section
            aria-labelledby="sua-rede-titulo"
            className="animate-enter rounded-xl bg-card p-6 shadow-[var(--shadow-border)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="sua-rede-titulo" className="text-base font-semibold">
                  Sua rede
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mentor, especialista, equipe e os colegas da sua turma.
                </p>
              </div>
              <Link
                href="/jovem/especialistas"
                className="group inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Conhecer especialistas
                <ArrowRight
                  size={14}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
            {rede.length === 0 && colegas.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Quando a sua rede se formar, as pessoas aparecem aqui.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border/60">
                {rede.map((c) => (
                  <ContatoLinha
                    key={`${c.papel}-${c.id}`}
                    c={c}
                    selo={seloDuplaLabel(
                      c.dupla_id ? porDupla.get(c.dupla_id)?.status : null,
                      c.dupla_id ? porDupla.get(c.dupla_id)?.trilha : null
                    )}
                    vinculo={vinculoDeContato(c)}
                    nomeJovem={nomeTela}
                  />
                ))}
                {colegas.map((c) => (
                  <ColegaLinha key={c.id} c={c} nomeJovem={nomeTela} />
                ))}
              </ul>
            )}
          </section>

          {/* jornada (DPP ou especialista) OU as peças gerais da 024 —
              perfil e termo chegam antes da primeira dupla, então o card
              renderiza com qualquer peça, jornada ou não */}
          {(conq.temJornada ||
            conq.conquistas.length > 0 ||
            conq.futuras.length > 0) && (
            <ConquistasCard
              conquistas={conq.conquistas}
              futuras={conq.futuras}
              nivel={conq.nivel}
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

      {/* o toast da subida de faixa (024): baseline em localStorage,
          dispara uma vez por nível novo cruzado */}
      <NivelNotifier
        mentoradoId={perfil?.id ?? me.id}
        atual={conq.nivel?.atual ?? null}
        titulo={
          conq.nivel?.faixas.find((f) => f.chave === conq.nivel?.atual)
            ?.titulo ?? null
        }
        criterio={
          conq.nivel?.faixas.find((f) => f.chave === conq.nivel?.atual)
            ?.criterio ?? null
        }
      />
    </div>
  );
}
