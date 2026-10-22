import type { Metadata } from "next";
import Link from "next/link";
import {
  getCicloEventos,
  getDuplas,
  getMateriais,
  getMe,
  getPainelInstrumentosJornada,
} from "@/lib/queries";
import { getUltimasInteracoes } from "@/lib/interacoes";
import { maxNumeroEncontro } from "@/lib/ciclo";
import { temPapel } from "@/lib/types";
import { FolderOpen } from "@phosphor-icons/react/dist/ssr";
import { NovoMaterialDialog } from "@/components/novo-material-dialog";
import { PainelJornada } from "@/components/painel-jornada";
import { PageHeader } from "@/components/page-header";
import {
  CoberturaTrilha,
  EncontroDetails,
  particionarMateriais,
  titulosPorNumero,
  TransversaisMateriais,
} from "@/components/materiais-hub";

export const metadata: Metadata = { title: "Materiais" };

export default async function MateriaisPage() {
  const [materiais, me, eventos] = await Promise.all([
    getMateriais(),
    getMe(),
    getCicloEventos(),
  ]);

  const visiveis = materiais.filter((m) => {
    if (m.audiencia === "todos") return true;
    if (me?.role === "coordenacao") return true;
    if (m.audiencia === "dpp") return temPapel(me, "mentor_dpp");
    if (m.audiencia === "especialista")
      return temPapel(me, "mentor_especialista");
    return false;
  });

  const ehCoord = me?.role === "coordenacao";
  // encontro_num do material é por programa (o guia do 5º vale pras duas
  // turmas) — o teto do hub é o maior nº que existe, não a soma das linhas
  const maxEncontro = maxNumeroEncontro(eventos);
  const { porEncontro, nums, transversais } = particionarMateriais(
    visiveis,
    maxEncontro
  );
  const titulos = titulosPorNumero(eventos);

  // WP7 — o painel "Progresso da jornada" é staff-only (a RPC valida
  // coord/supervisor; a chamada nem rola fora dos dois papéis). status +
  // whatsapp do mentor vem das duplas — o payload agregado não os carrega
  // e o Lembrar precisa dos dois (pausada não recebe nudge; o wa.me só
  // abre com telefone real). O cap de 48h lê só interações tipo nudge.
  const vePainel =
    me != null && (temPapel(me, "coordenacao") || temPapel(me, "supervisor"));
  const [painel, duplasPainel] = vePainel
    ? await Promise.all([getPainelInstrumentosJornada(), getDuplas()])
    : [[], []];
  const nudges = painel.length
    ? await getUltimasInteracoes(
        painel.map((l) => l.dupla_id),
        "nudge"
      )
    : {};
  const duplasInfo = new Map(
    duplasPainel.map((d) => [
      d.id,
      { status: d.status, mentorWhatsapp: d.mentor?.whatsapp ?? null },
    ])
  );

  return (
    <div className="space-y-6">
      {/* biblioteca vazia: o CTA mora dentro do card de estado vazio, não
          aqui — por isso o actions some junto com o catálogo */}
      <PageHeader
        title="Materiais"
        meta="A biblioteca oficial do programa. A coordenação publica conforme a jornada avança"
        actions={
          ehCoord && visiveis.length > 0 ? (
            <NovoMaterialDialog maxEncontro={maxEncontro} />
          ) : undefined
        }
      />

      {painel.length > 0 && me && (
        <PainelJornada
          linhas={painel}
          eventos={eventos}
          nudges={nudges}
          duplasInfo={duplasInfo}
          meuNome={me.nome_social || me.nome}
          ehSupervisor={!temPapel(me, "coordenacao")}
        />
      )}

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
          <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <FolderOpen size={18} aria-hidden />
          </span>
          <p className="text-sm font-medium">
            {ehCoord ? "Nenhum material publicado ainda" : "Nenhum material disponível para o seu perfil"}
          </p>
          <p className="text-sm text-muted-foreground">
            {ehCoord
              ? "Publique o primeiro guia, modelo ou instrumento do programa."
              : "Os guias e instrumentos do programa aparecem aqui quando a coordenação publicar."}
          </p>
          <div className="mt-3">
            {ehCoord ? (
              <NovoMaterialDialog maxEncontro={maxEncontro} />
            ) : (
              <Link
                href="/agenda"
                className="text-sm font-medium underline underline-offset-2 transition-colors hover:text-muted-foreground"
              >
                Ver a agenda
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* hub por encontro (REALIZA-173): a trilha de cobertura responde
              "o que falta" num olhar; cada célula ancora no <details> do
              encontro. Mentor/especialista veem a mesma estrutura em leitura
              — MaterialActions e NovoMaterialDialog só renderizam pra coord */}
          {nums.length > 0 && (
            <>
              <CoberturaTrilha porEncontro={porEncontro} nums={nums} />
              <section
                aria-label="Materiais por encontro"
                className="space-y-2"
              >
                {nums.map((n, i) => (
                  <EncontroDetails
                    key={n}
                    n={n}
                    titulo={titulos.get(n)}
                    itens={porEncontro.get(n) ?? []}
                    ehCoord={ehCoord}
                    maxEncontro={maxEncontro}
                    indice={i}
                  />
                ))}
              </section>
            </>
          )}
          <TransversaisMateriais
            grupos={transversais}
            ehCoord={ehCoord}
            maxEncontro={maxEncontro}
          />
        </>
      )}
    </div>
  );
}
