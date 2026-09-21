"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileArrowDown, FileArrowUp, UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { importMentorados, importPessoas } from "@/lib/actions";
import {
  emailValido,
  normNome,
  normWhatsapp,
  parseCsv,
  type LinhaImportada,
} from "@/lib/importar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Tipo = "equipe" | "mentorados";
type Resultado = { criados: number; puladas: string[] };

// labels registradas no Select — sem elas o trigger fechado mostra o valor cru
const TIPO_LABEL: Record<Tipo, string> = {
  equipe: "Equipe (mentores, supervisores, coordenação)",
  mentorados: "Mentorados",
};

const DICAS: Record<Tipo, string> = {
  equipe: "Colunas esperadas: nome, e-mail, whatsapp e papel (mentor dpp / especialista / supervisor / coordenação; vazio vira mentor DPP).",
  mentorados: "Colunas esperadas: nome, whatsapp, e-mail, ong e notas. Só o nome é obrigatório.",
};

function linhaValida(tipo: Tipo, r: LinhaImportada): string | null {
  if (!r.nome.trim()) return "sem nome";
  if (tipo === "equipe" && !emailValido(r.email)) return "e-mail inválido";
  if (tipo === "mentorados" && r.email.trim() && !emailValido(r.email)) return "e-mail inválido";
  // whatsapp preenchido mas ilegível — a action pula a linha; o preview já avisa
  if (r.whatsapp.trim() && !normWhatsapp(r.whatsapp)) return "whatsapp inválido";
  return null;
}

