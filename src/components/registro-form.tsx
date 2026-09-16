"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { salvarRegistro } from "@/lib/actions";
import type { CicloEvento } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Enc = { descricao: string; responsavel: "mentor" | "mentorado"; prazo: string };

export function RegistroForm({
  encontroId,
  duplaId,
  evento,
}: {
  encontroId: string;
  duplaId: string;
  evento: CicloEvento | null;
}) {
  const [encaminhamentos, setEncaminhamentos] = useState<Enc[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("encontro_id", encontroId);
    fd.set("dupla_id", duplaId);
    encaminhamentos
      .filter((t) => t.descricao.trim())
      .forEach((t) => fd.append("encaminhamento", `${t.descricao}|${t.responsavel}|${t.prazo}`));
    start(async () => {
      const res = await salvarRegistro(fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Registro salvo.");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5">
      <div>
        <p className="text-sm font-medium">Registro do encontro</p>
        {evento && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Sugestao do guia: {evento.titulo}
            {evento.instrumentos.length > 0 && ` · instrumentos: ${evento.instrumentos.join(", ")}`}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tema">Tema trabalhado</Label>
          <Input id="tema" name="tema" placeholder="Ex.: primeiras submetas do PDM" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ferramenta">Instrumento utilizado</Label>
          <Select name="ferramenta">
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {(evento?.instrumentos ?? []).map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
              {["PDM", "Roda da Vida", "Perguntas Eficazes", "Feedback Construtivo", "Escuta Ativa", "Modelo SMART", "Nenhum especifico"]
                .filter((i) => !(evento?.instrumentos ?? []).includes(i))
                .map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reflexoes">Principais reflexoes</Label>
        <Textarea
          id="reflexoes"
          name="reflexoes"
          rows={3}
          placeholder="O que o(a) jovem trouxe de mais significativo, nas palavras dele(a) quando possivel."
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Encaminhamentos combinados</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEncaminhamentos([...encaminhamentos, { descricao: "", responsavel: "mentorado", prazo: "" }])}
          >
            <Plus size={14} /> Adicionar
          </Button>
        </div>
        {encaminhamentos.map((t, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_130px_150px_36px]">
            <Input
              placeholder="O que fica combinado"
              value={t.descricao}
              onChange={(e) => setEncaminhamentos(encaminhamentos.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))}
            />
            <Select
              value={t.responsavel}
              onValueChange={(v) => setEncaminhamentos(encaminhamentos.map((x, j) => (j === i ? { ...x, responsavel: v as Enc["responsavel"] } : x)))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mentorado">Mentorado(a)</SelectItem>
                <SelectItem value="mentor">Mentor(a)</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={t.prazo}
              onChange={(e) => setEncaminhamentos(encaminhamentos.map((x, j) => (j === i ? { ...x, prazo: e.target.value } : x)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setEncaminhamentos(encaminhamentos.filter((_, j) => j !== i))}
            >
              <Trash size={15} />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observacoes do mentor</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          placeholder="Avancos, dificuldades e pontos de atencao a acompanhar."
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm cursor-pointer">
        <input type="checkbox" name="precisa_apoio" className="mt-0.5 accent-[var(--warn)]" />
        <span>
          <span className="font-medium">Preciso de apoio</span> — sinalizar a coordenacao ou o
          supervisor de relacionamento (situacao que extrapola o papel do mentor).
        </span>
      </label>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Salvando..." : "Salvar registro"}
      </Button>
    </form>
  );
}
