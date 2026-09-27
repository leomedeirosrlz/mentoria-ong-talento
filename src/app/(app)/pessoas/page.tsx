import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getDuplasResumo,
  getDuplasResumoTodas,
  getMe,
  getMentorados,
  getMentorProfiles,
  getPessoas,
  type MentorProfile,
} from "@/lib/queries";
import { getAssinaturasResumo } from "@/lib/queries-assinaturas";
import type { DocsPessoa } from "@/components/pessoas-listas";
import {
  NovaPessoaDialog,
  NovoMentoradoDialog,
  PessoasMaisAcoes,
} from "@/components/pessoas-dialogs";
import { PessoasListas } from "@/components/pessoas-listas";

export const metadata: Metadata = {
  title: "Pessoas",
};

export default async function PessoasPage() {
  const me = await getMe();
  // o layout já garante papel definido — guard defensivo pra query direta
  if (!me?.role) redirect("/");
  const souCoord = me.role === "coordenacao";

  // fora da coordenação a página é um diretório de colegas: os resumos
  // operacionais (vínculos de dupla, fichas de mentor, assinaturas) viriam
  // escopados pelo RLS e renderizariam badges falsos — nem dispara
  const [pessoas, mentorados, duplas, todasDuplas, perfisMentor, resumoAss] =
    await Promise.all([
      getPessoas(),
      getMentorados(),
      souCoord ? getDuplasResumo() : Promise.resolve([]),
      souCoord ? getDuplasResumoTodas() : Promise.resolve([]),
      souCoord ? getMentorProfiles() : Promise.resolve([]),
      souCoord ? getAssinaturasResumo() : Promise.resolve([]),
    ]);

  const comDupla = new Set(
    duplas
      .flatMap((d) => [d.mentor_id, d.mentorado_id, d.supervisor_id])
      .filter((id): id is string => Boolean(id))
  );

  // delete guard: servidor bloqueia qualquer dupla (inclusive encerrada)
  const comQualquerDupla = new Set(
    todasDuplas
      .flatMap((d) => [d.mentor_id, d.mentorado_id, d.supervisor_id])
      .filter((id): id is string => Boolean(id))
  );

  // matching board: vagas ocupadas por mentor (duplas não-encerradas)
  // e capacidade/prontidão de cada um, indexados por profile_id
  const contagemPorMentor: Record<string, number> = {};
  for (const d of duplas) {
    contagemPorMentor[d.mentor_id] = (contagemPorMentor[d.mentor_id] ?? 0) + 1;
  }
  const mentorProfiles: Record<string, MentorProfile> = {};
  for (const mp of perfisMentor) {
    mentorProfiles[mp.profile_id] = mp;
  }

  // status de assinatura por pessoa — os badges "assinou vs. não" da lista
  const docsPorPessoa: Record<string, DocsPessoa> = {};
  for (const a of resumoAss) {
    const pid = a.profile_id ?? a.mentorado_id;
    if (!pid) continue;
    const d = (docsPorPessoa[pid] ??= { assinado: {}, pendente: [] });
    if (a.status === "assinado")
      d.assinado[a.slug] = { id: a.id, em: a.assinado_em };
    else if (
      a.status === "pendente" &&
      // link com prazo vencido está morto — conta como não-enviado (warn),
      // não como "enviada"; o status expirado do banco é lazy (0033)
      !(a.token_expira_em && new Date(a.token_expira_em) < new Date()) &&
      !d.pendente.includes(a.slug)
    )
      d.pendente.push(a.slug);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pessoas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {souCoord
              ? "Mentores, supervisores e equipe com acesso à plataforma"
              : "Conheça quem faz o programa"}
          </p>
        </div>
        {/* criação é o caminho primário e fica visível; importação e backups
            vão pro "Mais ações" — 5 CTAs de mesmo peso viravam pilha a 390px.
            Só a coordenação gerencia cadastros — pros demais é diretório */}
        {souCoord && (
          <div className="flex flex-wrap gap-2">
            <NovoMentoradoDialog />
            <NovaPessoaDialog />
            <PessoasMaisAcoes />
          </div>
        )}
      </header>

      {/* pré-cadastros sem papel nem entram no payload de não-coord —
          diretório é de colegas, e a existência do pré-cadastro já é
          informação operacional */}
      <PessoasListas
        pessoas={souCoord ? pessoas : pessoas.filter((p) => p.role != null)}
        mentorados={mentorados}
        comDupla={[...comDupla]}
        comQualquerDupla={[...comQualquerDupla]}
        mentorProfiles={mentorProfiles}
        contagemPorMentor={contagemPorMentor}
        assinaturas={docsPorPessoa}
        souCoord={souCoord}
      />
    </div>
  );
}