export function ImportarCsvDialog({ tipoInicial = "equipe" }: { tipoInicial?: Tipo }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<LinhaImportada[] | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setTexto("");
    setLinhas(null);
    setResultado(null);
    setTipo(tipoInicial);
  }

  function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // limpa o input: escolher o mesmo arquivo de novo dispara onChange outra vez
    e.target.value = "";
    if (!file) return;
    file
      .arrayBuffer()
      .then((buf) => {
        // "CSV (delimitado por vírgulas)" do Excel pt-BR sai em Windows-1252 —
        // decodificar como UTF-8 vira mojibake silencioso. Tenta UTF-8
        // estrito; se houver byte inválido (U+FFFD no fatal), cai pro 1252.
        let t: string;
        try {
          t = new TextDecoder("utf-8", { fatal: true }).decode(buf);
        } catch {
          t = new TextDecoder("windows-1252").decode(buf);
        }
        setTexto(t);
        // arquivo escolhido já cai na prévia — sem passo morto entre "quero" e "feito"
        preVisualizar(t);
      })
      .catch(() => toast.error("Não foi possível ler o arquivo — tente de novo."));
  }

  // modelo com o cabeçalho que o parseCsv reconhece — gerado no client, sem arquivo estático
  function baixarModelo() {
    const header =
      tipo === "equipe"
        ? "nome;email;whatsapp;papel"
        : "nome;whatsapp;email;ong;notas";
    // BOM pro Excel abrir os acentos como UTF-8 (mesma convenção do /api/export)
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + header + "\r\n"], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo-importacao-${tipo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function preVisualizar(conteudo = texto) {
    const { linhas, ignoradas } = parseCsv(conteudo);
    setLinhas(linhas);
    if (!linhas.length) toast.error("Nenhuma linha válida. Confira o cabeçalho.");
    else if (ignoradas)
      toast.warning(
        `${ignoradas} ${ignoradas === 1 ? "linha ignorada" : "linhas ignoradas"}: sem nome reconhecível.`
      );
  }

  function importar() {
    if (!linhas) return;
    const invalidas = linhas.flatMap((r) => {
      const erro = linhaValida(tipo, r);
      return erro ? [`${normNome(r.nome) || r.email || "?"}: ${erro}`] : [];
    });
    const validas = linhas.filter((r) => !linhaValida(tipo, r));
    start(async () => {
      const res = tipo === "equipe" ? await importPessoas(validas) : await importMentorados(validas);
      if ("error" in res && res.error) toast.error(res.error);
      else {
        const r = res as Resultado & { ok: boolean };
        const puladas = [...invalidas, ...(r.puladas ?? [])];
        setResultado({ criados: r.criados, puladas });
        toast.success(
          `${r.criados} ${r.criados === 1 ? "cadastro importado" : "cadastros importados"}.` +
            (puladas.length
              ? ` ${puladas.length} ${puladas.length === 1 ? "linha pulada" : "linhas puladas"}.`
              : "")
        );
        router.refresh();
      }
    });
  }

  const comErro = linhas?.filter((r) => linhaValida(tipo, r)) ?? [];
  const validas = (linhas?.length ?? 0) - comErro.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <FileArrowUp size={16} /> Importar CSV
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar de planilha</DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{resultado.criados}</span>{" "}
              {resultado.criados === 1 ? "cadastro criado" : "cadastros criados"}.
              {resultado.puladas.length > 0 &&
                ` ${resultado.puladas.length} ${resultado.puladas.length === 1 ? "linha pulada" : "linhas puladas"}:`}
            </p>
            {resultado.puladas.length > 0 && (
              <ul className="max-h-48 overflow-y-auto rounded-lg border divide-y text-sm">
                {resultado.puladas.map((p, i) => (
                  <li key={i} className="px-3 py-1.5 text-muted-foreground">{p}</li>
                ))}
              </ul>
            )}
            <Button className="w-full" onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        ) : linhas ? (
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{validas}</span>{" "}
              {validas === 1 ? "linha pronta" : "linhas prontas"}
              {comErro.length > 0 &&
                ` · ${comErro.length} ${comErro.length === 1 ? "com problema (será pulada)" : "com problemas (serão puladas)"}`}
            </p>
            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full min-w-[540px] text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">{tipo === "equipe" ? "E-mail" : "WhatsApp"}</th>
                    <th className="px-3 py-2 font-medium">{tipo === "equipe" ? "Papel" : "ONG"}</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas.map((r, i) => {
                    const erro = linhaValida(tipo, r);
                    return (
                      <tr key={i} className={cn(erro && "text-muted-foreground/60")}>
                        <td className="px-3 py-1.5">{normNome(r.nome)}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {tipo === "equipe" ? r.email.toLowerCase().trim() : normWhatsapp(r.whatsapp) ?? "-"}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {tipo === "equipe" ? (r.papel || "mentor DPP") : (r.ong || "-")}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {erro
                            ? <span className="text-[var(--danger)]">{erro}</span>
                            : <span className="text-[var(--ok-text)]">ok</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinhas(null)}>Voltar</Button>
              <Button className="flex-1" disabled={pending || validas === 0} onClick={importar}>
                <UploadSimple size={15} />
                {pending ? "Importando..." : `Importar ${validas} ${validas === 1 ? "cadastro" : "cadastros"}`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label id="importar-tipo-label">Importar como</Label>
              <Select value={tipo} items={TIPO_LABEL} onValueChange={(v) => setTipo((v as Tipo) ?? "equipe")}>
                <SelectTrigger id="importar-tipo-select" aria-labelledby="importar-tipo-label importar-tipo-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TIPO_LABEL) as [Tipo, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{DICAS[tipo]}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="csv_file">Arquivo .csv</Label>
                <Button
                  type="button" size="xs" variant="ghost"
                  onClick={baixarModelo}
                  className="text-muted-foreground"
                >
                  <FileArrowDown size={14} /> Baixar modelo
                </Button>
              </div>
              <input
                id="csv_file" type="file" accept=".csv,.txt,.tsv,text/csv"
                onChange={lerArquivo}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-2.5 file:text-sm file:text-foreground hover:file:bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv_text">ou cole o conteúdo</Label>
              <Textarea
                id="csv_text" rows={7}
                placeholder={"nome;email;whatsapp;papel\nMaria Silva;maria@email.com;11999998888;mentor dpp"}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <Button className="w-full" disabled={!texto.trim()} onClick={() => preVisualizar()}>
              Pré-visualizar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
