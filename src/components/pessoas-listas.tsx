"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  CaretDown,
  FileText,
  GraduationCap,
  LinkBreak,
  MagnifyingGlass,
  Student,
  Users,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import type { Mentorado, Profile } from "@/lib/types";
import type { MentorProfile } from "@/lib/queries";
import { cn, normaliza } from "@/lib/utils";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { PessoaActions } from "@/components/pessoa-actions";
import { MentoradoActions } from "@/components/mentorado-actions";
import { RoleSelect } from "@/components/role-select";
import { ImportarCsvDialog } from "@/components/importar-csv-dialog";
import { MatchingPanel } from "@/components/matching-panel";
import { NovaPessoaDialog, NovoMentoradoDialog } from "@/components/pessoas-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ehMentor = (p: Profile) =>
  p.role === "mentor_dpp" || p.role === "mentor_especialista";

/** Status de assinatura de uma pessoa, montado na page a partir do resumo:
 *  `assinado` = slug → ISO da assinatura; `pendente` = slugs com link vivo. */
export type DocsPessoa = {
  assinado: Record<string, string>;
  pendente: string[];
};

const DOCS_VAZIO: DocsPessoa = { assinado: {}, pendente: [] };

/** "dd/mm/aaaa" — data da assinatura no detalhe da linha. */
const fmtDia = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

/** "5511999998888" -> "+55 (11) 99999-8888"; fora do padrão BR mostra como veio. */
function formatarWhatsApp(wa: string): string {
  const d = wa.replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 13) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.startsWith("55") && d.length === 12) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return wa;
}

