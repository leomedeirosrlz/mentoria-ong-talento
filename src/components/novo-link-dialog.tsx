"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link as LinkIcon, Warning } from "@phosphor-icons/react";
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

/** Dialog de publicação de link público (REALIZA-170). Dois pontos de
 *  entrada: o botão "Publicar link" do builder (configInicial = o recorte
 *  da grade na tela) e o "Novo link" do card de gestão (ciclo/assinaturas
 *  ou grade padrão). A senha volta UMA vez na resposta da RPC — o painel
 *  de sucesso é o único lugar onde ela existe. */
export function NovoLinkDialog({
  turmas,
  cronogramas,
  templates,
  configInicial,
  trigger,
}: {
  turmas: string[];
  cronogramas: Pick<Cronograma, "id" | "nome" | "turma">[];
  templates: { slug: string; titulo: string }[];
  configInicial?: ConfigInicialLink;
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    slug: string;
    senha: string;
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
  const [validade, setValidade] = useState("0");

  // grade sem configInicial (dialog do card): default seguro do tipo
  const catalogoGrade: ColunaRelatorio[] = useMemo(
    () => catalogoDe(gran),
    [gran]
  );
  const colunasEfetivas = useMemo(() => {
    if (colSel.size) return new Set(colSel);
    // card sem builder: o default do tipo já é o seguro (sem contato)
    return new Set(
      colunasDeLink({
        tipo: "grade",
        granularidade: gran,
        expor_contato: false,
      }).map((c) => c.id)
    );
  }, [colSel, gran]);

  const tituloSugerido = useMemo(() => {
    const base = TIPO_RELATORIO_LABEL[tipo];
    const escopo =
      tipo === "assinaturas" ? "" : turma ? ` — ${turma}` : " — Todas as turmas";
    return base + escopo;
  }, [tipo, turma]);
  const tituloFinal = (tituloEditado ? titulo : tituloSugerido).trim();

  function alternarTipo(t: RelatorioLinkTipo) {
    setTipo(t);
    setErro(null);
  }

  function montarConfig(): RelatorioLinkConfig | null {
    if (tipo === "grade") {
      const colunas = catalogoGrade
        .map((c) => c.id)
        .filter((id) => colunasEfetivas.has(id))
        .filter((id) => exporContato || !COLUNAS_CONTATO.has(id));
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
    setErro(null);
    startTransition(async () => {
      const r = await criarLinkRelatorio({
        titulo: tituloFinal,
        config,
        validadeDias: validade === "0" ? null : Number(validade),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setResultado({ slug: r.slug, senha: r.senha });
      router.refresh();
    });
  }

  function fechar(v: boolean) {
    setAberto(v);
    if (!v) {
      // fecha limpando o segredo do estado — a senha só existiu na tela
      setResultado(null);
      setErro(null);
    }
  }

  const url = resultado ? `${window.location.origin}/resumo/${resultado.slug}` : "";

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" variant="outline">
              <LinkIcon size={15} aria-hidden /> Novo link
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {resultado ? "Link criado" : "Publicar relatório"}
          </DialogTitle>
          <DialogDescription>
            {resultado
              ? "Copie link e senha agora — a senha não aparece de novo."
              : "O recorte fica salvo no link: quem abre vê exatamente isto, e só isto."}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Link público</Label>
              <Copiavel texto={url} label="Copiar link" />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Copiavel texto={resultado.senha} label="Copiar senha" />
            </div>
            <p className="flex items-start gap-2 rounded-lg bg-[var(--brand-lime)]/15 p-3 text-xs leading-relaxed text-foreground">
              <Warning size={15} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                A senha não fica salva em texto — só o hash. Se perder, gere
                uma nova em “Redefinir senha” no painel de links.
              </span>
            </p>
            <DialogFooter>
              <Button onClick={() => fechar(false)}>Concluir</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
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

            <div className="space-y-1.5">
              <Label htmlFor="nl-titulo">Título</Label>
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
                    ...turmas.map((t) => [t, t] as const),
                  ])}
                >
                  <SelectTrigger aria-labelledby="nl-turma-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__todas">Todas as turmas</SelectItem>
                    {turmas.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
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
                      .map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={colunasEfetivas.has(c.id)}
                            onChange={(e) => {
                              const n = new Set(colunasEfetivas);
                              if (e.target.checked) n.add(c.id);
                              else n.delete(c.id);
                              setColSel(n);
                            }}
                            className="size-4 rounded border-border accent-[var(--brand-ink)]"
                          />
                          {c.label}
                        </label>
                      ))}
                  </div>
                </fieldset>

                <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <span className="text-sm">
                    Compartilhar contato
                    <span className="block text-xs text-muted-foreground">
                      E-mail e WhatsApp das pessoas — dados pessoais, só marque
                      se o destinatário precisar.
                    </span>
                  </span>
                  <Switch
                    checked={exporContato}
                    onCheckedChange={(v) => setExporContato(!!v)}
                    aria-label="Compartilhar contato"
                  />
                </label>
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
                      (c) => [c.id, `${c.nome} · ${c.turma}`] as const
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
                        {c.nome} · {c.turma}
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
                Sempre protegido por senha gerada na hora. Revogável a
                qualquer momento no painel.
              </p>
            </div>

            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}

            <DialogFooter>
              <Button onClick={publicar} disabled={pendente}>
                {pendente ? "Publicando…" : "Publicar link"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
