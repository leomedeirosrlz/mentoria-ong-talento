"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, FileArrowUp, UploadSimple, Warning } from "@phosphor-icons/react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  'o match sai de "Nome" × "Nome do Mentorando" — nome exato ou pedaço do nome cadastrado ' +
  'resolve sozinho ("Fernando Toledo" acha "Fernando Toledo Martins"); grafia ambígua ou ' +
  "desconhecida cai na fila de revisão pra você apontar a dupla certa. O número vem de " +
  '"Qual encontro/semana está sendo avaliado?" e a data de "Data do encontro" — ano ' +
  "improvável é corrigido e sinalizado. Documentos/fotos ficam de fora (são links do " +
  "Drive) e pedido de apoio não se importa: ele é feito pelo mentor dentro da plataforma. " +
  "Reimportar o mesmo arquivo não duplica — o registro do encontro é atualizado.";

const curto = (v: string, max = 56) => {
  const s = v.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const duplaLabel = (d: DuplaCandidata) =>
  `${d.mentoradoNome} × ${d.mentorNome}` +
  (d.status !== "ativa" ? ` (${d.status})` : "") +
  (d.trilha === "especialista" ? " · especialista" : "");

const ENC_INFO: Record<EncontroInfo, string> = {
  novo: "encontro novo",
  anexa: "anexa ao encontro",
  atualiza: "já tem registro",
};

export function ImportarRegistrosDialog() {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<LinhaPrev[] | null>(null);
  const [duplas, setDuplas] = useState<DuplaCandidata[]>([]);
  // n → duplaId escolhido | IGNORAR | "" (pendente) — a decisão humana das
  // linhas 'revisar'; as 'ok' não entram no mapa
  const [escolhas, setEscolhas] = useState<Map<number, string>>(new Map());
  const [ignoradas, setIgnoradas] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setTexto("");
    setLinhas(null);
    setDuplas([]);
    setEscolhas(new Map());
    setIgnoradas(0);
    setResultado(null);
  }

  function aoMudar(o: boolean) {
    setOpen(o);
    if (!o) reset();
  }

  function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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
    start(async () => {
      const res = await previewImportRegistros(conteudo);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if (!res.linhas?.length) {
        toast.error(
          "Nenhuma resposta reconhecida. Confira se é o CSV do form semanal (precisa das colunas Nome, Nome do Mentorando e encontro/semana)."
        );
        return;
      }
      setLinhas(res.linhas);
      setDuplas(res.duplas ?? []);
      setIgnoradas(res.ignoradas ?? 0);
      // linhas revisar com dupla já resolvida (só flag de data/campo)
      // chegam com a sugestão preenchida — a pessoa confere e aprova
      const pre = new Map<number, string>();
      for (const l of res.linhas) {
        if (l.status === "revisar") pre.set(l.n, l.duplaId ?? "");
      }
      setEscolhas(pre);
      const rev = res.stats?.revisar ?? 0;
      if (rev)
        toast.warning(
          `${rev} ${rev === 1 ? "linha pede" : "linhas pedem"} revisão — escolha a dupla ou ignore.`
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

  const ok = linhas?.filter((l) => l.status === "ok").length ?? 0;
  const revisar = linhas?.filter((l) => l.status === "revisar") ?? [];
  const aprovadasRevisar = revisar.filter(
    (l) => escolhas.get(l.n) && escolhas.get(l.n) !== IGNORAR
  ).length;
  const ignoradasMarcadas = revisar.filter((l) => escolhas.get(l.n) === IGNORAR).length;
  const pendentes = revisar.length - aprovadasRevisar - ignoradasMarcadas;
  const importaveis = ok + aprovadasRevisar;
  const ignorar = linhas?.filter((l) => l.status === "ignorar").length ?? 0;

  /** Select de dupla da linha 'revisar': prováveis primeiro (as pistas do
   *  match), separador, todas as duplas, e "ignorar" no fim. */
  function selectDupla(l: LinhaPrev) {
    const valor = escolhas.get(l.n) ?? "";
    const items: Record<string, string> = Object.fromEntries(
      duplas.map((d) => [d.id, duplaLabel(d)])
    );
    items[IGNORAR] = "Ignorar esta linha";
    const cand = new Set(l.candidatos.map((c) => c.id));
    const provaveis = duplas.filter((d) => cand.has(d.id));
    const demais = duplas.filter((d) => !cand.has(d.id));
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
          className={cn("w-full min-w-44", !valor && "border-dashed")}
        >
          <SelectValue placeholder="escolher dupla…" />
        </SelectTrigger>
        <SelectContent>
          {provaveis.length > 0 && (
            <SelectGroup>
              <SelectLabel>Prováveis</SelectLabel>
              {provaveis.map((d) => (
                <SelectItem key={d.id} value={d.id}>{duplaLabel(d)}</SelectItem>
              ))}
            </SelectGroup>
          )}
          {provaveis.length > 0 && <SelectSeparator />}
          <SelectGroup>
            <SelectLabel>{provaveis.length ? "Todas as duplas" : "Duplas"}</SelectLabel>
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

  return (
    <Dialog open={open} onOpenChange={aoMudar}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <FileArrowUp size={16} /> Importar respostas
          </Button>
        }
      />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar respostas do form semanal</DialogTitle>
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
            <Button className="w-full" onClick={() => aoMudar(false)}>Fechar</Button>
          </div>
        ) : linhas ? (
          <div ref={(el) => el?.focus()} tabIndex={-1} className="space-y-3 min-w-0 outline-none">
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
            <div className="scroll-fina max-h-80 overflow-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Mentor × mentorado(a)</th>
                    <th className="px-3 py-2 font-medium">Encontro</th>
                    <th className="px-3 py-2 font-medium">Dupla</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Normalizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas.map((l) => {
                    return (
                      <tr key={l.n} className={cn(l.status === "ignorar" && "text-muted-foreground/60")}>
                        <td className="max-w-52 px-3 py-1.5">
                          {l.mentorNome ?? l.mentorTxt ?? "—"}
                          {l.mentorNome && l.mentorNome !== l.mentorTxt && (
                            <span className="block text-xs text-muted-foreground">
                              no CSV: {l.mentorTxt}
                            </span>
                          )}
                          <span className="block text-xs text-muted-foreground">
                            {l.mentoradoNome ?? l.mentoradoTxt ?? "—"}
                            {l.mentoradoNome && l.mentoradoNome !== l.mentoradoTxt &&
                              ` (no CSV: ${l.mentoradoTxt})`}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                          {l.numero != null ? `${l.numero}º` : "—"}
                          {l.dataIso && (
                            <span className="block text-muted-foreground">
                              {formatDate(l.dataIso)}
                            </span>
                          )}
                          {l.encontroInfo && (
                            <span
                              className={cn(
                                "block",
                                l.encontroInfo === "atualiza"
                                  ? "text-[var(--warn-text)]"
                                  : "text-muted-foreground"
                              )}
                            >
                              {ENC_INFO[l.encontroInfo]}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {l.status === "revisar" ? (
                            selectDupla(l)
                          ) : l.duplaId ? (
                            <span className="text-xs">
                              {l.mentoradoNome} × {l.mentorNome}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="max-w-56 px-3 py-1.5 text-xs">
                          {l.status === "ok" ? (
                            <span className="text-[var(--ok-text)]">Ok</span>
                          ) : l.status === "ignorar" ? (
                            <span className="text-muted-foreground">{l.motivo}</span>
                          ) : (
                            <span className="text-[var(--warn-text)]">{l.motivo}</span>
                          )}
                        </td>
                        <td className="max-w-52 px-3 py-1.5 text-xs">
                          {l.diffs.length ? (
                            <ul className="space-y-1">
                              {l.diffs.map((d, j) => (
                                <li key={j} title={`${d.label}: ${d.de}`} className="leading-snug">
                                  <span className="break-all text-muted-foreground/70 line-through decoration-muted-foreground/40">
                                    {curto(d.de) || "(vazio)"}
                                  </span>
                                  {" → "}
                                  {d.para ? (
                                    <span className="break-all">{curto(d.para)}</span>
                                  ) : (
                                    <em className="text-muted-foreground">descartado</em>
                                  )}
                                  {d.revisar && (
                                    <span
                                      className="mt-0.5 flex items-center gap-1 text-[var(--warn-text)]"
                                      title={d.aviso ?? "valor precisou de resgate"}
                                    >
                                      <Warning size={12} aria-hidden className="shrink-0" />
                                      {`revisar${d.aviso ? ` — ${curto(d.aviso, 44)}` : ""}`}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada resposta vira encontro realizado + registro atribuído ao mentor.
              Encontro ou registro já existente é atualizado, nunca duplicado.
              Linha pendente não entra — escolha a dupla ou marque &quot;ignorar&quot;.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setLinhas(null); setEscolhas(new Map()); }}>
                Voltar
              </Button>
              <Button className="flex-1" disabled={pending || importaveis === 0} onClick={importar}>
                <UploadSimple size={15} />
                {pending
                  ? "Importando…"
                  : `Importar ${importaveis} ${importaveis === 1 ? "resposta" : "respostas"}`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
                onChange={(e) => setTexto(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <Button className="w-full" disabled={!texto.trim() || pending} onClick={() => preVisualizar()}>
              {pending ? "Resolvendo duplas…" : "Pré-visualizar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