export function PessoasListas({
  pessoas,
  mentorados,
  comDupla,
  comQualquerDupla,
  mentorProfiles,
  contagemPorMentor,
  assinaturas,
}: {
  pessoas: Profile[];
  mentorados: Mentorado[];
  comDupla: string[];
  /** Ids com QUALQUER dupla (até encerrada) — espelha a guarda das actions de exclusão. */
  comQualquerDupla: string[];
  mentorProfiles: Record<string, MentorProfile>;
  contagemPorMentor: Record<string, number>;
  /** id da pessoa → documentos assinados/pendentes (badge "assinou vs. não"). */
  assinaturas: Record<string, DocsPessoa>;
}) {
  const [busca, setBusca] = useState("");
  const [semDupla, setSemDupla] = useState(false);
  const emDupla = useMemo(() => new Set(comDupla), [comDupla]);
  const temQualquerDupla = useMemo(() => new Set(comQualquerDupla), [comQualquerDupla]);

  const q = normaliza(busca.trim());
  let pessoasFiltradas = q
    ? pessoas.filter(
        (p) => normaliza(p.nome).includes(q) || normaliza(p.email).includes(q)
      )
    : pessoas;
  let mentoradosFiltrados = q
    ? mentorados.filter(
        (m) =>
          normaliza(m.nome).includes(q) ||
          normaliza(m.email).includes(q) ||
          normaliza(m.ong_origem).includes(q)
      )
    : mentorados;

  // matching board: "Livres para dupla" deixa só mentores e mentorados livres pra parear
  const mentoresLivres = pessoas.filter((p) => ehMentor(p) && !emDupla.has(p.id));
  const mentoradosLivres = mentorados.filter((m) => !emDupla.has(m.id));
  const livres = mentoresLivres.length + mentoradosLivres.length;
  if (semDupla) {
    pessoasFiltradas = pessoasFiltradas.filter(
      (p) => ehMentor(p) && !emDupla.has(p.id)
    );
    mentoradosFiltrados = mentoradosFiltrados.filter((m) => !emDupla.has(m.id));
  }
  const filtrando = Boolean(q) || semDupla;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <MagnifyingGlass
            aria-hidden
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar pessoa"
            placeholder="Buscar por nome ou e-mail"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <button
          type="button"
          aria-pressed={semDupla}
          onClick={() => setSemDupla((v) => !v)}
          className={
            "inline-flex min-h-11 md:min-h-8 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring " +
            (semDupla
              ? "border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/15 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground")
          }
        >
          Livres para dupla
          <span className="font-mono text-[11px]">{livres}</span>
        </button>
      </div>

      {/* board de pareamento — comparação de afinidade mentorado × mentor
          só faz sentido com o filtro de livres ligado */}
      {semDupla && (
        <MatchingPanel
          mentores={mentoresLivres}
          mentorados={mentoradosLivres}
          mentorProfiles={mentorProfiles}
        />
      )}

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Com acesso ({filtrando ? `${pessoasFiltradas.length} de ${pessoas.length}` : pessoas.length})
        </h2>
        <div className="rounded-xl bg-card shadow-[var(--shadow-border)] divide-y divide-border overflow-hidden">
          {pessoas.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <UsersThree aria-hidden size={32} className="text-muted-foreground" />
              <p className="text-sm font-medium">Ninguém cadastrado ainda</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Quem tem acesso à plataforma — mentores, supervisores e coordenação —
                entra por aqui, um a um ou de uma planilha.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <ImportarCsvDialog />
                <NovaPessoaDialog />
              </div>
            </div>
          )}
          {pessoas.length > 0 && pessoasFiltradas.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              {q ? (
                <>
                  <MagnifyingGlass aria-hidden size={32} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum resultado para “{busca.trim()}”</p>
                  <p className="text-sm text-muted-foreground">Tente outro nome ou e-mail.</p>
                  <Button
                    variant="outline" size="sm" className="mt-2"
                    onClick={() => setBusca("")}
                  >
                    Limpar busca
                  </Button>
                </>
              ) : (
                <>
                  <LinkBreak aria-hidden size={32} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Ninguém livre no momento</p>
                  <p className="text-sm text-muted-foreground">Todos os mentores já estão em dupla.</p>
                  <Button
                    variant="ghost" size="sm" className="mt-2"
                    onClick={() => setSemDupla(false)}
                  >
                    Ver todos
                  </Button>
                </>
              )}
            </div>
          )}
          {pessoasFiltradas.map((p, i) => (
            <PessoaRow
              key={p.id}
              p={p}
              indice={i}
              emDupla={emDupla.has(p.id)}
              temHistorico={temQualquerDupla.has(p.id)}
              podeExcluir={!p.user_id && !temQualquerDupla.has(p.id)}
              mentorProfile={mentorProfiles[p.id]}
              vagas={contagemPorMentor[p.id] ?? 0}
              docs={assinaturas[p.id]}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Mentorados ({filtrando ? `${mentoradosFiltrados.length} de ${mentorados.length}` : mentorados.length})
        </h2>
        <div className="rounded-xl bg-card shadow-[var(--shadow-border)] divide-y divide-border overflow-hidden">
          {mentorados.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <Student aria-hidden size={32} className="text-muted-foreground" />
              <p className="text-sm font-medium">Nenhum mentorado cadastrado ainda</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Quem recebe a mentoria entra por aqui — um a um ou trazendo a
                lista inteira de uma planilha.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <ImportarCsvDialog tipoInicial="mentorados" />
                <NovoMentoradoDialog />
              </div>
            </div>
          )}
          {mentorados.length > 0 && mentoradosFiltrados.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              {q ? (
                <>
                  <MagnifyingGlass aria-hidden size={32} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum resultado para “{busca.trim()}”</p>
                  <p className="text-sm text-muted-foreground">Tente outro nome ou ONG.</p>
                  <Button
                    variant="outline" size="sm" className="mt-2"
                    onClick={() => setBusca("")}
                  >
                    Limpar busca
                  </Button>
                </>
              ) : (
                <>
                  <LinkBreak aria-hidden size={32} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum mentorado livre no momento</p>
                  <p className="text-sm text-muted-foreground">Todos os mentorados já estão em dupla.</p>
                  <Button
                    variant="ghost" size="sm" className="mt-2"
                    onClick={() => setSemDupla(false)}
                  >
                    Ver todos
                  </Button>
                </>
              )}
            </div>
          )}
          {mentoradosFiltrados.map((m, i) => (
            <MentoradoRow
              key={m.id}
              m={m}
              indice={i}
              emDupla={emDupla.has(m.id)}
              temDupla={temQualquerDupla.has(m.id)}
              docs={assinaturas[m.id]}
            />
          ))}
        </div>
      </section>
    </>
  );
}

