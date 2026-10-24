"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Link as LinkIcon,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { criarLinkRelatorio } from "@/lib/actions-relatorio-links";
import {
  catalogoDe,
  COLUNAS_CONTATO,
  colunasDeLink,
  TIPO_RELATORIO_LABEL,
} from "@/lib/relatorio";
import type {
  ColunaRelatorio,
  RelatorioLinkConfig,
  RelatorioLinkTipo,
} from "@/lib/relatorio";
import { turmaLonga } from "@/lib/turma";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Cronograma } from "@/lib/types";

/** O que o builder passa quando abre o dialog — o recorte da grade como ela
 *  está na tela vira o config do link (a publicação congela o recorte). */
export type ConfigInicialLink = {
  tipo: "grade";
  turma: string | null;
  granularidade: "pessoas" | "duplas";
  colunas: string[];
  /** linhas do recorte na grade agora — alimenta o chip "N linhas" */
  linhas?: number;
};

const VALIDADES = [
  { valor: "0", label: "Sem prazo" },
  { valor: "30", label: "30 dias" },
  { valor: "90", label: "90 dias" },
  { valor: "120", label: "120 dias" },
] as const;

const STATUS_ASSINATURA_OPTS = [
  { valor: "todas", label: "Todos os status" },
  { valor: "pendente", label: "Pendente" },
  { valor: "assinado", label: "Assinado" },
  { valor: "revogado", label: "Revogado" },
  { valor: "expirado", label: "Expirado" },
] as const;

function Copiavel({ texto, label }: { texto: string; label: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">
        {texto}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1600);
          } catch {
            toast.error("Não consegui copiar — selecione e copie manualmente.");
          }
        }}
      >
        {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </Button>
    </div>
  );
}

/** Chip de resumo do recorte (rodapé do form) — pill neutro; `lime` pros
 *  números (linhas/colunas) e `warn` pro "com contato" (LGPD: dado de
 *  menor em link público pede destaque, não passa batido). */
function ChipRecorte({
  tom,
  children,
}: {
  tom?: "neutro" | "lime" | "warn";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tom === "lime" && "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
        tom === "warn" &&
          "border border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
        (!tom || tom === "neutro") && "bg-foreground text-background"
      )}
    >
      {children}
    </span>
  );
}

/** Aviso âmbar de exposição — o molde das notas delicadas (mesma casca do
 *  aviso de contato sensível em /pessoas). */
