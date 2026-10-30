"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  ArrowsLeftRight,
  CaretDown,
  Check,
  Student,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import type { Mentorado, MentorProfile, Profile } from "@/lib/types";
import type { FilaItem } from "@/lib/fila";
import { textoEspera, tetoMentor } from "@/lib/fila";
import { msgAguardandoPar } from "@/lib/whatsapp-msgs";
import { avatarPublicUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { WhatsAppRapido } from "@/components/whatsapp-rapido";
import { MentoradoActions } from "@/components/mentorado-actions";
import { PessoaActions } from "@/components/pessoa-actions";
import { AfinidadePar } from "@/components/matching-afinidade";
import { CapacidadeMentorDialog } from "@/components/capacidade-mentor-dialog";
import { NovaDuplaDialog } from "@/components/nova-dupla-dialog";

/** Card "Aguardando par" — fila de espera + pareamento num lugar só
 *  (REALIZA-101 + rodada fev/2026). Dois estados no mesmo card:
 *
 *  - Fila: quem nunca teve par (mentorados) + mentores DPP com vaga livre —
 *    o contexto da decisão (tempo de espera, origem, contato). A linha tem
 *    um "parear" que já entra no outro estado com a pessoa escolhida.
 *  - Parear: as mesmas duas colunas viram o seletor — clica no jovem, clica
 *    no mentor, a afinidade aparece embaixo e "Formar dupla" abre o dialog
 *    já com os dois escolhidos. O pool aqui é o completo: mentorado livre
 *    inclui remanejo e o mentor cheio afunda marcado "sem vaga" (comparar
 *    a afinidade dele ainda vale — a saída pode ser aumentar a capacidade).
 *
 *  Só DPP: especialista pareja por demanda no mural, não nesta fila — o
 *  híbrido entra pelo papel DPP. */
export function FilaEspera({
  mentorados,
  mentores,
  mentoradosPorId,
  pessoasPorId,
  semHistorico,
  euNome,
  mentoradosLivres,
  mentoresDpp,
  mentorProfiles,
  ocupacao,
}: {
  mentorados: FilaItem[];
  mentores: FilaItem[];
  /** Fichas completas por id — o ⋯ de cada linha abre as mesmas ações das
   *  listas abaixo, sem a coord ter que procurar a pessoa duas vezes. */
  mentoradosPorId: ReadonlyMap<string, Mentorado>;
  pessoasPorId: ReadonlyMap<string, Profile>;
  /** Ids com qualquer dupla (até encerrada) — mesma guarda do podeExcluir
   *  das linhas principais; no Parear marca o remanejo. */
  semHistorico: ReadonlySet<string>;
  /** Nome de quem opera — assina a mensagem pronta do WhatsApp. */
  euNome?: string | null;
  /** Pool completo do modo Parear — todo mentorado sem dupla viva (inclui
   *  quem já teve par) e todo mentor DPP ativo, com ou sem vaga. */
  mentoradosLivres: Mentorado[];
  mentoresDpp: Profile[];
  mentorProfiles: Record<string, MentorProfile>;
  /** Ocupação por `${mentorId}:${trilha}` — aqui só a chave :dpp interessa. */
  ocupacao: Record<string, number>;
}) {
  const total = mentorados.length + mentores.length;
  // congelado na hidratação — o "há N dias" não pode divergir do SSR
  const [agoraMs] = useState(() => Date.now());
  // o card nasce aberto (inscrito novo precisa aparecer) e lembra a
  // preferência — mesmo padrão do antigo painel de matching
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("aguardando-par-open") !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("aguardando-par-open", open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [open]);

  const [modo, setModo] = useState<"fila" | "parear">("fila");
  const [selMentorado, setSelMentorado] = useState<string | null>(null);
  const [selMentor, setSelMentor] = useState<string | null>(null);

  /** Atalho da linha da fila: entra no modo Parear com a pessoa já marcada. */
  function iniciarParear(lado: "mentor" | "mentorado", id: string) {
    if (lado === "mentorado") setSelMentorado(id);
    else setSelMentor(id);
    setModo("parear");
  }

  // seleção efetiva = a marcada só enquanto estiver no pool — dupla
  // formada dispara refresh e o jovem some dos livres; id apontando pra
  // ninguém deixaria o "Formar dupla" morto sem explicação
  const selMentoradoEf =
    selMentorado && mentoradosLivres.some((m) => m.id === selMentorado)
      ? selMentorado
      : null;
  const selMentorEf =
    selMentor && mentoresDpp.some((m) => m.id === selMentor)
      ? selMentor
      : null;

  // ————— derivação do modo Parear —————
  const tetoDe = (id: string) => {
    const p = mentoresDpp.find((m) => m.id === id);
    if (!p) return 1;
    return tetoMentor(p, mentorProfiles[id], "dpp");
  };
  const usadasDe = (id: string) => ocupacao[`${id}:dpp`] ?? 0;
  // livres primeiro (mais vagas na frente), cheios afundam; nome desempata
  const mentoresOrd = [...mentoresDpp].sort(
    (a, b) =>
      tetoDe(b.id) - usadasDe(b.id) - (tetoDe(a.id) - usadasDe(a.id)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
  const mentorSelObj = mentoresDpp.find((m) => m.id === selMentorEf) ?? null;
  const mentoradoSelObj =
    mentoradosLivres.find((m) => m.id === selMentoradoEf) ?? null;
  const mpSel = mentorSelObj ? mentorProfiles[mentorSelObj.id] : undefined;
  const mentorLotado =
    mentorSelObj != null && usadasDe(mentorSelObj.id) >= tetoDe(mentorSelObj.id);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <section
        aria-labelledby="fila-espera-titulo"
        className="rounded-xl bg-card shadow-[var(--shadow-border)] overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-2 sm:px-5">
          <Collapsible.Trigger
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              id="fila-espera-titulo"
              className="text-base font-semibold tabular-nums"
            >
              Aguardando par · {total}
            </span>
            <CaretDown
              aria-hidden
              size={16}
              className={cn(
                "shrink-0 transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </Collapsible.Trigger>
          {open && (
            <div
              role="group"
              aria-label="Modo do card"
              className="flex shrink-0 rounded-lg border border-border p-0.5"
            >
              {(["fila", "parear"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant="ghost"
                  aria-pressed={modo === m}
                  onClick={() => setModo(m)}
                  className={cn(
                    "h-auto rounded-md px-2.5 py-1 text-xs md:h-auto",
                    modo === m
                      ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                      : "text-muted-foreground"
                  )}
                >
                  {m === "fila" ? "Fila" : "Parear"}
                </Button>
              ))}
            </div>
          )}
        </div>

        <Collapsible.Panel
          keepMounted
          className="h-[var(--collapsible-panel-height)] overflow-hidden opacity-100 transition-[height,opacity] duration-200 data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 [&[hidden]:not([hidden='until-found'])]:hidden"
        >
          <div className="px-4 pb-4 sm:px-5">
            {modo === "fila" ? (
              total === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <UsersThree aria-hidden size={18} />
                  </span>
                  <p className="text-sm font-medium">Todo mundo pareado</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Quando uma inscrição chegar ou um mentor abrir vaga, a
                    espera aparece aqui, com quanto tempo a pessoa aguarda.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                  <FilaColuna
                    titulo="Mentorados"
                    itens={mentorados}
                    lado="mentorado"
                    vazio="Nenhum mentorado aguardando."
                    mentoradosPorId={mentoradosPorId}
                    pessoasPorId={pessoasPorId}
                    semHistorico={semHistorico}
                    euNome={euNome}
                    agoraMs={agoraMs}
                    onParear={iniciarParear}
                  />
                  <FilaColuna
                    titulo="Mentores com vaga"
                    itens={mentores}
                    lado="mentor"
                    vazio="Nenhum mentor com vaga livre."
                    mentoradosPorId={mentoradosPorId}
                    pessoasPorId={pessoasPorId}
                    semHistorico={semHistorico}
                    euNome={euNome}
                    agoraMs={agoraMs}
                    onParear={iniciarParear}
                  />
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                  <ParearColuna
                    rotulo="Mentorados livres"
                    vazio="Nenhum mentorado livre pra parear."
                  >
                    {mentoradosLivres.map((m, i) => (
                      <ParearLinha
                        key={m.id}
                        indice={i}
                        selecionado={selMentoradoEf === m.id}
                        onSelecionar={() =>
                          setSelMentorado(selMentoradoEf === m.id ? null : m.id)
                        }
                        nome={m.nome}
                        avatarPath={m.avatar_path}
                        papel="mentorado"
                        meta={
                          [
                            semHistorico.has(m.id) ? "remanejo" : null,
                            m.ong_origem ?? m.origem,
                          ]
                            .filter(Boolean)
                            .join(" · ") || null
                        }
                      />
                    ))}
                  </ParearColuna>
                  <ParearColuna
                    rotulo="Mentores DPP"
                    vazio="Nenhum mentor DPP ativo."
                  >
                    {mentoresOrd.map((m, i) => {
                      const livres = tetoDe(m.id) - usadasDe(m.id);
                      return (
                        <ParearLinha
                          key={m.id}
                          indice={i}
                          selecionado={selMentorEf === m.id}
                          onSelecionar={() =>
                            setSelMentor(selMentorEf === m.id ? null : m.id)
                          }
                          nome={m.nome}
                          avatarPath={m.avatar_path}
                          meta={`${usadasDe(m.id)}/${tetoDe(m.id)}${
                            livres <= 0
                              ? " · sem vaga"
                              : ` · ${livres} ${livres === 1 ? "vaga" : "vagas"}`
                          }`}
                        />
                      );
                    })}
                  </ParearColuna>
                </div>

                {mentorSelObj && mentorLotado && (
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--warn-text)]">
                    <Warning size={13} aria-hidden className="shrink-0" />
                    {mentorSelObj.nome.split(" ")[0]} está sem vaga (
                    {usadasDe(mentorSelObj.id)}/{tetoDe(mentorSelObj.id)} duplas
                    em andamento). Se a afinidade fechar,{" "}
                    <CapacidadeMentorDialog
                      mentorId={mentorSelObj.id}
                      nome={mentorSelObj.nome}
                      atual={tetoDe(mentorSelObj.id)}
                      emUso={usadasDe(mentorSelObj.id)}
                      trilha="dpp"
                      trigger={
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="-my-2 sm:my-0"
                        >
                          aumentar capacidade →
                        </Button>
                      }
                    />
                  </p>
                )}

                {mentorSelObj && mentoradoSelObj ? (
                  <AfinidadePar
                    mentor={{
                      nome: mentorSelObj.nome,
                      interesses: mentorSelObj.interesses,
                      cidade: mentorSelObj.cidade,
                      uf: mentorSelObj.uf,
                      genero: mentorSelObj.genero ?? null,
                      cor_raca: mentorSelObj.cor_raca ?? null,
                      pref_genero_par: mentorSelObj.pref_genero_par ?? null,
                      motivacao: mentorSelObj.motivacao ?? null,
                      disponibilidade: mpSel?.disponibilidade ?? null,
                      trilha: "dpp",
                      areas: mpSel?.areas ?? null,
                    }}
                    mentorado={{
                      nome: mentoradoSelObj.nome,
                      interesses: mentoradoSelObj.interesses,
                      cidade: mentoradoSelObj.cidade,
                      uf: mentoradoSelObj.uf,
                      genero: mentoradoSelObj.genero ?? null,
                      cor_raca: mentoradoSelObj.cor_raca ?? null,
                      pref_genero_par: mentoradoSelObj.pref_genero_par ?? null,
                      motivacao: mentoradoSelObj.motivacao ?? null,
                      objetivos: mentoradoSelObj.objetivos,
                      escolaridade: mentoradoSelObj.escolaridade,
                      data_nascimento: mentoradoSelObj.data_nascimento,
                      disponibilidade: mentoradoSelObj.disponibilidade ?? null,
                    }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Toque num jovem e num mentor pra comparar interesses,
                    cor/raça, preferências e agenda antes de formar a dupla.
                  </p>
                )}

                <div className="flex justify-end pt-1">
                  <NovaDuplaDialog
                    mentorIdInicial={selMentorEf}
                    mentoradoIdInicial={selMentoradoEf}
                    trigger={
                      <Button size="sm" disabled={!mentorSelObj || !mentoradoSelObj}>
                        <ArrowsLeftRight size={15} aria-hidden />
                        Formar dupla
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </Collapsible.Panel>
      </section>
    </Collapsible.Root>
  );
}

function FilaColuna({
  titulo,
  itens,
  lado,
  vazio,
  mentoradosPorId,
  pessoasPorId,
  semHistorico,
  euNome,
  agoraMs,
  onParear,
}: {
  titulo: string;
  itens: FilaItem[];
  lado: "mentor" | "mentorado";
  vazio: string;
  mentoradosPorId: ReadonlyMap<string, Mentorado>;
  pessoasPorId: ReadonlyMap<string, Profile>;
  semHistorico: ReadonlySet<string>;
  euNome?: string | null;
  agoraMs: number;
  onParear: (lado: "mentor" | "mentorado", id: string) => void;
}) {
  // min-w-0: a coluna cede largura ao grid em vez de herdar o nowrap da linha
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular-nums">
        {lado === "mentorado" ? (
          <Student aria-hidden size={14} />
        ) : (
          <UsersThree aria-hidden size={14} />
        )}
        {titulo} ({itens.length})
      </p>
      {itens.length === 0 ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {itens.map((p, i) => (
            <FilaLinha
              key={p.id}
              p={p}
              indice={i}
              lado={lado}
              mentoradosPorId={mentoradosPorId}
              pessoasPorId={pessoasPorId}
              semHistorico={semHistorico}
              euNome={euNome}
              agoraMs={agoraMs}
              onParear={onParear}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Miolo visual da linha — avatar + nome + meta, compartilhado entre a
 *  linha-link da fila e a linha-botão do parear. */
function LinhaConteudo({
  nome,
  avatarPath,
  papel,
  meta,
  destaqueMeta,
}: {
  nome: string;
  avatarPath: string | null | undefined;
  papel?: "mentorado";
  meta: string | null;
  /** prefixo do meta em destaque (o "há N dias" da espera) */
  destaqueMeta?: string | null;
}) {
  return (
    <>
      <Avatar
        nome={nome}
        src={avatarPath ? avatarPublicUrl(avatarPath) : null}
        papel={papel}
        size={30}
      />
      <span className="min-w-0">
        {/* nome quebra linha em vez de truncar (título de item não trunca) */}
        <span className="block break-words text-sm font-medium underline-offset-4 transition-colors group-hover:underline">
          {nome}
        </span>
        <span
          className="block truncate text-xs text-muted-foreground"
          title={meta || undefined}
        >
          {destaqueMeta && (
            <span className="font-medium text-foreground/70">
              {destaqueMeta}
              {meta ? " · " : ""}
            </span>
          )}
          {meta || (!destaqueMeta ? "cadastro sem data de inscrição" : "")}
        </span>
      </span>
    </>
  );
}

/** Linha da fila — avatar+nome linkam pra ficha, meta carrega espera +
 *  origem (+ vagas do mentor), WhatsApp no canto e o "parear" como atalho
 *  pro modo Parear já com a pessoa marcada. */
function FilaLinha({
  p,
  indice,
  lado,
  mentoradosPorId,
  pessoasPorId,
  semHistorico,
  euNome,
  agoraMs,
  onParear,
}: {
  p: FilaItem;
  indice: number;
  lado: "mentor" | "mentorado";
  mentoradosPorId: ReadonlyMap<string, Mentorado>;
  pessoasPorId: ReadonlyMap<string, Profile>;
  semHistorico: ReadonlySet<string>;
  euNome?: string | null;
  agoraMs: number;
  onParear: (lado: "mentor" | "mentorado", id: string) => void;
}) {
  const primeiroNome = p.nome.trim().split(/\s+/)[0];
  const espera = p.desde ? textoEspera(p.desde, agoraMs) : null;
  const resto = [
    p.origem,
    p.vagas != null
      ? `${p.vagas} ${p.vagas === 1 ? "vaga livre" : "vagas livres"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const meta = [resto].filter(Boolean).join(" · ") || null;
  return (
    <li
      className="animate-enter flex items-center gap-3 py-2"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <Link
        href={`/pessoas/${p.id}`}
        aria-label={`Abrir perfil de ${p.nome}`}
        className="group -my-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LinhaConteudo
          nome={p.nome}
          avatarPath={p.avatar_path}
          papel={lado === "mentorado" ? "mentorado" : undefined}
          meta={meta}
          destaqueMeta={espera}
        />
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Parear ${primeiroNome}`}
        title={`Parear ${primeiroNome}`}
        onClick={() => onParear(lado, p.id)}
        className="shrink-0 text-muted-foreground"
      >
        <ArrowsLeftRight size={15} aria-hidden />
      </Button>
      <WhatsAppRapido
        icone
        destinos={[
          {
            rotulo: `Chamar ${primeiroNome} no WhatsApp`,
            telefone: p.whatsapp,
            mensagem: msgAguardandoPar(lado, p.nome, euNome ?? undefined),
            t: "contato",
          },
        ]}
      />
      {/* ⋯ direto na fila — quem aguarda par é exatamente quem precisa de
          edição/saída; mesma guarda de exclusão das linhas principais */}
      {lado === "mentorado"
        ? (() => {
            const m = mentoradosPorId.get(p.id);
            return m ? (
              <MentoradoActions
                mentorado={m}
                temDupla={false}
                duplaVivaId={null}
              />
            ) : null;
          })()
        : (() => {
            const pr = pessoasPorId.get(p.id);
            return pr ? (
              <PessoaActions
                pessoa={pr}
                podeExcluir={!pr.user_id && !semHistorico.has(p.id)}
              />
            ) : null;
          })()}
    </li>
  );
}

/** Coluna do modo Parear — radiogroup: cada linha é um radio, um por lado. */
function ParearColuna({
  rotulo,
  vazio,
  children,
}: {
  rotulo: string;
  vazio: string;
  children: React.ReactNode;
}) {
  const itens = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      {itens === 0 ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul
          role="radiogroup"
          aria-label={rotulo}
          className="max-h-80 divide-y divide-border/60 overflow-y-auto"
        >
          {children}
        </ul>
      )}
    </div>
  );
}

/** Linha selecionável do Parear — o radio propriamente dito. Selecionada
 *  ganha o anel da marca e um check; o clique repete pra desselecionar. */
function ParearLinha({
  nome,
  avatarPath,
  papel,
  meta,
  selecionado,
  onSelecionar,
  indice,
}: {
  nome: string;
  avatarPath: string | null | undefined;
  papel?: "mentorado";
  meta: string | null;
  selecionado: boolean;
  onSelecionar: () => void;
  indice: number;
}) {
  return (
    <li
      className="animate-enter"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <Button
        type="button"
        variant="ghost"
        role="radio"
        aria-checked={selecionado}
        onClick={onSelecionar}
        className={cn(
          "h-auto w-full justify-start whitespace-normal rounded-lg px-2 py-2 text-left md:h-auto",
          selecionado
            ? "bg-[var(--brand-lime)]/15 ring-1 ring-[var(--brand-lime)]/60 hover:bg-[var(--brand-lime)]/20"
            : null
        )}
      >
        <LinhaConteudo
          nome={nome}
          avatarPath={avatarPath}
          papel={papel}
          meta={meta}
        />
        {selecionado && (
          <Check
            size={16}
            weight="bold"
            aria-hidden
            className="ml-auto shrink-0 text-foreground"
          />
        )}
      </Button>
    </li>
  );
}