/** Botão "Detalhes" com chevron — abre a região operacional da linha (vagas,
 *  pendências, autorização), que saiu da linha principal pra não poluir a
 *  leitura. O dot warn sinaliza "tem pendência aqui" sem devolver jargão. */
function DetalhesTrigger({
  aberto,
  controlsId,
  temPendencia,
  onAlternar,
}: {
  aberto: boolean;
  controlsId: string;
  temPendencia: boolean;
  onAlternar: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={aberto}
      aria-controls={controlsId}
      onClick={onAlternar}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
    >
      Detalhes
      {temPendencia && (
        <>
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--warn)]" />
          <span className="sr-only">(com pendências)</span>
        </>
      )}
      <CaretDown
        aria-hidden
        size={13}
        className={cn(
          "transition-transform duration-150",
          aberto && "rotate-180"
        )}
      />
    </button>
  );
}

/** Item da região "Detalhes" — ícone discreto + frase completa em linguagem
 *  humana (o que era "pendências: termo · formação" vira uma linha por item). */
function ItemDetalhe({
  icone: Icone,
  warn = false,
  children,
}: {
  icone: Icon;
  /** Pendência que pede ação — ícone e texto ganham destaque discreto. */
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icone
        aria-hidden
        size={15}
        className={cn(
          "mt-0.5 shrink-0",
          warn ? "text-[var(--warn-text)]" : "text-muted-foreground"
        )}
      />
      <span className={warn ? undefined : "text-muted-foreground"}>
        {children}
      </span>
    </li>
  );
}

/** Região colapsável de detalhes — sempre montada com `hidden` pra que
 *  aria-controls resolva também fechada; largura cheia abaixo da linha, segura
 *  em 390px. */
