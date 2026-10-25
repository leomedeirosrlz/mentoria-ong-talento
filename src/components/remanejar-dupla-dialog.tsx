"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsLeftRight } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { remanejarDupla } from "@/lib/actions";
import {
  foraDoPrograma,
  MOTIVOS_REMANEJO,
  motivoRemanejo,
  resumoRemanejo,
  type LadoRemanejo,
} from "@/lib/ciclo";
import type { AppRole, Dupla, SituacaoMentorado } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opt = { id: string; nome: string; role?: string | null; papeis?: AppRole[] };

/** Papéis efetivos com fallback no primário — embed `profile_papeis` vazio
 *  ou ausente cai no `role` (a policy pode negar a linha alheia). O papel
 *  de mentor pode existir SÓ em papeis (primário sup/coord). */
const papeisDe = (m: Opt | null | undefined): AppRole[] =>
  m?.papeis?.length ? m.papeis : m?.role ? [m.role as AppRole] : [];

/** "Remanejar" — troca UM lado da dupla sem costurar encerra-e-cria na mão:
 *  o RPC rematch_dupla (0064) encerra a atual e abre a sucessora numa
 *  transação. Coord-only; a ficha antiga guarda o histórico, a nova herda
 *  turma/cronograma/supervisor/trilha (e o PDM, que é do mentorado, quando
 *  ele fica). O resumo "A + B → A + C" fica visível ANTES de confirmar —
 *  a troca não tem desfazer.
 *
 *  Dois modos: com `trigger` (default próprio incluso) ele se abre sozinho;
 *  controlado (`open`/`onOpenChange` + `trigger={null}`) o RemanejoSugerido
 *  abre já com lado e par pré-escolhidos — a sugestão vira um clique, não
 *  um form inteiro de novo. */
