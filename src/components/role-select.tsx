"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { setPessoaRole } from "@/lib/actions";
import { EscopoAuxiliarDialog } from "@/components/escopo-auxiliar-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ROLE_LABEL: Record<string, string> = {
  sem_papel: "Sem papel",
  mentor_dpp: "Mentor DPP",
  mentor_especialista: "Mentor especialista",
  // composto (REALIZA-262): existe desde antes nos dados (profile_papeis) —
  // o select materializa o híbrido que a área de pessoas não sabia nomear
  mentor_hibrido: "Mentor DPP + especialista",
  supervisor: "Auxiliar executivo",
  coordenacao: "Coordenação",
  // só pro trigger fechado quando a row já é mentorado (login do jovem,
  // 0066) — não é SelectItem: o papel vem do vínculo mentorados.profile_id,
  // setPessoaRole recusa atribuí-lo por aqui
  mentorado: "Mentorado",
};

export function RoleSelect({ profileId, role, papeis, nome }: { profileId: string; role: string | null; papeis?: string[] | null; nome?: string }) {
  // o valor mostrado é composto: primário + secundários de mentor juntos —
  // sem isso o híbrido aparecia só como "Mentor DPP" e o dropdown não
  // admitia o estado que o banco já guardava
  const hibrido =
    !!papeis?.includes("mentor_dpp") && !!papeis?.includes("mentor_especialista");
  const valor = hibrido ? "mentor_hibrido" : (role ?? "sem_papel");
  const [pending, start] = useTransition();
  // coordenação abre tudo — escolher esse papel no select pede confirmação
  // em vez de aplicar direto; o value controlado segue mostrando o papel
  // atual até a pessoa confirmar
  const [confirmaCoord, setConfirmaCoord] = useState(false);
  // auxiliar executivo pede o escopo (REALIZA-32): "só as duplas dele" ou
  // "toda a turma" — o dialog aplica papel + escopo juntos
  const [escopoAux, setEscopoAux] = useState(false);
  const router = useRouter();

  function aplicar(v: string | null) {
    start(async () => {
      try {
        const res = await setPessoaRole(profileId, !v || v === "sem_papel" ? null : v);
        if (res?.error) toast.error(res.error);
        else {
          // papel aplica na hora — o toast declara o efeito junto com o novo papel
          const quem = nome ? `${nome} agora é` : "Papel atualizado para";
          toast.success(`${quem} ${ROLE_LABEL[v ?? "sem_papel"] ?? v}. O acesso muda na hora.`);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <>
      <Select
        value={valor}
        disabled={pending}
        // sem items o trigger fechado mostra o enum cru ("mentor_especialista")
        items={ROLE_LABEL}
        onValueChange={(v) => {
          if (v === "coordenacao" && role !== "coordenacao") setConfirmaCoord(true);
          else if (v === "supervisor" && role !== "supervisor") setEscopoAux(true);
          else aplicar(v);
        }}
      >
        <SelectTrigger aria-label="Papel" aria-busy={pending} className="h-11 text-xs md:h-8">
          {pending && <CircleNotch size={13} className="animate-spin text-muted-foreground" />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sem_papel">Sem papel</SelectItem>
          <SelectItem value="mentor_dpp">Mentor DPP</SelectItem>
          <SelectItem value="mentor_especialista">Mentor especialista</SelectItem>
          <SelectItem value="mentor_hibrido">Mentor DPP + especialista</SelectItem>
          <SelectItem value="supervisor">Auxiliar executivo</SelectItem>
          <SelectItem value="coordenacao">Coordenação</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={confirmaCoord} onOpenChange={setConfirmaCoord}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {nome ? `Elevar ${nome} à coordenação?` : "Elevar à coordenação?"}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="leading-relaxed">
            Coordenação vê e edita tudo no app: dados pessoais sensíveis,
            documentos, assinaturas e cadastros. Confirme só se essa pessoa
            faz parte da equipe.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmaCoord(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setConfirmaCoord(false);
                aplicar("coordenacao");
              }}
            >
              {pending && <CircleNotch className="animate-spin" />}
              Elevar à coordenação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EscopoAuxiliarDialog
        profileId={profileId}
        nome={nome}
        atribuir
        open={escopoAux}
        onOpenChange={setEscopoAux}
      />
    </>
  );
}
