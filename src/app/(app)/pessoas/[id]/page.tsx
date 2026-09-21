import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, Buildings, EnvelopeSimple, HandHeart, LinkedinLogo, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { getMe, getPessoaPerfil } from "@/lib/queries";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";
import { formatDate, linkSeguro, papelLabel, waLink } from "@/lib/ciclo";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { PessoaMural, type MuralNota } from "@/components/pessoa-mural";
import { VoltarLink } from "@/components/voltar-link";

export const metadata: Metadata = { title: "Perfil" };

const STATUS_DUPLA: Record<string, string> = {
  ativa: "ativa",
  pausada: "pausada",
  encerrada: "encerrada",
};

export default async function PessoaPerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [perfil, me] = await Promise.all([getPessoaPerfil(id), getMe()]);
  if (!perfil || !me) notFound();

  // mentor que abre o próprio cadastro cai no /perfil (lá ele edita);
  // perfil de outro staff/mentor não é aberto pra ele
  const ehMentor = me.role === "mentor_dpp" || me.role === "mentor_especialista";
  const ehStaff = me.role === "coordenacao" || me.role === "supervisor";
  if (perfil.tipo === "profile" && perfil.pessoa.id === me.id) redirect("/perfil");
  if (!ehStaff && perfil.tipo === "profile") notFound();
  // mentorado: o RLS já barrou quem não tem vínculo (query voltou null)

  const p = perfil.pessoa;
  const souCoord = me.role === "coordenacao";
  // escreve no mural: staff sempre; mentor só no mural do mentorado da
  // própria dupla — duplas já vem filtrada pelo RLS, então basta o vínculo
  const podeAnotar =
    ehStaff || (ehMentor && perfil.tipo === "mentorado" && perfil.duplas.some((d) => d.mentor?.id === me.id));

  const ehMentorado = perfil.tipo === "mentorado";
  const avatarSrc = p.avatar_path ? avatarPublicUrl(p.avatar_path) : null;
  const gravatar = !ehMentorado && "email" in p && p.email ? gravatarUrl(p.email) : null;
  const wa = p.whatsapp ? waLink(p.whatsapp, "") : null;

  // apresentação profissional (0030) — só profiles têm; o card some quando
  // nada foi preenchido (perfil vazio não é um estado a exibir)
  const perfilPro =
    perfil.tipo === "profile"
      ? {
          bio: perfil.pessoa.bio,
          linkedin: linkSeguro(perfil.pessoa.linkedin),
          areas: perfil.pessoa.areas ?? [],
          voluntariado: perfil.pessoa.voluntariado,
        }
      : null;
  const temPerfilPro = !!perfilPro && Boolean(
    perfilPro.bio || perfilPro.linkedin || perfilPro.areas.length || perfilPro.voluntariado
  );

  // RLS devolve só as minhas notas — o feed não precisa de autor
  const notas: MuralNota[] = perfil.notas.map((n) => ({
    id: n.id,
    texto: n.texto,
    created_at: n.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        {/* coord volta pra /pessoas; mentor/supervisor voltam pra de onde vieram */}
        <VoltarLink fallback={souCoord ? "/pessoas" : "/"} />
      </div>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar
          nome={p.nome}
          src={avatarSrc}
          fallbackSrc={gravatar}
          papel={ehMentorado ? "mentorado" : undefined}
          size={72}
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{p.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {ehMentorado ? (
              <>
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
                Mentorado
                {"ong_origem" in p && p.ong_origem && ` · ${p.ong_origem}`}
              </>
            ) : (
              <>
                {papelLabel("role" in p ? p.role : null)}
                {"ativo" in p && !p.ativo && (
                  <Badge variant="outline" className="border-[var(--danger)]/50 text-[var(--danger)]">
                    inativa
                  </Badge>
                )}
                {"user_id" in p && !p.user_id && p.ativo && (
                  <Badge variant="outline">ainda não entrou</Badge>
                )}
              </>
            )}
          </p>
          {/* contato — chip real, não texto corrido (mesma gramática dos chips da ficha) */}
          {(wa || ("email" in p && p.email)) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-[var(--brand-lime)]/15 hover:border-[var(--brand-lime)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
                >
                  <WhatsappLogo size={15} aria-hidden />
                  WhatsApp
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
              {"email" in p && p.email && (
                <a
                  href={`mailto:${p.email}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
                >
                  <EnvelopeSimple size={15} aria-hidden />
                  {p.email}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Mural de notas</h2>
          <PessoaMural
            pessoaId={p.id}
            tipo={perfil.tipo}
            notas={notas}
            podeAnotar={podeAnotar}
            nomePessoa={p.nome}
          />
        </section>

        <aside className="space-y-4">
          {/* vitrine profissional (0030) — bio corrida, LinkedIn externo,
              áreas como chips e voluntariado numa linha discreta */}
          {perfilPro && temPerfilPro && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Perfil profissional
              </h2>
              {perfilPro.bio && (
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {perfilPro.bio}
                </p>
              )}
              {perfilPro.linkedin && (
                <a
                  href={perfilPro.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
                >
                  <LinkedinLogo size={15} aria-hidden />
                  LinkedIn
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
              {perfilPro.areas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {perfilPro.areas.map((a) => (
                    <Badge key={a} variant="secondary" className="font-normal">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
              {perfilPro.voluntariado && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <HandHeart size={13} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">Voluntariado:</span>{" "}
                    {perfilPro.voluntariado}
                  </span>
                </p>
              )}
            </section>
          )}

          <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Duplas
            </h2>
            {perfil.duplas.length === 0 ? (
              <p className="mt-2 text-muted-foreground">Nenhuma dupla no histórico.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {perfil.duplas.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/duplas/${d.id}`}
                      className="group flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {d.mentor && d.mentorado && (
                        <DuplaAvatares
                          mentor={d.mentor}
                          mentorado={d.mentorado}
                          size={32}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {d.mentor && d.mentorado ? (
                            <DuplaNomes mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
                          ) : (
                            "Dupla"
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {STATUS_DUPLA[d.status]}
                          {d.iniciada_em ? ` · desde ${formatDate(d.iniciada_em)}` : ""}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={13}
                        aria-hidden
                        className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* anamnese do mentorado — dado de cadastro, não do mural */}
          {ehMentorado && "notas" in p && p.notas && (
            <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Buildings size={13} aria-hidden />
                Referência da anamnese
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{p.notas}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
