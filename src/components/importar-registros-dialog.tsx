"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  CaretDown,
  FileArrowUp,
  UploadSimple,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  executarImportRegistros,
  previewImportRegistros,
  type EncontroInfo,
  type LinhaPrev,
} from "@/lib/actions-importar-registros";
import type { DuplaCandidata, LinhaReg } from "@/lib/importar-registros";
import { formatDate } from "@/lib/ciclo";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tag, type TomTag } from "@/components/agenda-partes";
import { cn } from "@/lib/utils";

type Resultado = {
  criados: number;
  atualizados: number;
  encontrosCriados: number;
  erros: string[];
};

const IGNORAR = "__ignorar__";

const DICAS =
  "O CSV que o Google Forms exporta das respostas da avaliação semanal. " +
  "Cada linha vira um encontro realizado (origem externa) + o registro do mentor: " +
  'o match sai de "Nome" × "Nome do Mentorando": nome exato ou pedaço do nome cadastrado ' +
  'resolve sozinho ("Fernando Toledo" acha "Fernando Toledo Martins"); grafia ambígua ou ' +
  "desconhecida cai na fila de revisão pra você apontar a dupla certa. O número vem de " +
  '"Qual encontro/semana está sendo avaliado?" e a data de "Data do encontro". Ano ' +
  "improvável é corrigido e sinalizado. Documentos/fotos ficam de fora (são links do " +
  "Drive) e pedido de apoio não se importa: ele é feito pelo mentor dentro da plataforma. " +
  "Reimportar o mesmo arquivo não duplica: o registro do encontro é atualizado.";

