"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  MagnifyingGlass,
  MapPin,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/avatar";
import { EspecialistaCatalogoCard } from "@/components/especialista-catalogo-card";
import { SecaoPessoas } from "@/components/secao-pessoas";
import { FormSurface } from "@/components/form-surface";
import { HighlightText } from "@/components/highlight-text";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  OpcaoPilula,
  OVERLINE,
} from "@/components/ui/filtro-opcoes";
import { FiltrosButton } from "@/components/ui/filtros-button";
import { Input } from "@/components/ui/input";
import { avatarPublicUrl } from "@/lib/avatar";
import { waLink } from "@/lib/ciclo";
import { fuzzyMatch } from "@/lib/fuzzy";
import { msgApresentacaoJovem } from "@/lib/whatsapp-msgs";
import {
  baldeDaEntrada,
  FACETAS_DIRETORIO,
  GRUPOS_DIRETORIO,
  rotuloFaceta,
  rotuloTipo,
  type BaldeDiretorio,
  type DiretorioPessoa,
  type FacetaDiretorio,
} from "@/lib/jovem-diretorio";
import type { JovemEspecialista } from "@/lib/types";
import { cn, normaliza } from "@/lib/utils";

// O diretório navegável do jovem (023): a página entrega a lista enriquecida
// (rede marcada) e TUDO filtra no client sobre o payload SSR — faceta de
// vínculo (?papel), chip de tema (?area) e busca fuzzy (?busca), estado na
// URL por replaceState pra deep-link, mesma gramática do /pessoas de staff.
// A grade abre agrupada por papel (onda 4): as mesmas seções nomeadas com
// contagem que a staff lê — "Minha rede" fica fora por ser lente
// transversal, não um balde. Filtros moram num modal único (REALIZA-525):
// a régua de pills expostas saía da largura do celular — a entrada
// "Filtros" abre o painel rico (rascunho → Aplicar, FormSurface = sheet
// no mobile / dialog no desktop). O card da rede abre o WhatsApp quando
// a view já autoriza o canal — o mesmo dado da ficha, projetado por
// enriqueceDiretorio.

const FACETA_IDS = new Set(FACETAS_DIRETORIO.map((f) => f.id));

/** A linha de catálogo do diretório na forma do card — vagas pode chegar
 *  null da view (braço adulto/jovem não tem), o card espera número. */
function especialistaDe(p: DiretorioPessoa): JovemEspecialista {
  return {
    id: p.id,
    nome: p.nome,
    nome_social: p.nome_social,
    avatar_path: p.avatar_path,
    areas: p.areas,
    bio: p.bio,
    cargo: p.cargo,
    empresa: p.empresa,
    cidade: p.cidade,
    uf: p.uf,
    voluntariado: p.voluntariado,
    experiencia_previa: p.experiencia_previa,
    formacao_externa: p.formacao_externa,
    grade_resumo: p.grade_resumo,
    vagas: p.vagas ?? 0,
  };
}