function DetalhesRegiao({
  id,
  nome,
  aberto,
  children,
}: {
  id: string;
  /** Nome da pessoa — compõe o aria-label da região. */
  nome: string;
  aberto: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      role="region"
      aria-label={`Detalhes de ${nome}`}
      hidden={!aberto}
      className="mt-2.5 rounded-lg bg-muted/40 px-3 py-2.5"
    >
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

/** Linha de pessoa com acesso — avatar, nome e contexto essencial na linha;
 *  vagas e pendências do mentor ficam na região "Detalhes" colapsável. */
function PessoaRow({
  p,
  indice,
  emDupla,
  temHistorico,
  podeExcluir,
  mentorProfile: mp,
  vagas,
  docs: docsProp,
}: {
  p: Profile;
  indice: number;
  emDupla: boolean;
  /** qualquer dupla — inclusive encerrada: quem tem histórico não é "sem
   *  dupla" (e a exclusão fica bloqueada por isso) */
  temHistorico: boolean;
  podeExcluir: boolean;
  mentorProfile: MentorProfile | undefined;
  vagas: number;
  docs: DocsPessoa | undefined;
}) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  // mentor sem linha em mentor_profiles vale capacidade 1 (mesma regra do createDupla)
  const capacidade = mp?.capacidade ?? 1;
  const detalhesId = `detalhes-${p.id}`;
  const temPendencia = ehMentor(p) && (!mp?.termo_ok || !mp?.formacao_ok);
  const docs = docsProp ?? DOCS_VAZIO;
  const assinadoTermo = docs.assinado["termo-voluntario"];
  return (
    <div
      className="animate-enter px-4 py-3.5 sm:px-5"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* um Link só engloba avatar+nome+meta — tabstop único e alvo
            de toque maior; aria-label pro nome acessível não virar
            "Nome email +55…" (o Avatar já é aria-hidden) */}
        <Link
          href={`/pessoas/${p.id}`}
          aria-label={`Abrir perfil de ${p.nome}`}
          className="group -my-1.5 flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar
            nome={p.nome}
            src={p.avatar_path ? avatarPublicUrl(p.avatar_path) : null}
            size={32}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium underline-offset-4 transition-colors group-hover:underline">
              {p.nome}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {p.email}
              {p.whatsapp ? ` · ${formatarWhatsApp(p.whatsapp)}` : ""}
            </span>
          </span>
        </Link>
        {!p.ativo && (
          <Badge variant="outline" className="text-xs shrink-0 border-[var(--danger)]/50 text-[var(--danger)]">
            inativa
          </Badge>
        )}
        {p.ativo && !p.user_id && (
          <Badge variant="outline" className="text-xs shrink-0">ainda não entrou</Badge>
        )}
        {/* pra mentor a linha "Cuida de X de Y" em Detalhes já diz "em dupla" —
            o badge só aparece quando ela não cobriria (vagas 0) */}
        {emDupla && !(ehMentor(p) && vagas > 0) && (
          <Badge variant="outline" className="text-xs shrink-0">em dupla</Badge>
        )}
        {ehMentor(p) && !mp?.termo_ok && (
          <Badge
            variant="outline"
            className="text-xs shrink-0 border-[var(--warn)]/60 text-[var(--warn-text)]"
          >
            termo pendente
          </Badge>
        )}
        {/* vagas e pendências do mentor saíram da linha — ficam em "Detalhes".
            Sem badge "especialista": o seletor de papel na mesma linha já diz
            "mentor especialista" (mp.tipo é derivado de role) */}
        {ehMentor(p) && (
          <DetalhesTrigger
            aberto={detalhesAbertos}
            controlsId={detalhesId}
            temPendencia={temPendencia}
            onAlternar={() => setDetalhesAbertos((v) => !v)}
          />
        )}
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-40">
            <RoleSelect profileId={p.id} role={p.role} nome={p.nome} />
          </div>
          <PessoaActions
            pessoa={p}
            // mesma guarda do server: qualquer dupla (até encerrada) bloqueia excluir
            podeExcluir={podeExcluir}
          />
        </div>
      </div>
      {ehMentor(p) && (
        <DetalhesRegiao id={detalhesId} nome={p.nome} aberto={detalhesAbertos}>
          <ItemDetalhe icone={Users}>
            {vagas === 0
              ? temHistorico
                ? "Sem dupla ativa — histórico de dupla encerrada fica na ficha"
                : `Ainda sem dupla — ${capacidade === 1 ? "vaga para 1" : `vagas para ${capacidade}`}`
              : `Cuida de ${vagas} de ${capacidade} ${capacidade === 1 ? "dupla" : "duplas"}`}
          </ItemDetalhe>
          {mp?.termo_ok ? (
            <ItemDetalhe icone={FileText}>
              {assinadoTermo !== undefined
                ? `Termo de adesão assinado${assinadoTermo ? ` em ${fmtDia(assinadoTermo)}` : ""}`
                : "Termo de adesão no arquivo"}
            </ItemDetalhe>
          ) : (
            <ItemDetalhe icone={FileText} warn>
              Termo de adesão pendente de assinatura
            </ItemDetalhe>
          )}
          {!mp?.formacao_ok && (
            <ItemDetalhe icone={GraduationCap} warn>
              Formação inicial pendente
            </ItemDetalhe>
          )}
        </DetalhesRegiao>
      )}
    </div>
  );
}

/** Linha de mentorado — mesma gramática da de pessoa; a autorização do
 *  responsável (LGPD) vira frase completa em "Detalhes", não badge de jargão. */