export function RemanejarDuplaDialog({
  dupla,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  preselecao,
}: {
  dupla: Dupla;
  /** null = modo controlado, sem trigger próprio (o card de sugestão é
   *  quem manda abrir). undefined = trigger default "Remanejar". */
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Lado + par que a sugestão já escolheu — lidos na abertura. */
  preselecao?: { lado: LadoRemanejo; novoId: string } | null;
}) {
  const [openInt, setOpenInt] = useState(false);
  const open = openProp ?? openInt;
  const setOpen = onOpenChangeProp ?? setOpenInt;
  // quem sai — mentor é o default porque desistência costuma ser dele;
  // a mentorada é quem o programa protege de ficar sem par
  // a preseleção semeia os iniciais — o diálogo controlado pode nascer já
  // aberto (montado com a sugestão pronta)
  const [lado, setLado] = useState<LadoRemanejo>(preselecao?.lado ?? "mentor");
  const [novoId, setNovoId] = useState<string | null>(preselecao?.novoId ?? null);
  const [motivoSel, setMotivoSel] = useState<string>("desistencia");
  // contador da devolutiva (0117) — a trilha de especialista só fecha com ela
  const [devolutivaLen, setDevolutivaLen] = useState(0);
  const [mentores, setMentores] = useState<Opt[]>([]);
  const [mentorados, setMentorados] = useState<Opt[]>([]);
  // vagas por mentor: quantas duplas ativas/pausadas já tem vs. capacidade
  const [emUso, setEmUso] = useState<Record<string, number>>({});
  const [capacidade, setCapacidade] = useState<Record<string, number>>({});
  // mentorado ocupado POR TRILHA — mesma régua dos outros dialogs (a de
  // especialista convive com a DPP do mesmo mentorado)
  const [ocupacao, setOcupacao] = useState<Map<string, Set<string>>>(new Map());
  const [pronto, setPronto] = useState(false);
  const [falha, setFalha] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  // erro da action fica inline (o padrão dos dialogs) — a correção costuma
  // ser outra escolha no próprio form, então a mensagem não pode sumir
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  // estado fresco por abertura — um remanejo abortado não pode vazar
  // seleção pra próxima vez; com preseleção a sugestão já chega com lado
  // e par escolhidos. Ajuste durante o render na borda de subida do `open`
  // (o padrão "adjust state when props change" — sem frame de seleção
  // velha): no modo controlado a sugestão abre de fora e o Base UI não
  // chama onOpenChange — a transição da prop é o evento confiável
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setLado(preselecao?.lado ?? "mentor");
      setNovoId(preselecao?.novoId ?? null);
      setMotivoSel("desistencia");
      setDevolutivaLen(0);
      setErro(null);
      setFalha(false);
    }
  }

  // 1ª carga com skeleton; refetch de reabertura usa o cache — falha ali vira
  // toast, não bloqueio (as opções já carregadas continuam valendo)
  const carregou = useRef(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    let cancelado = false;
    (async () => {
      try {
        const [perfis, ments, ds, mps] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, nome, role, profile_papeis(papel)")
            // 4 primários, como no nova/editar: quem tem papel de mentor
            // só em profile_papeis (primário sup/coord) não pode ficar de
            // fora do fetch — o pool filtra por papel efetivo abaixo
            .in("role", ["mentor_dpp", "mentor_especialista", "supervisor", "coordenacao"])
            .eq("ativo", true)
            .order("nome"),
          supabase
            .from("mentorados")
            .select("id, nome, situacao")
            .order("nome"),
          // sem filtro de status: a ocupação filtra em JS. A própria dupla
          // sai pelo .neq — quem tá nela não conta vaga contra si mesmo
          supabase
            .from("duplas")
            .select("mentor_id, mentorado_id, trilha, status")
            .neq("id", dupla.id),
          supabase
            .from("mentor_profiles")
            .select("profile_id, capacidade, capacidade_especialista"),
        ]);
        const erro = [perfis, ments, ds, mps].find((r) => r.error)?.error;
        if (erro) throw erro;
        if (cancelado) return;
        setMentores(
          ((perfis.data ?? []) as (Opt & {
            profile_papeis?: { papel: AppRole }[];
          })[])
            .map((p) => ({
              ...p,
              papeis: (p.profile_papeis ?? []).map((r) => r.papel),
            }))
            .filter((m) => m.id !== dupla.mentor.id)
        );
        // quem saiu do programa (0077) não recebe remanejo — o atual sai
        // do pool por outra regra (o .filter de id abaixo)
        setMentorados(
          ((ments.data ?? []) as (Opt & {
            situacao?: SituacaoMentorado | null;
          })[]).filter(
            (m) => m.id !== dupla.mentorado.id && !foraDoPrograma(m)
          )
        );
        const contagem: Record<string, number> = {};
        const ocup = new Map<string, Set<string>>();
        for (const d of (ds.data ?? []).filter(
          (x) => x.status === "ativa" || x.status === "pausada"
        )) {
          const trilhas = ocup.get(d.mentorado_id) ?? new Set<string>();
          trilhas.add(d.trilha ?? "dpp");
          ocup.set(d.mentorado_id, trilhas);
          // vaga do mentor conta só na própria trilha (0073) — a pool do
          // especialista não consome a DPP e vice-versa
          if ((d.trilha ?? "dpp") === (dupla.trilha ?? "dpp")) {
            contagem[d.mentor_id] = (contagem[d.mentor_id] ?? 0) + 1;
          }
        }
        setEmUso(contagem);
        setOcupacao(ocup);
        const porMentor: Record<string, number> = {};
        for (const mp of mps.data ?? []) {
          porMentor[mp.profile_id] =
            dupla.trilha === "especialista"
              ? (mp.capacidade_especialista ?? 1)
              : mp.capacidade;
        }
        setCapacidade(porMentor);
        carregou.current = true;
        setPronto(true);
      } catch {
        if (cancelado) return;
        if (carregou.current) {
          toast.error(
            "Não foi possível atualizar as opções. As carregadas antes continuam valendo."
          );
        } else {
          setFalha(true);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch por abertura/retry; dupla é prop estável por montagem
  }, [open, tentativa]);

  const ehEsp = dupla.trilha === "especialista";
  // o papel do novo mentor precisa casar com a trilha — o RPC revalida,
  // mas o select já nasce filtrado pra erro não ser nem opção. Papel
  // EFETIVO (WP6b): o híbrido entra no pool da trilha que ele tem.
  const papelOk = ehEsp ? "mentor_especialista" : "mentor_dpp";
  const mentorPool = mentores.filter((m) => papeisDe(m).includes(papelOk));
  const mentorLotado = (id: string) =>
    (emUso[id] ?? 0) >= (capacidade[id] ?? 1);
  const mentoradoOcupado = (id: string) =>
    ocupacao.get(id)?.has(dupla.trilha) ?? false;

  // selects longos: quem pode ser escolhido primeiro, disabled afunda,
  // nome (pt-BR) desempata — mesma régua do editar/nova
  const mentoresOrd = [...mentorPool].sort(
    (a, b) =>
      Number(mentorLotado(a.id)) - Number(mentorLotado(b.id)) ||
      (capacidade[b.id] ?? 1) - (emUso[b.id] ?? 0) -
        ((capacidade[a.id] ?? 1) - (emUso[a.id] ?? 0)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
  const mentoradosOrd = [...mentorados].sort(
    (a, b) =>
      Number(mentoradoOcupado(a.id)) - Number(mentoradoOcupado(b.id)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );

  const poolAtual = lado === "mentor" ? mentoresOrd : mentoradosOrd;
  const novoNome = poolAtual.find((o) => o.id === novoId)?.nome ?? null;
  const resumo = resumoRemanejo(
    { mentor: dupla.mentor.nome, mentorado: dupla.mentorado.nome },
    lado,
    novoNome
  );
  // o que a dupla nova herda — declarado no resumo pra não ser surpresa;
  // o histórico (encontros, registros) sempre fica na encerrada
  const herancas = [
    !ehEsp && "turma e cronograma",
    dupla.supervisor && "o auxiliar executivo",
    ehEsp && "o contexto",
    lado === "mentor" && "o link do PDM",
  ].filter(Boolean) as string[];

  function trocarLado(v: LadoRemanejo) {
    setLado(v);
    setNovoId(null);
    setErro(null);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const motivo = motivoRemanejo(
      motivoSel,
      String(fd.get("detalhe") ?? "")
    );
    if (!novoId) {
      setErro(
        lado === "mentor"
          ? "Escolha o novo mentor."
          : "Escolha o novo mentorado."
      );
      return;
    }
    if (!motivo) {
      setErro("Conte o motivo da troca. Ele vai pra ficha de quem sai.");
      return;
    }
    const devolutiva = String(fd.get("devolutiva_pdm") ?? "").trim();
    if (ehEsp && (devolutiva.length < 10 || devolutiva.length > 4000)) {
      setErro(
        "A devolutiva pro PDM precisa de 10 a 4.000 caracteres: é a entrega de quem sai da trilha."
      );
      return;
    }
    const registrarNota = fd.get("registrar_nota") === "on";
    setErro(null);
    start(async () => {
      try {
        const res = await remanejarDupla(
          dupla.id,
          lado,
          novoId,
          motivo,
          registrarNota,
          devolutiva
        );
        if (res?.error) {
          setErro(res.error);
          return;
        }
        toast.success(
          resumo
            ? `Nova dupla formada: ${resumo.depois.replace(" + ", " e ")}.`
            : "Dupla remanejada."
        );
        setOpen(false);
        if (res?.novaDuplaId) router.push(`/duplas/${res.novaDuplaId}`);
        else router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  const rotuloLado = (v: LadoRemanejo) =>
    v === "mentor"
      ? {
          titulo: "Trocar o mentor",
          detalhe: `${dupla.mentor.nome} sai da dupla.`,
        }
      : {
          titulo: "Trocar o mentorado",
          detalhe: `${dupla.mentorado.nome} sai da dupla.`,
        };

  return (
    <Dialog
      open={open}
      // o reset por abertura é o ajuste no render acima — aqui só flui o
      // pedido de mudança do Base UI (fechar por Esc/backdrop/trigger)
      onOpenChange={setOpen}
    >
      {trigger !== null && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button variant="outline" size="sm">
                <ArrowsLeftRight size={15} /> Remanejar
              </Button>
            )
          }
        />
      )}
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Remanejar a dupla</DialogTitle>
          <DialogDescription>
            Troca um lado sem perder o histórico: a dupla atual é encerrada e
            a sucessora já nasce com o par novo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {falha && !pronto ? (
            // fetch das opções falhou — erro honesto com retry em vez de
            // selects vazios fingindo "ninguém disponível"
            <div
              role="alert"
              className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3.5 py-3 text-sm"
            >
              <p className="font-medium">Não foi possível carregar as opções.</p>
              <p className="mt-0.5 text-muted-foreground">
                Confira a conexão e{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFalha(false);
                    setTentativa((t) => t + 1);
                  }}
                  className="rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  tente de novo
                </button>
                .
              </p>
            </div>
          ) : !pronto ? (
            <div className="space-y-4" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-9 animate-pulse rounded-lg bg-muted" />
                </div>
              ))}
              <div className="h-9 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Quem sai</legend>
                {(["mentor", "mentorado"] as const).map((v) => {
                  const r = rotuloLado(v);
                  return (
                    <label
                      key={v}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors has-checked:border-primary/60 has-checked:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name="lado"
                        value={v}
                        checked={lado === v}
                        onChange={() => trocarLado(v)}
                        className="mt-0.5 accent-primary"
                      />
                      <span>
                        <span className="font-medium">{r.titulo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.detalhe}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="space-y-2">
                <Label id="remanejo-novo-label" htmlFor="remanejo-novo">
                  {lado === "mentor" ? "Novo mentor" : "Novo mentorado"}
                </Label>
                <Select
                  // remonta na troca de lado — senão o valor interno ficaria
                  // o do lado anterior (lista e vocabulário mudam)
                  key={lado}
                  name="novo_id"
                  required
                  // controlado: a sugestão de remanejo entra com o par já
                  // escolhido — null segue mostrando o placeholder
                  value={novoId}
                  items={Object.fromEntries(
                    poolAtual.map((o) => [
                      o.id,
                      lado === "mentor"
                        ? `${o.nome} · ${emUso[o.id] ?? 0}/${capacidade[o.id] ?? 1}`
                        : o.nome,
                    ])
                  )}
                  onValueChange={(v) => {
                    setNovoId(v ? String(v) : null);
                    setErro(null);
                  }}
                >
                  <SelectTrigger
                    id="remanejo-novo"
                    aria-labelledby="remanejo-novo-label remanejo-novo"
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {poolAtual.length === 0 && (
                      <SelectItem value="__vazio" disabled>
                        {lado === "mentor"
                          ? "Nenhum mentor disponível"
                          : "Nenhum mentorado disponível"}
                      </SelectItem>
                    )}
                    {poolAtual.map((o) => {
                      const ocupado =
                        lado === "mentor"
                          ? mentorLotado(o.id)
                          : mentoradoOcupado(o.id);
                      return (
                        <SelectItem key={o.id} value={o.id} disabled={ocupado}>
                          {lado === "mentor"
                            ? `${o.nome} · ${emUso[o.id] ?? 0}/${capacidade[o.id] ?? 1}${ocupado ? " · lotado" : ""}`
                            : `${o.nome}${ocupado ? ` (em dupla ${ehEsp ? "especialista" : "DPP"})` : ""}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {poolAtual.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {lado === "mentor"
                      ? `Nenhum mentor ${ehEsp ? "especialista " : ""}com vaga no momento.`
                      : "Todo mentorado cadastrado já está em dupla nessa trilha."}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label id="remanejo-motivo-label" htmlFor="remanejo-motivo">Motivo</Label>
                  <Select
                    name="motivo_cat"
                    value={motivoSel}
                    items={Object.fromEntries(
                      MOTIVOS_REMANEJO.map((m) => [m.value, m.label])
                    )}
                    onValueChange={(v) => setMotivoSel(v ?? "desistencia")}
                  >
                    <SelectTrigger
                      id="remanejo-motivo"
                      aria-labelledby="remanejo-motivo-label remanejo-motivo"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_REMANEJO.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remanejo-detalhe">
                    {motivoSel === "outro" ? "Qual motivo?" : "Detalhe (opcional)"}
                  </Label>
                  <Textarea
                    id="remanejo-detalhe"
                    name="detalhe"
                    rows={2}
                    required={motivoSel === "outro"}
                    maxLength={400}
                    placeholder={
                      motivoSel === "outro"
                        ? "Conte em uma frase"
                        : "Contexto pra ficha de quem sai"
                    }
                  />
                </div>
              </div>

              {ehEsp && (
                // 0117: rematch fecha a trilha de especialista — a devolutiva
                // pro PDM é parte do rito, não opcional. Sem o campo aqui a
                // dupla encerrava sem a entrega e nenhuma via grava depois.
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="remanejo-devolutiva">
                      Devolutiva pro PDM
                    </Label>
                    <span
                      aria-hidden
                      className="text-xs tabular-nums text-muted-foreground"
                    >
                      {devolutivaLen}/4.000
                    </span>
                  </div>
                  <Textarea
                    id="remanejo-devolutiva"
                    name="devolutiva_pdm"
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={4}
                    onChange={(e) => setDevolutivaLen(e.target.value.length)}
                    placeholder="Metas alcançadas, o que segue em aberto e recomendações pro plano do jovem"
                  />
                  <p className="text-xs text-muted-foreground">
                    A entrega de quem sai da trilha. Em remanejo de jovem, o
                    especialista devolve a do jovem que sai. O mentor DPP lê na
                    ficha da dupla dele.
                  </p>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 text-sm transition-colors hover:bg-muted/70">
                <input
                  type="checkbox"
                  name="registrar_nota"
                  defaultChecked
                  className="mt-0.5 accent-primary"
                />
                <span>
                  Registrar saída na ficha de quem está saindo
                  <span className="block text-xs text-muted-foreground">
                    O motivo vira nota no mural da pessoa. Só a coordenação lê.
                  </span>
                </span>
              </label>

              {resumo && (
                // a troca é irreversível — o "antes → depois" fica visível
                // até o clique final, com o que a dupla nova herda
                <div className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/5 px-3.5 py-3 text-sm">
                  <p>
                    <strong>{resumo.antes}</strong> será encerrada e nasce{" "}
                    <strong>{resumo.depois}</strong>.
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A nova herda{" "}
                    {herancas.length ? herancas.join(", ") : "a trilha"} e
                    começa hoje; encontros e registros ficam na antiga.
                  </p>
                </div>
              )}

              {erro && (
                <p
                  role="alert"
                  className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3.5 py-3 text-sm"
                >
                  {erro}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={pending || !novoId}>
                {pending ? "Remanejando…" : "Remanejar a dupla"}
              </Button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
