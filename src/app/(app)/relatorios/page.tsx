import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "@/lib/demo/mode";
import { demoDuplas } from "@/lib/demo/queries";
import { PageHeader } from "@/components/page-header";
import { RelatorioBuilder } from "./relatorio-builder";
import type { DuplaFonte, PessoaFonte } from "@/lib/relatorio";

export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  let turmas: string[];
  let duplas: DuplaFonte[];
  let profs: PessoaFonte[];
  let mentorados: PessoaFonte[];

  if (await demoAtivo()) {
    const dd = demoDuplas("coordenacao");
    turmas = [...new Set(dd.map((d) => d.turma))];
    duplas = dd.map((d) => ({
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
      nome: string | null;
      email?: string | null;
      whatsapp?: string | null;
      cidade?: string | null;
      uf?: string | null;
    }): PessoaFonte => ({
      id: p.id,
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
  } else {
    const supabase = await createClient();
    const [dRes, pRes, mRes] = await Promise.all([
      supabase
        .from("duplas")
        .select("turma, mentor_id, mentorado_id, supervisor_id, status, iniciada_em, demanda")
        .order("iniciada_em"),
      supabase.from("profiles").select("id, nome, email, whatsapp, cidade, uf"),
      supabase.from("mentorados").select("id, nome, email, whatsapp, cidade, uf"),
    ]);
    if (dRes.error || pRes.error || mRes.error) {
      throw new Error(dRes.error?.message ?? pRes.error?.message ?? mRes.error?.message);
    }
    duplas = dRes.data ?? [];
    profs = pRes.data ?? [];
    mentorados = mRes.data ?? [];
    turmas = [...new Set(duplas.map((d) => d.turma))].sort((a, b) =>
      b.localeCompare(a, "pt-BR")
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operação"
        title="Relatórios"
        meta="Escolha turma, granularidade e colunas — a grade abaixo é livre: redimensione, ordene e exporte"
      />
      <RelatorioBuilder
        turmas={turmas}
        duplas={duplas}
        profs={profs}
        mentorados={mentorados}
      />
    </div>
  );
}