export function JovemDiretorio({
  pessoas,
  nomeJovem,
}: {
  pessoas: DiretorioPessoa[];
  /** Nome de tela do jovem — assina a mensagem pronta do WhatsApp que o
   *  card da rede abre (a mesma da ficha e da seção "Sua rede"). */
  nomeJovem: string;
}) {
  const [busca, setBusca] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("busca") ?? "";
  });
  const [buscaDebounced, setBuscaDebounced] = useState(busca);
  const [faceta, setFaceta] = useState<FacetaDiretorio>(() => {
    if (typeof window === "undefined") return "todos";
    const p = new URLSearchParams(window.location.search).get("papel");
    return p && FACETA_IDS.has(p as FacetaDiretorio)
      ? (p as FacetaDiretorio)
      : "todos";
  });
  const [areaSel, setAreaSel] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("area");
  });

  // debounce da busca (300ms) — mesmo padrão do /pessoas (REALIZA-318)
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  // persistência dos recortes na URL — deep-link sem refetch (o server já
  // entregou a lista inteira)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (busca) sp.set("busca", busca);
    else sp.delete("busca");
    if (faceta !== "todos") sp.set("papel", faceta);
    else sp.delete("papel");
    if (areaSel != null) sp.set("area", areaSel);
    else sp.delete("area");
    const qs = sp.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname
    );
  }, [busca, faceta, areaSel]);

  const qtBusca = buscaDebounced.trim();
  const q = normaliza(qtBusca);
  const filtrando = Boolean(q) || faceta !== "todos" || areaSel != null;

  // a faceta recorta por vínculo — "rede" é lente (p.rede), os demais vão
  // pelo balde único onde a pessoa mora
  const recorteDe = (f: FacetaDiretorio) =>
    f === "todos"
      ? pessoas
      : f === "rede"
        ? pessoas.filter((p) => p.rede)
        : pessoas.filter((p) => baldeDaEntrada(p) === f);
  const porFaceta = recorteDe(faceta);

  // modal de filtros (REALIZA-525): as réguas de pills viviam estourando a
  // barra do celular — o painel único rascunha vínculo + tema e aplica de
  // uma vez (gramática dos filtros de /registros e /pessoas da coord)
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [draft, setDraft] = useState<{
    faceta: FacetaDiretorio;
    area: string | null;
  }>({ faceta: "todos", area: null });
  const abrirFiltros = () => {
    setDraft({ faceta, area: areaSel });
    setFiltrosAberto(true);
  };
  const ativosFiltro =
    (faceta !== "todos" ? 1 : 0) + (areaSel != null ? 1 : 0);
  const draftAtivos =
    (draft.faceta !== "todos" ? 1 : 0) + (draft.area != null ? 1 : 0);
  const aplicarDraft = () => {
    setFaceta(draft.faceta);
    setAreaSel(draft.area);
    setFiltrosAberto(false);
  };

  // chips de tema: união de areas (adulto/especialista) e interesses
  // (jovem) presentes NO RECORTE da faceta — frequência desc, alfabético.
  // Calculado antes do filtro de área pra opção ativa não sumir da lista.
  const temasDe = (lista: DiretorioPessoa[]) => {
    const contagem = new Map<string, number>();
    for (const p of lista) {
      for (const a of p.areas ?? p.interesses ?? []) {
        contagem.set(a, (contagem.get(a) ?? 0) + 1);
      }
    }
    return [...contagem.entries()]
      .map(([nome, n]) => ({ nome, n }))
      .sort(
        (a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt-BR")
      );
  };
  // as opções do modal respondem ao rascunho de faceta — o tema aplicado
  // entra na lista mesmo fora do recorte novo (a pessoa não fica presa
  // num filtro sem saída, mesma régua das pílulas de encontro)
  const temasDraft = (() => {
    const t = temasDe(recorteDe(draft.faceta));
    if (draft.area != null && !t.some((x) => x.nome === draft.area)) {
      t.push({ nome: draft.area, n: 0 });
    }
    return t;
  })();

  // escopo = faceta + tema (sem a busca) — denominador honesto do "N de M"
  const escopo = areaSel
    ? porFaceta.filter((p) => (p.areas ?? p.interesses ?? []).includes(areaSel))
    : porFaceta;

  // fuzzy: o item entra pelo melhor match entre os campos visíveis — nome
  // (civil e social) e os chips que o card mostra (áreas/interesses). O
  // score pré-computado ranqueia sem re-score por comparação no sort
  const scorePorId = new Map<string, number>();
  if (q) {
    for (const p of escopo) {
      scorePorId.set(
        p.id,
        Math.max(
          ...[p.nome, p.nome_social, ...(p.areas ?? p.interesses ?? [])].map(
            (t) => (t ? (fuzzyMatch(qtBusca, t)?.score ?? 0) : 0)
          )
        )
      );
    }
  }
  // a lista chega em ordem alfabética (nome de tela) do getter — o sort
  // estável por relevância preserva ela dentro de scores iguais
  const exibidas = escopo
    .filter((p) => !q || (scorePorId.get(p.id) ?? 0) > 0)
    .sort(
      (a, b) => (scorePorId.get(b.id) ?? 0) - (scorePorId.get(a.id) ?? 0)
    );

  const limparFiltros = () => {
    setBusca("");
    setFaceta("todos");
    setAreaSel(null);
  };

  // re-key por filtro — a troca re-roda o animate-enter dos cards
  // (convenção de movimento: troca de filtro sempre anima)
  const chaveFiltros = [q, faceta, areaSel ?? ""].join("|");

  // o diretório abre agrupado por papel — a mesma leitura da staff em
  // /pessoas (seção nomeada com a contagem, ordem de GRUPOS_DIRETORIO).
  // "Minha rede" fica de fora: é lente transversal que corta os baldes,
  // não um grupo a mais — duplicar gente numa seção paralela ia contra
  // o modelo que as duas superfícies dividem
  const porBalde = new Map<BaldeDiretorio, DiretorioPessoa[]>();
  for (const b of GRUPOS_DIRETORIO) porBalde.set(b, []);
  for (const p of exibidas) porBalde.get(baldeDaEntrada(p))?.push(p);

  // o card é o mesmo na grade plana da lente e nas seções por balde —
  // especialista vai pro card de catálogo (a grade rica), o resto pro
  // DiretorioCard
  const cardDe = (p: DiretorioPessoa, i: number) =>
    p.tipo === "especialista" ? (
      <EspecialistaCatalogoCard
        key={p.id}
        e={especialistaDe(p)}
        href={`/jovem/pessoas/${p.id}`}
        acao={<WaIconLink p={p} nomeJovem={nomeJovem} />}
        badge={
          p.rede
            ? {
                texto: p.vinculo ?? "Sua rede",
                cls: "border-[var(--ok)]/50 text-[var(--ok-text)]",
              }
            : p.vagas === 0
              ? { texto: "Sem vagas", cls: "text-muted-foreground" }
              : null
        }
      />
    ) : (
      <DiretorioCard
        key={p.id}
        p={p}
        indice={i}
        marca={q ? qtBusca : undefined}
        nomeJovem={nomeJovem}
      />
    );

  return (
    <div className="space-y-4">
      {/* barra única (REALIZA-525): busca + entrada "Filtros" — as pills
          de vínculo e os chips de tema saíram da tela e viraram opções
          do painel, com o selo de ativos marcando o estado filtrado */}
      <div className="flex flex-wrap items-center gap-2" role="search">
        <div className="relative w-full sm:max-w-sm">
          <MagnifyingGlass
            aria-hidden
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar pessoa"
            placeholder="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <FiltrosButton ativos={ativosFiltro} onClick={abrirFiltros} />
        <span
          role="status"
          aria-live="polite"
          className="text-xs text-muted-foreground tabular-nums"
        >
          {filtrando
            ? `${exibidas.length} de ${escopo.length} ${
                escopo.length === 1 ? "pessoa" : "pessoas"
              }`
            : `${pessoas.length} ${
                pessoas.length === 1 ? "pessoa" : "pessoas"
              }`}
        </span>
        {filtrando && (
          <Button
            variant="ghost"
            size="sm"
            className="px-3 text-xs"
            onClick={limparFiltros}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* painel rico de filtros — o FormSurface vira sheet de rodapé no
          celular e dialog no desktop, com o "Aplicar" preso no pé */}
      <FormSurface
        open={filtrosAberto}
        onOpenChange={setFiltrosAberto}
        titulo="Filtros"
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              className="sm:me-auto"
              disabled={draftAtivos === 0}
              onClick={() => setDraft({ faceta: "todos", area: null })}
            >
              Limpar
            </Button>
            <Button type="button" onClick={aplicarDraft}>
              Aplicar{draftAtivos > 0 ? ` (${draftAtivos})` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <fieldset>
            <legend className={OVERLINE}>Vínculo</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {FACETAS_DIRETORIO.map((f) => (
                <OpcaoPilula
                  key={f.id}
                  nome="flt-vinculo"
                  valor={f.id}
                  atual={draft.faceta}
                  onSelect={(v) =>
                    setDraft((d) => ({
                      ...d,
                      faceta: v as FacetaDiretorio,
                    }))
                  }
                >
                  {f.rotulo}
                </OpcaoPilula>
              ))}
            </div>
          </fieldset>
          {temasDraft.length > 0 && (
            <fieldset>
              <legend className={OVERLINE}>Tema</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <OpcaoPilula
                  nome="flt-tema"
                  valor="__todos__"
                  atual={draft.area ?? "__todos__"}
                  onSelect={() => setDraft((d) => ({ ...d, area: null }))}
                >
                  Todos
                </OpcaoPilula>
                {temasDraft.map((t) => (
                  <OpcaoPilula
                    key={t.nome}
                    nome="flt-tema"
                    valor={t.nome}
                    atual={draft.area ?? "__todos__"}
                    onSelect={(v) =>
                      setDraft((d) => ({ ...d, area: v }))
                    }
                    className="justify-start gap-1.5 px-3"
                  >
                    <span className="min-w-0 truncate">{t.nome}</span>
                    <span
                      className={cn(
                        "ml-auto shrink-0 text-[11px] tabular-nums",
                        draft.area === t.nome
                          ? "text-background/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {t.n}
                    </span>
                  </OpcaoPilula>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </FormSurface>

      {pessoas.length === 0 ? (
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground">
            Não foi possível carregar as pessoas agora. Tente de novo
            daqui a pouco.
          </CardContent>
        </Card>
      ) : exibidas.length === 0 ? (
        <Card className="animate-enter">
          <CardContent className="py-5 text-sm text-muted-foreground">
            {faceta === "rede" && !q && areaSel == null ? (
              <>
                Quando a sua rede se formar, as pessoas aparecem aqui.
              </>
            ) : (
              <>
                Ninguém encontrado com esses filtros.{" "}
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  Limpar filtros
                </button>
              </>
            )}
          </CardContent>
        </Card>
      ) : faceta === "rede" ? (
        // "Minha rede" é lente transversal — grade plana, sem seção
        // paralela (mesma régua da grade das seções: coluna explícita +
        // items-start)
        <div
          key={chaveFiltros}
          className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2"
        >
          {exibidas.map(cardDe)}
        </div>
      ) : (
        <div className="space-y-5">
          {GRUPOS_DIRETORIO.map((b) => {
            const lista = porBalde.get(b) ?? [];
            if (lista.length === 0) return null;
            return (
              <SecaoPessoas
                key={b}
                titulo={rotuloFaceta(b)}
                total={lista.length}
                chaveGrade={`${chaveFiltros}|${b}`}
                cards
              >
                {lista.map(cardDe)}
              </SecaoPessoas>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** O WhatsApp do card (REALIZA-525): a rede já autoriza o canal pela
 *  view — o ícone abre o wa.me com a mesma mensagem pronta da ficha
 *  (colega ganha a assinatura "da sua turma"). Sem número ou fora da
 *  rede não renderiza: nunca um link vazio nem um canal não-autorizado. */
function WaIconLink({
  p,
  nomeJovem,
}: {
  p: DiretorioPessoa;
  nomeJovem: string;
}) {
  const nome = p.nome_social || p.nome;
  const wa = waLink(
    p.whatsapp,
    msgApresentacaoJovem(nomeJovem, p.tipo === "jovem")
  );
  if (!p.rede || !wa) return null;
  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Conversar com ${nome} no WhatsApp (abre em nova aba)`}
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-sm" }),
        "shrink-0"
      )}
    >
      <WhatsappLogo size={16} aria-hidden />
    </a>
  );
}

/** Card do diretório pra jovem do programa e adulto fora do catálogo —
 *  avatar+nome+vínculo+cidade+chips; o bloco inteiro é UM link pra ficha
 *  (aria-label nomeado, prefetch off). O WhatsApp abre como ação-irmã do
 *  link quando a pessoa é da rede e a view já entrega o canal — fora
 *  dela, o contato segue fechado atrás do vínculo. */
function DiretorioCard({
  p,
  indice,
  marca,
  nomeJovem,
}: {
  p: DiretorioPessoa;
  indice: number;
  /** Query viva da busca — destaca os trechos casados no nome e nos chips. */
  marca?: string;
  nomeJovem: string;
}) {
  const nome = p.nome_social || p.nome;
  const lugar = [p.cidade, p.uf].filter(Boolean).join(" · ");
  const chips = p.areas ?? p.interesses ?? [];
  // o vínculo ("Seu mentor", "Colega da turma") fala mais que o cargo —
  // fora da rede cai no papel público da entrada
  const meta = p.vinculo ?? rotuloTipo(p.tipo, p.papel);
  const papelAvatar =
    p.tipo === "jovem"
      ? ("mentorado" as const)
      : p.papel === "mentor_dpp" || p.papel === "mentor_especialista"
        ? ("mentor" as const)
        : ("equipe" as const);

  return (
    <Card
      className="animate-enter h-full"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start gap-3">
          <Link
            href={`/jovem/pessoas/${p.id}`}
            prefetch={false}
            aria-label={`Abrir perfil de ${nome}`}
            className="group -mx-1 -mt-1 flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1 pt-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Avatar
              nome={nome}
              src={p.avatar_path ? avatarPublicUrl(p.avatar_path) : null}
              papel={papelAvatar}
              size={44}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium underline-offset-4 transition-colors group-hover:underline" title={nome}>
                {marca ? (
                  <HighlightText texto={nome} query={marca} />
                ) : (
                  nome
                )}
              </span>
              <span className="line-clamp-2 text-sm text-muted-foreground">
                {[meta, p.selo].filter(Boolean).join(" · ")}
              </span>
              {lugar && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={12} aria-hidden className="shrink-0" />
                  <span className="truncate">{lugar}</span>
                </span>
              )}
            </span>
          </Link>
          <WaIconLink p={p} nomeJovem={nomeJovem} />
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.slice(0, 4).map((c) => (
              <Badge key={c} variant="secondary" className="font-normal">
                {marca ? <HighlightText texto={c} query={marca} /> : c}
              </Badge>
            ))}
            {chips.length > 4 && (
              <Badge variant="secondary" className="font-normal">
                +{chips.length - 4}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
