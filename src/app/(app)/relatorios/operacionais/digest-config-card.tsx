"use client";

import { useState, useTransition } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { salvarDigestConfig } from "@/lib/actions-email";
import type {
  CadenciaDigest,
  DigestConfig,
  DigestSecoes,
} from "@/lib/relatorios/digest";

/** Card de configuração do digest (REALIZA-451 / spec 007 US14) — dia,
 *  cadência, destinatários e seções. A action valida de novo no servidor;
 *  aqui a validação é só ergonomia (desabilitar o que não faz sentido).
 *  Na demo renderiza read-only com a config padrão. */

const DIAS: { v: number; l: string }[] = [
  { v: 1, l: "Segunda" },
  { v: 2, l: "Terça" },
  { v: 3, l: "Quarta" },
  { v: 4, l: "Quinta" },
  { v: 5, l: "Sexta" },
  { v: 6, l: "Sábado" },
  { v: 0, l: "Domingo" },
];

const CADENCIAS: { v: CadenciaDigest; l: string }[] = [
  { v: "semanal", l: "Toda semana" },
  { v: "quinzenal", l: "A cada duas semanas" },
  { v: "desligado", l: "Desligado" },
];

const PAPEIS: { v: string; l: string }[] = [
  { v: "coordenacao", l: "Coordenação" },
  { v: "supervisor", l: "Supervisão" },
];

const SECOES: { k: keyof DigestSecoes; l: string }[] = [
  { k: "encontros", l: "Encontros da semana" },
  { k: "riscos", l: "Duplas em risco" },
  { k: "pendencias", l: "Pendências" },
];

export function DigestConfigCard({
  inicial,
  pessoas,
  somenteLeitura = false,
}: {
  inicial: DigestConfig;
  /** Equipe ativa (papel coordenação/supervisão) escolhível por pessoa. */
  pessoas: { id: string; nome: string }[];
  somenteLeitura?: boolean;
}) {
  const [cadencia, setCadencia] = useState<CadenciaDigest>(inicial.cadencia);
  const [dia, setDia] = useState(inicial.diaSemana);
  const [papeis, setPapeis] = useState<string[]>(inicial.destinatarios.papeis);
  const [profiles, setProfiles] = useState<string[]>(
    inicial.destinatarios.profiles
  );
  const [emailsTxt, setEmailsTxt] = useState(
    inicial.destinatarios.emails.join("\n")
  );
  const [secoes, setSecoes] = useState<DigestSecoes>(inicial.secoes);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const travado = pending || somenteLeitura;
  const semDestinatario =
    !papeis.length &&
    !profiles.length &&
    !emailsTxt
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean).length;

  function alterna(lista: string[], v: string, marcado: boolean) {
    return marcado ? [...lista, v] : lista.filter((x) => x !== v);
  }

  function salvar() {
    setMsg(null);
    setErro(null);
    startTransition(async () => {
      const r = await salvarDigestConfig({
        diaSemana: dia,
        cadencia,
        papeis,
        profiles,
        emails: emailsTxt
          .split(/[\n,;]+/)
          .map((e) => e.trim())
          .filter(Boolean),
        secoes,
      });
      if (r.error) setErro(r.error);
      else setMsg("Configuração salva. Vale a partir do próximo envio.");
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
      <h3 className="text-sm font-semibold">Configuração do envio</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="digest-cadencia">Frequência</Label>
          <Select
            value={cadencia}
            onValueChange={(v) => setCadencia(v as CadenciaDigest)}
            disabled={travado}
          >
            <SelectTrigger id="digest-cadencia" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CADENCIAS.map((c) => (
                <SelectItem key={c.v} value={c.v}>
                  {c.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="digest-dia">Dia do envio</Label>
          <Select
            value={String(dia)}
            onValueChange={(v) => setDia(Number(v))}
            disabled={travado || cadencia === "desligado"}
          >
            <SelectTrigger id="digest-dia" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIAS.map((d) => (
                <SelectItem key={d.v} value={String(d.v)}>
                  {d.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Quem recebe</legend>
        <div className="space-y-1.5">
          {PAPEIS.map((p) => (
            <label
              key={p.v}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={papeis.includes(p.v)}
                disabled={travado}
                onChange={(e) =>
                  setPapeis(alterna(papeis, p.v, e.target.checked))
                }
              />
              Todo(a) {p.l.toLowerCase()}
            </label>
          ))}
          {pessoas.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={profiles.includes(p.id)}
                disabled={travado}
                onChange={(e) =>
                  setProfiles(alterna(profiles, p.id, e.target.checked))
                }
              />
              {p.nome}
            </label>
          ))}
        </div>
        <div className="space-y-1.5 pt-1">
          <Label htmlFor="digest-emails">E-mails extras</Label>
          <Textarea
            id="digest-emails"
            rows={2}
            value={emailsTxt}
            disabled={travado}
            onChange={(e) => setEmailsTxt(e.target.value)}
            placeholder={"um por linha, ex.: marina@instituto.org"}
          />
          <p className="text-xs text-muted-foreground">
            Papéis e pessoas usam o e-mail cadastrado no perfil. Marque ao
            menos um destinatário; para pausar o envio use a frequência
            Desligado.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">No e-mail</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {SECOES.map((s) => (
            <label
              key={s.k}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={secoes[s.k]}
                disabled={travado}
                onChange={(e) =>
                  setSecoes({ ...secoes, [s.k]: e.target.checked })
                }
              />
              {s.l}
            </label>
          ))}
        </div>
      </fieldset>

      {somenteLeitura ? (
        <p className="text-xs text-muted-foreground">
          No modo demonstração a configuração aparece mas não é gravada.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={salvar}
            disabled={travado || semDestinatario}
          >
            <FloppyDisk aria-hidden />
            {pending ? "Salvando…" : "Salvar configuração"}
          </Button>
          {msg && (
            <p className="text-xs text-muted-foreground">{msg}</p>
          )}
          {erro && (
            <p className="text-xs text-[var(--danger-text)]">{erro}</p>
          )}
        </div>
      )}
    </div>
  );
}
