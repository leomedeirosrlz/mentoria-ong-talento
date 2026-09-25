"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, FileArrowDown, FileArrowUp, UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { importMentorados, importPessoas } from "@/lib/actions";
import {
  emailValido,
  fichaLinha,
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
  equipe:
    "Colunas: nome, email, whatsapp, papel (mentor dpp / especialista / supervisor / coordenação, em branco vira mentor DPP; \"nenhum\" cadastra sem papel) e a ficha opcional: nome_social, data_nascimento (dd/mm/aaaa), genero, cor_raca, cidade, uf, cargo, empresa, bio, linkedin, interesses (separados por vírgula), motivacao, pref_genero_par, origem, experiencia_previa, formacao_externa e disponibilidade (JSON {dias,periodos}): estas três gravam na ficha de mentor. consent_lgpd_em carimba o consentimento (ISO). form_bruto (JSON) guarda a resposta original. Documentos pro termo: rg, cpf, cep, logradouro, numero, complemento, bairro. Os CSVs crus dos Google Forms de intake também entram. As colunas conhecidas são mapeadas e o resto é ignorado.",
  mentorados:
    "Colunas: nome, whatsapp, email, ong, notas e a ficha opcional: nome_social, data_nascimento (dd/mm/aaaa), genero, cor_raca, cidade, uf, escolaridade, interesses (por vírgula), objetivos, motivacao, pref_genero_par, origem, disponibilidade (JSON {dias,periodos}) e form_bruto (JSON). Só o nome é obrigatório. Documentos pro termo: rg, cpf, cep, logradouro, numero, complemento, bairro; e do responsável: resp_nome, resp_parentesco, resp_rg, resp_cpf, resp_nascimento, resp_cidade, resp_uf, resp_cep, resp_logradouro, resp_numero, resp_complemento, resp_bairro.",
};

const MODELO: Record<Tipo, string> = {
  equipe:
    "nome;email;whatsapp;papel;nome_social;data_nascimento;genero;cor_raca;cidade;uf;cargo;empresa;bio;linkedin;interesses;motivacao;pref_genero_par;origem;experiencia_previa;formacao_externa;disponibilidade;consent_lgpd_em;form_bruto;rg;cpf;cep;logradouro;numero;complemento;bairro",
  mentorados:
    "nome;whatsapp;email;ong;notas;nome_social;data_nascimento;genero;cor_raca;cidade;uf;escolaridade;interesses;objetivos;motivacao;pref_genero_par;origem;disponibilidade;form_bruto;rg;cpf;cep;logradouro;numero;complemento;bairro;resp_nome;resp_parentesco;resp_rg;resp_cpf;resp_nascimento;resp_cidade;resp_uf;resp_cep;resp_logradouro;resp_numero;resp_complemento;resp_bairro",
};

/** Campos da ficha (0034) + civis (0046) reconhecidos na linha — pro resumo
 *  da prévia. */
function extrasDaLinha(r: LinhaImportada): number {
  return [
    r.nome_social, r.data_nascimento, r.genero, r.cor_raca, r.cidade, r.uf,
    r.interesses, r.motivacao, r.pref_genero_par, r.cargo, r.empresa, r.origem,
    r.objetivos, r.escolaridade, r.experiencia_previa, r.formacao_externa,
    r.bio, r.linkedin, r.disponibilidade, r.form_bruto, r.consent_lgpd_em,
    r.rg, r.cpf, r.cep, r.logradouro, r.numero, r.complemento, r.bairro,
    r.resp_nome, r.resp_parentesco, r.resp_rg, r.resp_cpf, r.resp_nascimento,
    r.resp_cidade, r.resp_uf, r.resp_cep, r.resp_logradouro, r.resp_numero,
    r.resp_complemento, r.resp_bairro,
  ].filter((v) => v.trim()).length;
}

function linhaValida(tipo: Tipo, r: LinhaImportada): string | null {
  if (!r.nome.trim()) return "sem nome";
  if (tipo === "equipe" && !emailValido(r.email)) return "e-mail inválido";
  if (tipo === "mentorados" && r.email.trim() && !emailValido(r.email)) return "e-mail inválido";
  // whatsapp preenchido mas ilegível — a action pula a linha; o preview já avisa
  if (r.whatsapp.trim() && !normWhatsapp(r.whatsapp)) return "whatsapp inválido";
  // ficha é a mesma função do server (importar.ts) — caps de texto, enums,
  // datas, form_bruto e grade saem idênticos; preview nunca promete "Ok" pra
  // linha que o import pularia
  const ficha = fichaLinha(r, tipo === "equipe" ? "pessoa" : "mentorado");
  const erro = "error" in ficha ? ficha.error : null;
  return typeof erro === "string" ? erro : null;
}

