import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getContatos,
  getCronogramas,
  getDocumentoTemplates,
  getMe,
  getRelatorioLinks,
  getTurmaInscricoesAguardando,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "@/lib/demo/mode";
import { demoDuplas, demoMentorados, demoPessoas } from "@/lib/demo/queries";
import { PageHeader } from "@/components/page-header";
import { turmaDaDupla } from "@/lib/turma";
import { RelatorioBuilder } from "./relatorio-builder";
import type { DuplaFonte, PessoaFonte } from "@/lib/relatorio";

export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  let turmas: string[];
  let duplas: DuplaFonte[];
  let profs: PessoaFonte[];
  let mentorados: PessoaFonte[];
  // fila "Sem dupla" de todas as turmas (turma_inscricoes) + os links
  // públicos (170) pro painel "Compartilhar" da toolbar do builder (201),
  // com os seletores dos recortes ciclo/assinaturas
  const [inscricoes, links, cronogramas, templates] = await Promise.all([
    getTurmaInscricoesAguardando(null),
    getRelatorioLinks(),
    getCronogramas(),
    getDocumentoTemplates(),
  ]);

  if (await demoAtivo()) {
    const dd = demoDuplas("coordenacao");
    turmas = [...new Set(dd.map((d) => d.turma))];
    duplas = dd.map((d) => ({
      id: d.id,
      turma: d.turma,
      mentor_id: d.mentor.id,
      mentorado_id: d.mentorado.id,
      supervisor_id: d.supervisor?.id ?? null,
      status: d.status,
      iniciada_em: d.iniciada_em,
      demanda: d.demanda,
    }));
    const pessoaFonte = (p: {
      id: string;
      user_id?: string | null;
      nome: string | null;
      email?: string | null;
      whatsapp?: string | null;
      cidade?: string | null;
      uf?: string | null;
    }): PessoaFonte => ({
      id: p.id,
      user_id: p.user_id ?? null,
      nome: p.nome,
      email: p.email ?? null,
      whatsapp: p.whatsapp ?? null,
      cidade: p.cidade ?? null,
      uf: p.uf ?? null,
    });
    profs = [
      ...dd.map((d) => pessoaFonte(d.mentor)),
      ...dd.filter((d) => d.supervisor).map((d) => pessoaFonte(d.supervisor!)),
    ];
    mentorados = dd.map((d) => ({
      id: d.mentorado.id,
      nome: d.mentorado.nome,
      email: d.mentorado.email ?? null,
      whatsapp: d.mentorado.whatsapp ?? null,
      cidade: d.mentorado.cidade ?? null,
      uf: d.mentorado.uf ?? null,
    }));
    // pessoas da fila que não estão em dupla nenhuma não chegam pelos mapas
    // derivados de `duplas` — resolve no dataset demo completo (mesma
    // regra da query real, que lê as tabelas inteiras)
    if (inscricoes.length) {
      const todasProfs = new Map(demoPessoas("coordenacao").map((p) => [p.id, p]));
      const todasMents = new Map(demoMentorados("coordenacao").map((m) => [m.id, m]));
      const temProf = new Set(profs.map((p) => p.id));
      const temMent = new Set(mentorados.map((m) => m.id));
      for (const i of inscricoes) {
        if (i.papel_esperado === "mentor") {
          const p = todasProfs.get(i.profile_id);
          if (p && !temProf.has(p.id)) profs.push(pessoaFonte(p));
        } else {
          const m = todasMents.get(i.mentorado_id);
          if (m && !temMent.has(m.id)) mentorados.push(pessoaFonte(m));
        }
      }
    }
  } else {
    const supabase = await createClient();
    // profiles: grant por coluna da 0026 — email/whatsapp ficam de fora da
    // tabela (permission denied) e chegam pela view profiles_contato, que a
    // coordenação lê inteira. mentorados tem email/whatsapp no grant (0034).
    const [dRes, pRes, mRes, contatos] = await Promise.all([
      supabase
        .from("duplas")
        .select("id, turma, cronograma_id, mentor_id, mentorado_id, supervisor_id, status, iniciada_em, demanda")
        .order("iniciada_em"),
      // user_id alimenta o gate do e-mail editável na grade (conta
      // vinculada → e-mail só muda pelo sync do auth, 0060)
      supabase.from("profiles").select("id, user_id, nome, cidade, uf"),
      supabase.from("mentorados").select("id, nome, email, whatsapp, cidade, uf"),
      getContatos(),
    ]);
    if (dRes.error || pRes.error || mRes.error) {
      throw new Error(dRes.error?.message ?? pRes.error?.message ?? mRes.error?.message);
    }
    duplas = dRes.data ?? [];
    profs = (pRes.data ?? []).map((p) => ({
      ...p,
      email: contatos.get(p.id)?.email ?? null,
      whatsapp: contatos.get(p.id)?.whatsapp ?? null,
    }));
    mentorados = mRes.data ?? [];
    turmas = [
      ...new Set(
        duplas
          .map((d) => turmaDaDupla(d, cronogramas))
          .filter((t): t is string => !!t)
      ),
    ].sort((a, b) => b.localeCompare(a, "pt-BR"));
  }

  // turma que só existe na fila (T3 recém-inscrita, sem dupla ainda) também
  // entra no seletor — senão a fila dela ficaria invisível no builder
  turmas = [...new Set([...turmas, ...inscricoes.map((i) => i.turma)])].sort(
    (a, b) => b.localeCompare(a, "pt-BR")
  );

  // deep-link ?turma=<valor cru> — só vira recorte se a turma existir;
  // valor estranho cai no default (turma mais recente) sem quebrar a URL
  const { turma: turmaParam } = await searchParams;
  const turmaInicial =
    typeof turmaParam === "string" &&
    (turmaParam === "todas" || turmas.includes(turmaParam))
      ? turmaParam
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operação"
        title="Relatórios"
        meta="Escolha turma, granularidade e colunas. A grade abaixo é livre: redimensione, ordene e exporte"
      />
      <RelatorioBuilder
        turmas={turmas}
        turmaInicial={turmaInicial}
        duplas={duplas}
        profs={profs}
        mentorados={mentorados}
        inscricoes={inscricoes}
        cronogramas={cronogramas}
        templates={templates}
        links={links}
      />
    </div>
  );
}