function MentoradoRow({
  m,
  indice,
  emDupla,
  temDupla,
  docs: docsProp,
}: {
  m: Mentorado;
  indice: number;
  emDupla: boolean;
  temDupla: boolean;
  docs: DocsPessoa | undefined;
}) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const detalhesId = `detalhes-${m.id}`;
  // LGPD: parear menor sem a autorização do responsável é pendência jurídica.
  // Vale tanto o upload manual (documento_path) quanto a assinatura por link.
  const docs = docsProp ?? DOCS_VAZIO;
  const autData = docs.assinado["autorizacao-responsavel"];
  const termoData = docs.assinado["termo-mentorando"];
  const autorizacaoOk = Boolean(m.documento_path) || autData !== undefined;
  const termoOk = termoData !== undefined;
  const autEnviada = docs.pendente.includes("autorizacao-responsavel");
  const termoEnviado = docs.pendente.includes("termo-mentorando");
  const temPendencia = !autorizacaoOk || !termoOk;
  const temDocs =
    temPendencia ||
    Object.keys(docs.assinado).length > 0 ||
    docs.pendente.length > 0;
  return (
    <div
      className="animate-enter px-4 py-3.5 sm:px-5"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={`/pessoas/${m.id}`}
          aria-label={`Abrir perfil de ${m.nome}`}
          className="group -my-1.5 flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar
            nome={m.nome}
            src={m.avatar_path ? avatarPublicUrl(m.avatar_path) : null}
            papel="mentorado"
            size={32}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {!m.avatar_path && (
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--role-mentorado)]" />
              )}
              <span className="truncate underline-offset-4 transition-colors group-hover:underline">
                {m.nome}
              </span>
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {m.ong_origem ?? <span className="italic">sem ONG</span>}
              {m.whatsapp ? ` · ${formatarWhatsApp(m.whatsapp)}` : ""}
            </span>
          </span>
        </Link>
        {emDupla && (
          <Badge variant="outline" className="text-xs shrink-0">em dupla</Badge>
        )}
        {!autorizacaoOk && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs shrink-0",
              !autEnviada &&
                "border-[var(--warn)]/60 text-[var(--warn-text)]"
            )}
          >
            {autEnviada ? "autorização enviada" : "autorização pendente"}
          </Badge>
        )}
        {!termoOk && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs shrink-0",
              !termoEnviado &&
                "border-[var(--warn)]/60 text-[var(--warn-text)]"
            )}
          >
            {termoEnviado ? "termo enviado" : "termo pendente"}
          </Badge>
        )}
        {temDocs && (
          <DetalhesTrigger
            aberto={detalhesAbertos}
            controlsId={detalhesId}
            temPendencia={temPendencia}
            onAlternar={() => setDetalhesAbertos((v) => !v)}
          />
        )}
        <div className="flex items-center gap-2 ml-auto">
          <MentoradoActions mentorado={m} temDupla={temDupla} />
        </div>
      </div>
      {temDocs && (
        <DetalhesRegiao id={detalhesId} nome={m.nome} aberto={detalhesAbertos}>
          <ItemDetalhe icone={FileText} warn={!autorizacaoOk}>
            {autorizacaoOk
              ? autData !== undefined
                ? `Autorização do responsável assinada${autData ? ` em ${fmtDia(autData)}` : ""}`
                : "Autorização do responsável no arquivo"
              : autEnviada
                ? "Autorização enviada — aguardando a assinatura do responsável"
                : "Autorização do responsável ainda não enviada"}
          </ItemDetalhe>
          <ItemDetalhe icone={FileText} warn={!termoOk}>
            {termoOk
              ? `Termo de participação assinado${termoData ? ` em ${fmtDia(termoData)}` : ""}`
              : termoEnviado
                ? "Termo de participação enviado — aguardando assinatura"
                : "Termo de participação ainda não enviado"}
          </ItemDetalhe>
        </DetalhesRegiao>
      )}
    </div>
  );
}
