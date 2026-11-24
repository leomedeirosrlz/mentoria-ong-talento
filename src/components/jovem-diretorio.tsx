"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { Avatar } from "@/components/avatar";
import { EspecialistaCatalogoCard } from "@/components/especialista-catalogo-card";
import { HighlightText } from "@/components/highlight-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterChipRow, filterChipCls } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { avatarPublicUrl } from "@/lib/avatar";
import { fuzzyMatch } from "@/lib/fuzzy";
import {
  baldeDaEntrada,
  FACETAS_DIRETORIO,
  rotuloTipo,
  type DiretorioPessoa,
  type FacetaDiretorio,
} from "@/lib/jovem-diretorio";
import type { JovemEspecialista } from "@/lib/types";
import { cn, normaliza } from "@/lib/utils";

// O diretório navegável do jovem (023): a página entrega a lista enriquecida
// (rede marcada) e TUDO filtra no client sobre o payload SSR — faceta de
// vínculo (?papel), chip de tema (?area) e busca fuzzy (?busca), estado na
// URL por replaceState pra deep-link, mesma gramática do /pessoas de staff.
// Card nunca carrega ação de contato: o canal direto mora na ficha e só pra
// quem já tem vínculo.

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
}: {
  pessoas: DiretorioPessoa[];
  /** Nome de tela do jovem — entra na assinatura (a página já o tem); hoje
   *  os cards não exibem voz (o canal WA mora na ficha e na rede do perfil). */
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
  const porFaceta =
    faceta === "todos"
      ? pessoas
      : faceta === "rede"
        ? pessoas.filter((p) => p.rede)
        : pessoas.filter((p) => baldeDaEntrada(p) === faceta);

  // chips de tema: união de areas (adulto/especialista) e interesses
  // (jovem) presentes NO RECORTE da faceta — frequência desc, alfabético.
  // Calculado antes do filtro de área pra linha não perder o chip ativo.
  const temas: { nome: string; n: number }[] = (() => {
    const contagem = new Map<string, number>();
    for (const p of porFaceta) {
      for (const a of p.areas ?? p.interesses ?? []) {
        contagem.set(a, (contagem.get(a) ?? 0) + 1);
      }
    }
    return [...contagem.entries()]
      .map(([nome, n]) => ({ nome, n }))
      .sort(
        (a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt-BR")
      );
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

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
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
              className="h-9 px-3 text-xs"
              onClick={limparFiltros}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* pills de vínculo — rolam na horizontal quando passam da
            largura (o fade do FilterChipRow marca o corte) */}
        <FilterChipRow
          role="group"
          aria-label="Filtrar por vínculo"
          className="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0"
        >
          {FACETAS_DIRETORIO.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={faceta === f.id}
              onClick={() => setFaceta(f.id)}
              className={filterChipCls(faceta === f.id)}
            >
              {f.rotulo}
            </button>
          ))}
        </FilterChipRow>

        {/* chips de tema — single-select: re-tocar o ativo limpa o
            recorte (o mesmo gesto das pills de turma) */}
        {temas.length > 0 && (
          <FilterChipRow
            role="group"
            aria-label="Filtrar por tema"
            className="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0"
          >
            {temas.map((t) => (
              <button
                key={t.nome}
                type="button"
                aria-pressed={areaSel === t.nome}
                onClick={() =>
                  setAreaSel(areaSel === t.nome ? null : t.nome)
                }
                className={filterChipCls(areaSel === t.nome)}
              >
                {t.nome}
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    areaSel === t.nome
                      ? "text-background/70"
                      : "text-muted-foreground"
                  )}
                >
                  {t.n}
                </span>
              </button>
            ))}
          </FilterChipRow>
        )}
      </div>

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
      ) : (
        <div key={chaveFiltros} className="grid gap-4 sm:grid-cols-2">
          {exibidas.map((p, i) =>
            p.tipo === "especialista" ? (
              <EspecialistaCatalogoCard
                key={p.id}
                e={especialistaDe(p)}
                href={`/jovem/pessoas/${p.id}`}
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
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Card do diretório pra jovem do programa e adulto fora do catálogo —
 *  avatar+nome+vínculo+cidade+chips; o bloco inteiro é UM link pra ficha
 *  (aria-label nomeado, prefetch off) e nenhuma ação de contato: o canal
 *  direto só existe pra quem já é da rede e mora na ficha. */
function DiretorioCard({
  p,
  indice,
  marca,
}: {
  p: DiretorioPessoa;
  indice: number;
  /** Query viva da busca — destaca os trechos casados no nome e nos chips. */
  marca?: string;
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
              <span
                className="block truncate font-medium underline-offset-4 transition-colors group-hover:underline"
                title={nome}
              >
                {marca ? (
                  <HighlightText texto={nome} query={marca} />
                ) : (
                  nome
                )}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
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
          {p.rede && (
            <Badge
              variant="outline"
              className="shrink-0 border-[var(--ok)]/50 font-normal text-[var(--ok-text)]"
            >
              Sua rede
            </Badge>
          )}
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