function AvisoExposicao({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <Warning size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Dialog de publicação de link público (REALIZA-170/201). Pode nascer
 *  controlado (menu "Compartilhar" → `open`/`onOpenChange`, sem trigger) ou
 *  com trigger próprio. O FORM mora no NovoLinkForm, filho do DialogContent
 *  — como o popup desmonta ao fechar, reabrir re-semeia o estado do
 *  `configInicial` ATUAL (sem isso o useState só semeava no mount da página
 *  e o dialog mostrava o recorte de quando o builder abriu). */
export function NovoLinkDialog({
  turmas,
  cronogramas,
  templates,
  configInicial,
  trigger,
  open,
  onOpenChange,
  finalFocus,
}: {
  turmas: string[];
  cronogramas: Pick<Cronograma, "id" | "nome" | "turma">[];
  templates: { slug: string; titulo: string }[];
  configInicial?: ConfigInicialLink;
  trigger?: React.ReactElement;
  /** controlado pelo chamador (menu Compartilhar) — sem trigger */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** aonde o foco volta ao fechar — o menu abre pelo item dentro do
   *  popover, que desmonta junto: sem isto o foco cai no body */
  finalFocus?: React.RefObject<HTMLElement | null>;
}) {
  const [interno, setInterno] = useState(false);
  const aberto = open ?? interno;
  const setAberto = onOpenChange ?? setInterno;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {(trigger !== undefined || open === undefined) && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button size="sm" variant="outline">
                <LinkIcon size={15} aria-hidden /> Novo link
              </Button>
            )
          }
        />
      )}
      <DialogContent size="xl" finalFocus={finalFocus}>
        <NovoLinkForm
          turmas={turmas}
          cronogramas={cronogramas}
          templates={templates}
          configInicial={configInicial}
          fechar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function NovoLinkForm({
  turmas,
  cronogramas,
  templates,
  configInicial,
  fechar,
}: {
  turmas: string[];
  cronogramas: Pick<Cronograma, "id" | "nome" | "turma">[];
  templates: { slug: string; titulo: string }[];
  configInicial?: ConfigInicialLink;
  fechar: () => void;
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    slug: string;
    senha: string | null;
  } | null>(null);

  const [tipo, setTipo] = useState<RelatorioLinkTipo>(
    configInicial?.tipo ?? "grade"
  );
  const [titulo, setTitulo] = useState("");
  const [tituloEditado, setTituloEditado] = useState(false);
  const [turma, setTurma] = useState<string>(configInicial?.turma ?? "");
  const [gran, setGran] = useState(configInicial?.granularidade ?? "pessoas");
  const [colSel, setColSel] = useState<Set<string>>(
    () => new Set(configInicial?.colunas ?? [])
  );
  const [exporContato, setExporContato] = useState(
    () => (configInicial?.colunas ?? []).some((c) => COLUNAS_CONTATO.has(c))
  );
  const [cronogramaId, setCronogramaId] = useState("");
  const [documento, setDocumento] = useState("");
  const [statusAssinatura, setStatusAssinatura] = useState("todas");
  const [senha, setSenha] = useState("");
  const [semSenha, setSemSenha] = useState(false);
  const [validade, setValidade] = useState("0");

  // grade sem configInicial (dialog sem recorte importado): default seguro
  // do tipo — sem contato
  const catalogoGrade: ColunaRelatorio[] = useMemo(
    () => catalogoDe(gran),
    [gran]
  );
  const colunasEfetivas = useMemo(() => {
    if (colSel.size) return new Set(colSel);
    return new Set(
      colunasDeLink({
        tipo: "grade",
        granularidade: gran,
        expor_contato: false,
      }).map((c) => c.id)
    );
  }, [colSel, gran]);

  // o que de fato vai no link: selecionadas ∩ catálogo da granularidade,
  // menos contato quando o toggle está desligado. O chip "N colunas" conta
  // ISTO — não a seleção crua (contato oculto não pode inflar o número).
  const colunasPublicadas = useMemo(
    () =>
      catalogoGrade
        .map((c) => c.id)
        .filter((id) => colunasEfetivas.has(id))
        .filter((id) => exporContato || !COLUNAS_CONTATO.has(id)),
    [catalogoGrade, colunasEfetivas, exporContato]
  );

  const tituloSugerido = useMemo(() => {
    const base = TIPO_RELATORIO_LABEL[tipo];
    const escopo =
      tipo === "assinaturas" ? "" : turma ? ` — ${turmaLonga(turma)}` : " — Todas as turmas";
    return base + escopo;
  }, [tipo, turma]);
  const tituloFinal = (tituloEditado ? titulo : tituloSugerido).trim();

  function alternarTipo(t: RelatorioLinkTipo) {
    setTipo(t);
    setErro(null);
  }

  function montarConfig(): RelatorioLinkConfig | null {
    if (tipo === "grade") {
      const colunas = colunasPublicadas;
      return {
        tipo: "grade",
        turma: turma || null,
        granularidade: gran,
        colunas,
        expor_contato: exporContato,
      };
    }
    if (tipo === "ciclo") {
      return {
        tipo: "ciclo",
        turma: turma || null,
        cronograma_id: cronogramaId || null,
      };
    }
    return {
      tipo: "assinaturas",
      documento: documento || null,
      status_assinatura:
        statusAssinatura === "todas"
          ? null
          : (statusAssinatura as RelatorioLinkConfig["status_assinatura"]),
    };
  }

  function publicar() {
    const config = montarConfig();
    if (!config) return;
    if (!tituloFinal) {
      setErro("Dê um título ao link.");
      return;
    }
    const senhaTrim = senha.trim();
    // teto em bytes — o bcrypt trunca em 72 bytes; um char multibyte
    // conta vários (a RPC mede octet_length também)
    if (
      !semSenha &&
      senhaTrim &&
      (senhaTrim.length < 6 || new TextEncoder().encode(senhaTrim).length > 72)
    ) {
      setErro("A senha precisa ter de 6 a 72 caracteres — ou deixe em branco pra gerar uma forte.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await criarLinkRelatorio({
        titulo: tituloFinal,
        config,
        validadeDias: validade === "0" ? null : Number(validade),
        senha: semSenha ? null : senhaTrim || null,
        semSenha,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setResultado({ slug: r.slug, senha: r.senha });
      router.refresh();
    });
  }

  const url = resultado ? `${window.location.origin}/resumo/${resultado.slug}` : "";

  if (resultado) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Link criado</DialogTitle>
          <DialogDescription>
            {resultado.senha
              ? "Copie link e senha agora — a senha não aparece de novo."
              : "Copie o link — ele abre direto, sem senha."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Link público</Label>
            <Copiavel texto={url} label="Copiar link" />
          </div>
          {resultado.senha ? (
            <>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Copiavel texto={resultado.senha} label="Copiar senha" />
              </div>
              <p className="flex items-start gap-2 rounded-lg bg-[var(--brand-lime)]/15 p-3 text-xs leading-relaxed text-foreground">
                <Warning size={15} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  A senha não fica salva em texto — só o hash. Se perder, gere
                  uma nova em “Compartilhar → Redefinir senha”.
                </span>
              </p>
            </>
          ) : (
            <AvisoExposicao>
              Este link ficou sem senha: quem tiver o endereço abre o
              relatório direto. Dá pra definir uma depois, em “Compartilhar”.
            </AvisoExposicao>
          )}
          <DialogFooter>
            <Button onClick={fechar}>Concluir</Button>
          </DialogFooter>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Novo link público</DialogTitle>
        <DialogDescription>
          O recorte fica salvo no link: quem abre vê exatamente isto, e só
          isto. Mudar a grade depois não altera o link.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* título em cima (decisão 201) — a sugestão vem do tipo + turma */}
        <div className="space-y-1.5">
          <Label htmlFor="nl-titulo">Título do link</Label>
          <Input
            id="nl-titulo"
            value={tituloEditado ? titulo : tituloSugerido}
            onChange={(e) => {
              setTitulo(e.target.value);
              setTituloEditado(true);
            }}
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label id="nl-tipo-label">Tipo de relatório</Label>
          <Select
            value={tipo}
            onValueChange={(v) => alternarTipo(v as RelatorioLinkTipo)}
            items={Object.fromEntries(
              (Object.keys(TIPO_RELATORIO_LABEL) as RelatorioLinkTipo[]).map(
                (t) => [t, TIPO_RELATORIO_LABEL[t]]
              )
            )}
          >
            <SelectTrigger aria-labelledby="nl-tipo-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_RELATORIO_LABEL) as RelatorioLinkTipo[]).map(
                (t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_RELATORIO_LABEL[t]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {tipo !== "assinaturas" && (
          <div className="space-y-1.5">
            <Label id="nl-turma-label">Turma</Label>
            <Select
              value={turma || "__todas"}
              onValueChange={(v) =>
                setTurma(v === "__todas" || v == null ? "" : v)
              }
              items={Object.fromEntries([
                ["__todas", "Todas as turmas"],
                // value cru (igualdade no filtro do link); label narrativo
                ...turmas.map((t) => [t, turmaLonga(t)] as const),
              ])}
            >
              <SelectTrigger aria-labelledby="nl-turma-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas">Todas as turmas</SelectItem>
                {turmas.map((t) => (
                  <SelectItem key={t} value={t}>
                    {turmaLonga(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {tipo === "grade" && (
          <>
            <div className="space-y-1.5">
              <Label id="nl-gran-label">Linhas</Label>
              <Select
                value={gran}
                onValueChange={(v) => {
                  const g = v as "pessoas" | "duplas";
                  setGran(g);
                  // a troca de granularidade re-seleciona o default do
                  // catálogo novo — senão sobrariam ids de outro grupo
                  setColSel(new Set());
                  setExporContato(false);
                }}
                items={{ pessoas: "Uma linha por pessoa", duplas: "Uma linha por dupla" }}
              >
                <SelectTrigger aria-labelledby="nl-gran-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoas">Uma linha por pessoa</SelectItem>
                  <SelectItem value="duplas">Uma linha por dupla</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Colunas do relatório</legend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {catalogoGrade
                  .filter((c) => exporContato || !COLUNAS_CONTATO.has(c.id))
                  .map((c) => {
                    // a última marcada não desmarca: colSel vazio cai no
                    // fallback do tipo (a tela "ressuscita" tudo) e publica
                    // colunas:[] — que o link lê como default também
                    const ultima =
                      colunasPublicadas.length <= 1 &&
                      colunasEfetivas.has(c.id);
                    return (
                      <label
                        key={c.id}
                        title={
                          ultima
                            ? "Pelo menos uma coluna sai no link"
                            : undefined
                        }
                        className="flex min-h-6 items-center gap-2 py-1 text-sm has-[:disabled]:opacity-60"
                      >
                        <input
                          type="checkbox"
                          checked={colunasEfetivas.has(c.id)}
                          disabled={ultima}
                          onChange={(e) => {
                            const n = new Set(colunasEfetivas);
                            if (e.target.checked) n.add(c.id);
                            else n.delete(c.id);
                            setColSel(n);
                          }}
                          className="size-4 rounded border-border accent-[var(--brand-ink)] disabled:cursor-not-allowed"
                        />
                        {c.label}
                      </label>
                    );
                  })}
              </div>
              <p className="text-xs text-muted-foreground">
                Pelo menos uma coluna sai no link.
              </p>
            </fieldset>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="text-sm">
                Compartilhar contato
                <span className="block text-xs text-muted-foreground">
                  E-mail e WhatsApp das pessoas no link — inclusive de
                  mentorados menores.
                </span>
              </span>
              <Switch
                checked={exporContato}
                onCheckedChange={(v) => {
                  const ligado = !!v;
                  setExporContato(ligado);
                  if (!ligado) {
                    // contato sai da seleção junto — se era a única marcada,
                    // sobraria colunasPublicadas=[] (publicado como "default")
                    setColSel((prev) => {
                      const n = new Set(
                        [...prev].filter((id) => !COLUNAS_CONTATO.has(id))
                      );
                      return n.size === prev.size ? prev : n;
                    });
                  }
                }}
                aria-label="Compartilhar contato"
              />
            </label>
            {exporContato && (
              <AvisoExposicao>
                Contato é dado pessoal — e de menor, no caso dos mentorados.
                Em link público, ligue só quando o destinatário realmente
                precisar falar com as pessoas.
              </AvisoExposicao>
            )}
          </>
        )}

        {tipo === "ciclo" && (
          <div className="space-y-1.5">
            <Label id="nl-crono-label">Cronograma</Label>
            <Select
              value={cronogramaId || "__todos"}
              onValueChange={(v) =>
                setCronogramaId(v === "__todos" || v == null ? "" : v)
              }
              items={Object.fromEntries([
                ["__todos", "Todos os cronogramas"],
                ...cronogramas.map(
                  (c) => [c.id, `${turmaLonga(c.turma)} · ${c.nome}`] as const
                ),
              ])}
            >
              <SelectTrigger aria-labelledby="nl-crono-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos os cronogramas</SelectItem>
                {cronogramas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {turmaLonga(c.turma)} · {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {tipo === "assinaturas" && (
          <>
            <div className="space-y-1.5">
              <Label id="nl-doc-label">Documento</Label>
              <Select
                value={documento || "__todos"}
                onValueChange={(v) =>
                  setDocumento(v === "__todos" || v == null ? "" : v)
                }
                items={Object.fromEntries([
                  ["__todos", "Todos os documentos"],
                  ...templates.map((t) => [t.slug, t.titulo] as const),
                ])}
              >
                <SelectTrigger aria-labelledby="nl-doc-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos">Todos os documentos</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>
                      {t.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label id="nl-status-label">Status</Label>
              <Select
                value={statusAssinatura}
                onValueChange={(v) => setStatusAssinatura(v ?? "todas")}
                items={Object.fromEntries(
                  STATUS_ASSINATURA_OPTS.map((o) => [o.valor, o.label])
                )}
              >
                <SelectTrigger aria-labelledby="nl-status-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ASSINATURA_OPTS.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* senha digitada (201) + validade lado a lado no desktop; em
            branco mantém a gerada "xxxx-xxxx" — a forte é a recomendada */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nl-senha">
              Senha de acesso{" "}
              <span className="font-normal text-muted-foreground">
                · opcional
              </span>
            </Label>
            <PasswordInput
              id="nl-senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={semSenha}
              autoComplete="off"
              maxLength={72}
              placeholder="Em branco: geramos uma forte"
            />
            <p className="text-xs text-muted-foreground">
              Em branco, geramos uma senha forte e mostramos uma vez na
              confirmação.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label id="nl-val-label">Validade do link</Label>
            <Select
              value={validade}
              onValueChange={(v) => setValidade(v ?? "0")}
              items={Object.fromEntries(VALIDADES.map((o) => [o.valor, o.label]))}
            >
              <SelectTrigger aria-labelledby="nl-val-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALIDADES.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Revogável a qualquer momento, em “Compartilhar”.
            </p>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <span className="text-sm">
            Link sem senha
            <span className="block text-xs text-muted-foreground">
              Quem tiver o endereço abre direto — sem digitar nada.
            </span>
          </span>
          <Switch
            checked={semSenha}
            onCheckedChange={(v) => {
              setSemSenha(!!v);
              setErro(null);
            }}
            aria-label="Link sem senha"
          />
        </label>
        {semSenha && (
          <AvisoExposicao>
            Todo o recorte fica visível pra qualquer pessoa com o link —
            escolha só quando não houver dado sensível no relatório.
          </AvisoExposicao>
        )}

        {/* resumo do recorte no RODAPÉ do form (decisão 201): o que vai no
            link, num relance — substitui a prévia/miniatura */}
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Recorte do link
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipRecorte>{TIPO_RELATORIO_LABEL[tipo]}</ChipRecorte>
            {tipo !== "assinaturas" && (
              <ChipRecorte>
                {turma ? turmaLonga(turma) : "Todas as turmas"}
              </ChipRecorte>
            )}
            {tipo === "grade" && (
              <>
                <ChipRecorte tom="lime">
                  {colunasPublicadas.length}{" "}
                  {colunasPublicadas.length === 1 ? "coluna" : "colunas"}
                </ChipRecorte>
                {/* "N linhas" conta a grade NA TELA — só vale enquanto o
                    recorte aqui ainda é o importado (turma + granularidade);
                    divergiu, o número seria mentira */}
                {configInicial?.linhas != null &&
                  turma === (configInicial.turma ?? "") &&
                  gran === configInicial.granularidade && (
                    <ChipRecorte tom="lime">
                      {configInicial.linhas}{" "}
                      {configInicial.linhas === 1 ? "linha" : "linhas"}
                    </ChipRecorte>
                  )}
                {exporContato ? (
                  <ChipRecorte tom="warn">com contato</ChipRecorte>
                ) : (
                  <ChipRecorte>sem contato</ChipRecorte>
                )}
              </>
            )}
            {semSenha && <ChipRecorte tom="warn">sem senha</ChipRecorte>}
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button onClick={publicar} disabled={pendente}>
            {pendente ? "Criando…" : "Criar link"}
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}