const curto = (v: string, max = 56) => {
  const s = v.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const duplaLabel = (d: DuplaCandidata) =>
  `${d.mentoradoNome} × ${d.mentorNome}` +
  (d.status !== "ativa" ? ` (${d.status})` : "") +
  (d.trilha === "especialista" ? " · especialista" : "") +
  (d.score != null ? ` · ${d.score}` : "");

const ENC_INFO: Record<EncontroInfo, { rotulo: string; tom: TomTag }> = {
  novo: { rotulo: "encontro novo", tom: "ok" },
  anexa: { rotulo: "anexa ao encontro", tom: "muted" },
  atualiza: { rotulo: "já tem registro", tom: "warn" },
};

const NIVEL_TAG: Record<string, { rotulo: string; tom: TomTag }> = {
  auto: { rotulo: "confiança", tom: "ok" },
  provavel: { rotulo: "confiança", tom: "info" },
  manual: { rotulo: "manual", tom: "warn" },
};

/** Tag de confiança do match — "87" verde quando auto, azul quando a
 *  sugestão é provável, "manual" âmbar quando não há palpite. */
function ConfTag({ l }: { l: LinhaPrev }) {
  if (l.status === "ignorar") return <Tag tom="muted">ignorada</Tag>;
  const n = NIVEL_TAG[l.nivel ?? "manual"];
  return (
    <Tag tom={n.tom}>
      {l.nivel === "manual" || l.score == null
        ? n.rotulo
        : `${n.rotulo} ${l.score}`}
    </Tag>
  );
}

export function ImportarRegistrosDialog() {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaPrev[] | null>(null);
  const [duplas, setDuplas] = useState<DuplaCandidata[]>([]);
  // dupla_id → (nº → estado do encontro) — recomputa o tag "já tem
  // registro" pra dupla que a pessoa escolher no Select, não a sugerida
  const [encPorDupla, setEncPorDupla] = useState<
    Record<string, Record<number, EncontroInfo>>
  >({});
  // n → duplaId escolhido | IGNORAR | "" (pendente) — a decisão humana das
  // linhas 'revisar'; as 'ok' não entram no mapa
  const [escolhas, setEscolhas] = useState<Map<number, string>>(new Map());
  const [ignoradas, setIgnoradas] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erroParse, setErroParse] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setTexto("");
    setArquivo(null);
    setLinhas(null);
    setDuplas([]);
    setEncPorDupla({});
    setEscolhas(new Map());
    setIgnoradas(0);
    setResultado(null);
    setErroParse(null);
    setBusca("");
  }

  function aoMudar(o: boolean) {
    setOpen(o);
    if (!o) reset();
  }

  function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setArquivo(file.name);
    file
      .arrayBuffer()
      .then((buf) => {
        // export do Forms costuma ser UTF-8; "CSV do Excel" pt-BR sai em
        // Windows-1252 — UTF-8 estrito primeiro, fallback pro 1252
        let t: string;
        try {
          t = new TextDecoder("utf-8", { fatal: true }).decode(buf);
        } catch {
          t = new TextDecoder("windows-1252").decode(buf);
        }
        setTexto(t);
        preVisualizar(t);
      })
      .catch(() => toast.error("Não foi possível ler o arquivo. Tente de novo."));
  }

  function preVisualizar(conteudo = texto) {
    if (!conteudo.trim()) return;
    setErroParse(null);
    start(async () => {
      const res = await previewImportRegistros(conteudo);
      if ("error" in res && res.error) {
        setErroParse(res.error);
        return;
      }
      if (!res.linhas?.length) {
        setErroParse(
          "Nenhuma resposta reconhecida. Confira se é o CSV do form semanal (precisa das colunas Nome, Nome do Mentorando e encontro/semana)."
        );
        return;
      }
      setLinhas(res.linhas);
      setDuplas(res.duplas ?? []);
      setEncPorDupla(res.encPorDupla ?? {});
      setIgnoradas(res.ignoradas ?? 0);
      // prováveis chegam com a sugestão preenchida — a pessoa confere e
      // aprova; manuais ficam "" até escolha explícita
      const pre = new Map<number, string>();
      for (const l of res.linhas) {
        if (l.status === "revisar") pre.set(l.n, l.duplaId ?? "");
      }
      setEscolhas(pre);
      const rev = res.stats?.revisar ?? 0;
      if (rev)
        toast.warning(
          `${rev} ${rev === 1 ? "linha pede" : "linhas pedem"} revisão. Escolha a dupla ou ignore.`
        );
    });
  }

  function importar() {
    if (!linhas) return;
    const aprovadas: LinhaReg[] = linhas.flatMap((l) => {
      if (l.status === "ok") return [l];
      const esc = escolhas.get(l.n);
      if (l.status === "revisar" && esc && esc !== IGNORAR) {
        return [{ ...l, duplaId: esc }];
      }
      return [];
    });
    if (!aprovadas.length) return;
    start(async () => {
      const res = await executarImportRegistros(aprovadas);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setResultado({
        criados: res.criados ?? 0,
        atualizados: res.atualizados ?? 0,
        encontrosCriados: res.encontrosCriados ?? 0,
        erros: res.erros ?? [],
      });
      const total = (res.criados ?? 0) + (res.atualizados ?? 0);
      toast.success(
        `${total} ${total === 1 ? "resposta importada" : "respostas importadas"}.` +
          (res.erros?.length ? ` ${res.erros.length} ${res.erros.length === 1 ? "linha pulada" : "linhas puladas"}.` : "")
      );
      router.refresh();
    });
  }

  // ---- grupos da prévia: ação primeiro, pronto recolhido por último ----
  const b = busca.trim().toLowerCase();
  const visiveis = (linhas ?? []).filter(
    (l) =>
      !b ||
      [l.mentorTxt, l.mentoradoTxt, l.mentorNome, l.mentoradoNome, String(l.n)]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(b))
  );
  const manuais = visiveis.filter(
    (l) => l.status === "revisar" && (l.nivel === "manual" || !l.duplaId)
  );
  const provaveis = visiveis.filter(
    (l) => l.status === "revisar" && l.nivel !== "manual" && !!l.duplaId
  );
  const ignorCsv = visiveis.filter((l) => l.status === "ignorar");
  const prontas = visiveis.filter((l) => l.status === "ok");

  const ok = linhas?.filter((l) => l.status === "ok").length ?? 0;
  const revisar = linhas?.filter((l) => l.status === "revisar") ?? [];
  const aprovadasRevisar = revisar.filter(
    (l) => escolhas.get(l.n) && escolhas.get(l.n) !== IGNORAR
  ).length;
  const ignoradasMarcadas = revisar.filter((l) => escolhas.get(l.n) === IGNORAR).length;
  const pendentes = revisar.length - aprovadasRevisar - ignoradasMarcadas;
  const importaveis = ok + aprovadasRevisar;
  const ignorar = linhas?.filter((l) => l.status === "ignorar").length ?? 0;

  /** Select de dupla da linha 'revisar': candidatos em ordem de nota (a
   *  nota aparece no label), separador, todas as duplas, "ignorar" no fim. */
  function selectDupla(l: LinhaPrev, largo = false) {
    const valor = escolhas.get(l.n) ?? "";
    // candidatos chegam ordenados por score e carregam a nota — duplas[]
    // cruas não têm score, por isso o grupo provável usa eles
    const prov = l.candidatos;
    const cand = new Set(prov.map((c) => c.id));
    const demais = duplas.filter((d) => !cand.has(d.id));
    const items: Record<string, string> = Object.fromEntries(
      [...prov, ...demais].map((d) => [d.id, duplaLabel(d)])
    );
    items[IGNORAR] = "Ignorar esta linha";
    return (
      <Select
        value={valor}
        items={items}
        onValueChange={(v) =>
          setEscolhas(new Map(escolhas).set(l.n, v ?? ""))
        }
      >
        <SelectTrigger
          size="sm"
          aria-label={`Dupla da linha ${l.n}`}
          className={cn("w-full", largo ? "min-w-72" : "min-w-44", !valor && "border-dashed")}
        >
          <SelectValue placeholder="escolher dupla…" />
        </SelectTrigger>
        <SelectContent>
          {prov.length > 0 && (
            <SelectGroup>
              <SelectLabel>Prováveis</SelectLabel>
              {prov.map((d) => (
                <SelectItem key={d.id} value={d.id}>{duplaLabel(d)}</SelectItem>
              ))}
            </SelectGroup>
          )}
          {prov.length > 0 && <SelectSeparator />}
          <SelectGroup>
            <SelectLabel>{prov.length ? "Todas as duplas" : "Duplas"}</SelectLabel>
            {demais.map((d) => (
              <SelectItem key={d.id} value={d.id}>{duplaLabel(d)}</SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value={IGNORAR}>Ignorar esta linha</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  /** Uma linha da prévia: #n + confiança + nomes resolvidos × CSV + porquê
   *  (motivo + trilha de evidências) + normalizações; à direita o destino
   *  (encontro + Select ou dupla fixada). */
  function linhaImport(l: LinhaPrev) {
    const resolvM = l.mentorNome ?? l.mentorTxt;
    const resolvD = l.mentoradoNome ?? l.mentoradoTxt;
    const mudou =
      (l.mentorNome && l.mentorNome !== l.mentorTxt) ||
      (l.mentoradoNome && l.mentoradoNome !== l.mentoradoTxt);
    // tag de encontro sempre pra dupla VIGENTE no Select — "já tem
    // registro" aparece inclusive na linha manual que a pessoa acabou
    // de apontar; sem escolha/nº, sem tag
    const encSel =
      l.status === "ok" ? l.duplaId : (escolhas.get(l.n) ?? null);
    const encInfo =
      encSel && encSel !== IGNORAR && l.numero != null
        ? (encPorDupla[encSel]?.[l.numero] ?? "novo")
        : null;
    // avisos (peso<0) primeiro — a dupla concorrente/duplicata é o que
    // precisa de olho; ordem original preservada dentro de cada grupo
    const evs = [...l.evidencias]
      .sort((a, b) => Number(a.peso < 0) - Number(b.peso < 0))
      .slice(0, 5);
    const diffs = l.diffs.slice(0, 3);
    return (
      <li
        className={cn(
          "flex flex-wrap gap-x-6 gap-y-2 px-4 py-3",
          l.status === "ignorar" && "opacity-60"
        )}
      >
        <div className="min-w-0 flex-1 basis-80">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-xs tabular-nums text-muted-foreground">#{l.n}</span>
            <span className="font-medium">
              {resolvD || "—"} <span className="text-muted-foreground">×</span> {resolvM || "—"}
            </span>
            <ConfTag l={l} />
            {encInfo && (
              <Tag tom={ENC_INFO[encInfo].tom}>
                {ENC_INFO[encInfo].rotulo}
              </Tag>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mudou ? `no CSV: ${l.mentorTxt} × ${l.mentoradoTxt} · ` : ""}
            {l.numero != null ? `${l.numero}º encontro` : "sem número"}
            {l.dataIso && ` · ${formatDate(l.dataIso)}`}
            {!l.dataIso && l.dataTxt && ` · data ilegível: “${curto(l.dataTxt, 20)}”`}
          </p>
          {l.motivo && (
            <p className="mt-1 text-xs text-[var(--warn-text)]">{l.motivo}</p>
          )}
          {evs.length > 0 && l.status !== "ignorar" && (
            <ul className="mt-1 space-y-0.5">
              {evs.map((e, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-xs",
                    e.peso < 0 ? "text-[var(--warn-text)]" : "text-muted-foreground"
                  )}
                >
                  · {e.texto}
                </li>
              ))}
            </ul>
          )}
          {diffs.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs">
              {diffs.map((d, j) => (
                <li key={j} title={`${d.label}: ${d.de}`} className="leading-snug">
                  <span className="break-all text-muted-foreground/70 line-through decoration-muted-foreground/40">
                    {curto(d.de, 44) || "(vazio)"}
                  </span>
                  {" → "}
                  {d.para ? (
                    <span className="break-all">{curto(d.para, 44)}</span>
                  ) : (
                    <em className="text-muted-foreground">descartado</em>
                  )}
                  {d.revisar && (
                    <span className="ml-1 inline-flex items-center gap-1 text-[var(--warn-text)]">
                      <Warning size={11} aria-hidden />
                      {`revisar${d.aviso ? ` · ${curto(d.aviso, 40)}` : ""}`}
                    </span>
                  )}
                </li>
              ))}
              {l.diffs.length > 3 && (
                <li className="text-muted-foreground">
                  + {l.diffs.length - 3} normalizações
                </li>
              )}
            </ul>
          )}
        </div>
        <div className="w-full shrink-0 sm:w-80">
          {l.status === "revisar" ? (
            selectDupla(l, true)
          ) : l.duplaId ? (
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground">{l.mentoradoNome} × {l.mentorNome}</span>
              {l.status === "ok" && " · entra direto"}
            </p>
          ) : l.status === "ignorar" ? (
            <p className="text-xs text-muted-foreground">{l.motivo ?? "fora do lote"}</p>
          ) : null}
        </div>
      </li>
    );
  }

  function grupoImport(
    titulo: string,
    grupo: LinhaPrev[],
    acao?: React.ReactNode
  ) {
    if (!grupo.length) return null;
    return (
      <div key={titulo}>
        <h3 className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          {titulo}
          {acao}
        </h3>
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
          {grupo.map(linhaImport)}
        </ul>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={aoMudar}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <FileArrowUp size={16} /> Importar respostas
          </Button>
        }
      />
      {/* 3xl, não 6xl: a linha da prévia é basis-80 + w-80 (~43,5rem) —
          em 2xl a coluna de escolha quebrava, em 6xl sobrava fundo ocioso */}
      <DialogContent size="3xl">
        <DialogHeader>
          <DialogTitle>Importar respostas do form semanal</DialogTitle>
          <DialogDescription>
            {linhas
              ? `${arquivo ?? "conteúdo colado"} · ${linhas.length} ${linhas.length === 1 ? "resposta" : "respostas"} lidas`
              : "Cada linha vira encontro realizado + registro do mentor."}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div ref={(el) => el?.focus()} tabIndex={-1} className="space-y-3 outline-none">
            <p className="text-sm">
              <span className="font-medium">{resultado.criados}</span>{" "}
              {resultado.criados === 1 ? "registro criado" : "registros criados"}
              {resultado.atualizados > 0 &&
                ` · ${resultado.atualizados} ${resultado.atualizados === 1 ? "atualizado" : "atualizados"}`}
              {resultado.encontrosCriados > 0 &&
                ` · ${resultado.encontrosCriados} ${resultado.encontrosCriados === 1 ? "encontro criado" : "encontros criados"}`}
              .
              {resultado.erros.length > 0 &&
                ` ${resultado.erros.length} ${resultado.erros.length === 1 ? "linha pulada" : "linhas puladas"}:`}
            </p>
            {resultado.erros.length > 0 && (
              <ul className="max-h-48 overflow-y-auto rounded-lg border divide-y text-sm">
                {resultado.erros.map((p, i) => (
                  <li key={i} className="px-3 py-1.5 text-muted-foreground">{p}</li>
                ))}
              </ul>
            )}
            {/* estado terminal: só o Fechar outline (mesmo do importar-csv) */}
            <DialogFooter>
              <Button variant="outline" onClick={() => aoMudar(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : linhas ? (
          <div ref={(el) => el?.focus()} tabIndex={-1} className="space-y-3 min-w-0 outline-none">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{importaveis}</span>{" "}
                {importaveis === 1 ? "resposta pronta" : "respostas prontas"}
                {pendentes > 0 &&
                  ` · ${pendentes} ${pendentes === 1 ? "pede" : "pedem"} sua escolha`}
                {ignoradasMarcadas + ignorar > 0 &&
                  ` · ${ignoradasMarcadas + ignorar} ${ignoradasMarcadas + ignorar === 1 ? "será pulada" : "serão puladas"}`}
                {ignoradas > 0 &&
                  ` · ${ignoradas} ${ignoradas === 1 ? "linha do CSV ignorada" : "linhas do CSV ignoradas"}`}
              </p>
              {linhas.length > 10 && (
                <Input
                  type="search"
                  aria-label="Buscar linha por nome ou número"
                  placeholder="Buscar por nome ou #linha"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="ml-auto w-56"
                />
              )}
            </div>

            <div className="scroll-fina max-h-[58vh] space-y-4 overflow-y-auto pr-1">
              {grupoImport(
                `Pedem sua escolha (${manuais.length})`,
                manuais,
                manuais.length > 1 ? (
                  <button
                    type="button"
                    className="-my-1 min-h-11 rounded-md px-2 text-xs font-normal text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      const m = new Map(escolhas);
                      for (const l of manuais) m.set(l.n, IGNORAR);
                      setEscolhas(m);
                    }}
                  >
                    {b ? "Ignorar estas" : "Ignorar todas"}
                  </button>
                ) : undefined
              )}
              {grupoImport(
                `Prováveis · confira a sugestão (${provaveis.length})`,
                provaveis
              )}
              {grupoImport(`Ignoradas no CSV (${ignorCsv.length})`, ignorCsv)}
              {prontas.length > 0 && (
                <Collapsible.Root
                  defaultOpen={!manuais.length && !provaveis.length && !ignorCsv.length}
                >
                  <Collapsible.Trigger className="group mb-1.5 flex min-h-11 w-full cursor-pointer items-center gap-1.5 text-left text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {`Prontas · entram direto (${prontas.length})`}
                    <CaretDown
                      size={13}
                      aria-hidden
                      className="transition-transform group-data-[panel-open]:rotate-180"
                    />
                  </Collapsible.Trigger>
                  <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
                      {prontas.map(linhaImport)}
                    </ul>
                  </Collapsible.Panel>
                </Collapsible.Root>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Encontro ou registro já existente é atualizado, nunca duplicado.
              Linha pendente não entra. Escolha a dupla ou marque &quot;ignorar&quot;.
            </p>
            {/* sticky: a lista de revisão é alta (max-h-58vh) — Voltar e
                Importar ficam visíveis sem rolar até o fim */}
            <DialogFooter sticky>
              <Button variant="outline" onClick={() => { setLinhas(null); setEscolhas(new Map()); setBusca(""); }}>
                Voltar
              </Button>
              <Button disabled={pending || importaveis === 0} onClick={importar}>
                <UploadSimple size={15} />
                {pending
                  ? "Importando…"
                  : `Importar ${importaveis} ${importaveis === 1 ? "resposta" : "respostas"}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {erroParse && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2.5 text-sm text-[var(--warn-text)]">
                <Warning size={16} aria-hidden className="mt-0.5 shrink-0" />
                {erroParse}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="reg_csv_file">Arquivo .csv das respostas</Label>
              <input
                id="reg_csv_file" type="file" accept=".csv,.txt,.tsv,text/csv"
                onChange={lerArquivo}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-2.5 file:text-sm file:text-foreground hover:file:bg-muted"
              />
              <details className="group">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8 [&::-webkit-details-marker]:hidden">
                  Como o CSV é lido
                  <CaretDown
                    size={13}
                    aria-hidden
                    className="transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="pb-1 text-xs leading-relaxed text-muted-foreground">{DICAS}</p>
              </details>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg_csv_text">Ou cole o conteúdo</Label>
              <Textarea
                id="reg_csv_text" rows={7}
                placeholder={'Carimbo de data/hora,Pontuação,Nome,Nome do Mentorando,"Qual encontro/semana está sendo avaliado?","Data do encontro",…\n08/10/2026 21:03,,Fernando Toledo,Nicolly Barbosa,"1º Encontro",16/09/2026,…'}
                value={texto}
                onChange={(e) => { setTexto(e.target.value); setErroParse(null); }}
                className="font-mono text-xs"
              />
            </div>
            <DialogFooter sticky>
              <Button
                variant="outline"
                onClick={() => aoMudar(false)}
              >
                Cancelar
              </Button>
              <Button disabled={!texto.trim() || pending} onClick={() => preVisualizar()}>
                {pending ? "Resolvendo duplas…" : "Pré-visualizar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