export function ImportarCsvDialog({
  tipoInicial = "equipe",
  open,
  onOpenChange,
}: {
  tipoInicial?: Tipo;
  /** modo controlado — quem abre de um menu ("Mais ações") não tem trigger
   *  próprio; sem `open` o dialog segue autônomo com o botão de sempre */
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const aberto = open ?? openInterno;
  const aoMudar = (o: boolean) => {
    if (open === undefined) setOpenInterno(o);
    onOpenChange?.(o);
    if (!o) reset();
  };
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
      .catch(() => toast.error("Não foi possível ler o arquivo. Tente de novo."));
  }

  // modelo com o cabeçalho que o parseCsv reconhece — gerado no client, sem arquivo estático
  function baixarModelo() {
    // BOM pro Excel abrir os acentos como UTF-8 (mesma convenção do /api/export)
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + MODELO[tipo] + "\r\n"], { type: "text/csv;charset=utf-8" })
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
    <Dialog open={aberto} onOpenChange={aoMudar}>
      {open === undefined && (
        <DialogTrigger
          render={
            <Button size="sm" variant="outline">
              <FileArrowUp size={16} /> Importar CSV
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar de planilha</DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div ref={(el) => el?.focus()} tabIndex={-1} className="space-y-3 outline-none">
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
            <Button className="w-full" onClick={() => aoMudar(false)}>Fechar</Button>
          </div>
        ) : linhas ? (
          // ref callback leva o foco pra nova etapa — o botão que disparou
          // desmontou e o foco cairia no body do modal
          <div ref={(el) => el?.focus()} tabIndex={-1} className="space-y-3 min-w-0 outline-none">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{validas}</span>{" "}
              {validas === 1 ? "linha pronta" : "linhas prontas"}
              {comErro.length > 0 &&
                ` · ${comErro.length} ${comErro.length === 1 ? "com problema (será pulada)" : "com problemas (serão puladas)"}`}
            </p>
            {/* a tabela da prévia rola na horizontal (min-w-640px) — a barra
                fina deixa a pista de scroll visível em vez de cortar colunas */}
            <div className="scroll-fina max-h-72 overflow-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">{tipo === "equipe" ? "E-mail" : "WhatsApp"}</th>
                    <th className="px-3 py-2 font-medium">{tipo === "equipe" ? "Papel" : "ONG"}</th>
                    <th className="px-3 py-2 font-medium">Ficha</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas.map((r, i) => {
                    const erro = linhaValida(tipo, r);
                    const extras = extrasDaLinha(r);
                    return (
                      <tr key={i} className={cn(erro && "text-muted-foreground/60")}>
                        <td className="px-3 py-1.5">
                          {normNome(r.nome)}
                          {r.nome_social.trim() && (
                            <span className="block text-xs text-muted-foreground">
                              ({normNome(r.nome_social)})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {tipo === "equipe" ? r.email.toLowerCase().trim() : normWhatsapp(r.whatsapp) ?? "-"}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {tipo === "equipe" ? (r.papel || "mentor DPP") : (r.ong || "-")}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {extras ? `${extras} ${extras === 1 ? "campo" : "campos"}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {erro
                            ? <span className="text-[var(--danger)]">{erro}</span>
                            : <span className="text-[var(--ok-text)]">Ok</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              A coluna Ficha conta os campos de matching reconhecidos (nascimento, gênero,
              cidade/UF, interesses, motivação, pref. de par e afins). Nascimento, gênero,
              motivação e preferência de par ficam visíveis só pra coordenação.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinhas(null)}>Voltar</Button>
              <Button className="flex-1" disabled={pending || validas === 0} onClick={importar}>
                <UploadSimple size={15} />
                {pending ? "Importando…" : `Importar ${validas} ${validas === 1 ? "cadastro" : "cadastros"}`}
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
              <p className="text-xs text-muted-foreground">
                {tipo === "equipe"
                  ? "Obrigatórias: nome e e-mail. O resto da ficha é opcional."
                  : "Obrigatória: nome. O resto da ficha é opcional."}
              </p>
              {/* parede de colunas recolhida — quem precisa do detalhe abre;
                  <details> nativo mantém teclado/leitor de tela de graça */}
              <details className="group">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8 [&::-webkit-details-marker]:hidden">
                  Colunas aceitas no CSV
                  <CaretDown
                    size={13}
                    aria-hidden
                    className="transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="pb-1 text-xs leading-relaxed text-muted-foreground">
                  {DICAS[tipo]}
                </p>
              </details>
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
              <Label htmlFor="csv_text">Ou cole o conteúdo</Label>
              <Textarea
                id="csv_text" rows={7}
                placeholder={"nome;email;whatsapp;papel;cidade;uf;interesses\nMaria Silva;maria@email.com;11999998888;mentor dpp;São Paulo;SP;tecnologia, carreira"}
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
