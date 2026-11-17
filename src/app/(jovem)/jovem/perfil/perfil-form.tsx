"use client";

import { Camera, CaretDown } from "@phosphor-icons/react";
import {
  CampoDisponibilidade,
  CampoEscolaridade,
  CampoInteresses,
  CampoUf,
} from "@/components/campos-pessoais";
import { SignOutButton } from "@/components/signout-button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  disponibilidadeTexto,
  disponibilidadeVazia,
  ESCOLARIDADE_LABELS,
  formatWhatsApp,
} from "@/lib/ciclo";
import { maskWhatsApp } from "@/lib/utils";
import {
  salvarDisponibilidadeJovem,
  salvarFichaJovem,
  setAvatarJovem,
} from "@/lib/actions-jovem";
import { createClient } from "@/lib/supabase/client";
import {
  avatarPublicUrl,
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  avisoImagemGrande,
} from "@/lib/avatar";
import { novoUuid } from "@/lib/uuid";
import {
  BotaoLapis,
  ChipsTags,
  cliqueSoDoDialog,
  ContaLinha,
  DialogoEmail,
  DialogoSenha,
  FormSecao,
  Linha,
} from "@/app/(app)/perfil/perfil-form";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { TemaToggle } from "@/components/tema-toggle";
import type { Tema } from "@/lib/tema";
import type {
  Disponibilidade,
  Escolaridade,
  JovemPerfil,
  Profile,
} from "@/lib/types";

/** Perfil do jovem no desenho do /perfil de staff — mesmos primitivos
 *  (Linha, lápis→Dialog, ContaLinha): a diferença honesta é o escopo —
 *  dados de conta e apresentação descem em profiles via updateMeuPerfil
 *  (o canônico); os 3 auto-descritivos da ficha (objetivos, motivação,
 *  escolaridade) vão pela RPC jovem_update_ficha porque
 *  mentorados não tem UPDATE pro papel. */
function DialogoDados({ me }: { me: Profile }) {
  const [open, setOpen] = useState(false);
  const [interesses, setInteresses] = useState<string[]>(me.interesses ?? []);
  const [bioLen, setBioLen] = useState(me.bio?.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <BotaoLapis label="Editar seus dados" className="-mr-1.5 -my-1.5" />
        }
      />
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Seus dados</DialogTitle>
          <DialogDescription>
            É daqui que seu mentor e a coordenação falam com você. Cidade e
            interesses também aparecem pros colegas da turma em Pessoas.
          </DialogDescription>
        </DialogHeader>
        <FormSecao aoSalvar={() => setOpen(false)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jf-nome-social">Como quer ser chamado(a)</Label>
              <Input
                id="jf-nome-social"
                name="nome_social"
                maxLength={150}
                defaultValue={me.nome_social ?? ""}
                placeholder="Apelido ou nome social"
                autoComplete="nickname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jf-whatsapp">Seu WhatsApp</Label>
              <Input
                id="jf-whatsapp"
                name="whatsapp"
                inputMode="tel"
                autoComplete="tel"
                maxLength={15}
                defaultValue={formatWhatsApp(me.whatsapp)}
                onInput={(e) => {
                  e.currentTarget.value = maskWhatsApp(e.currentTarget.value);
                }}
                placeholder="(11) 91234-5678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jf-cidade">Cidade</Label>
              <Input
                id="jf-cidade"
                name="cidade"
                maxLength={100}
                defaultValue={me.cidade ?? ""}
                autoComplete="address-level2"
              />
            </div>
            <CampoUf defaultValue={me.uf ?? ""} />
          </div>
          <CampoInteresses value={interesses} onChange={setInteresses} />
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="jf-bio">Sobre você</Label>
              <span
                aria-hidden
                className="text-xs tabular-nums text-muted-foreground"
              >
                {bioLen}/1.000
              </span>
            </div>
            <Textarea
              id="jf-bio"
              name="bio"
              rows={3}
              maxLength={1000}
              defaultValue={me.bio ?? ""}
              onChange={(e) => setBioLen(e.target.value.length)}
              placeholder="O que você estuda, o que curte fazer, o que quer aprender com a mentoria."
            />
          </div>
        </FormSecao>
      </DialogContent>
    </Dialog>
  );
}

/** "Seus dados" — o análogo do "Perfil público" de staff: preview em
 *  <dl> sempre visível e edição no Dialog do lápis, nunca inline. */
export function DadosSecao({ me }: { me: Profile }) {
  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">
            Seus dados
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            É daqui que seu mentor e a coordenação falam com você.
          </p>
        </div>
        <DialogoDados me={me} />
      </div>
      <dl className="mt-4 space-y-4">
        <Linha rotulo="Nome social" valor={me.nome_social?.trim() || "—"} />
        <Linha rotulo="WhatsApp" valor={formatWhatsApp(me.whatsapp) || "—"} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Linha
            rotulo="Cidade"
            valor={me.cidade?.trim() || "—"}
            className="sm:col-span-2"
          />
          <Linha rotulo="UF" valor={me.uf?.trim() || "—"} />
        </div>
        <Linha
          rotulo="Interesses"
          valor={
            me.interesses?.length ? <ChipsTags itens={me.interesses} /> : "—"
          }
        />
        <Linha rotulo="Sobre você" valor={me.bio?.trim() || "—"} />
      </dl>
    </section>
  );
}

/** Foto do jovem no banner (REALIZA-419) — mesmo protocolo do /perfil de
 *  staff: upload instantâneo na pasta do profile_id (a policy do bucket
 *  `avatares` garante), setAvatarJovem grava mentorados.avatar_path e a
 *  troca aplica no estado local sem refresh. O botão "Remover foto" é
 *  irmão do avatar no flex do header, não filho deste wrapper. */
export function FotoPerfil({
  nome,
  pasta,
  src: inicial,
  fallbackSrc,
}: {
  nome: string;
  /** profile_id — a policy do bucket só deixa escrever na pasta própria */
  pasta: string;
  src: string | null;
  /** Gravatar já confirmado no server; null = iniciais direto */
  fallbackSrc: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(inicial);
  const [uploading, setUploading] = useState(false);

  async function trocarFoto(file: File) {
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(avisoImagemGrande(file.size));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${pasta}/${novoUuid()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatares")
        .upload(path, file, { contentType: file.type });
      if (error) {
        toast.error("Não foi possível enviar a foto. Tente de novo.");
        return;
      }
      const res = await setAvatarJovem(path);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSrc(avatarPublicUrl(path));
      toast.success("Foto atualizada.");
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removerFoto() {
    setUploading(true);
    try {
      const res = await setAvatarJovem(null);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setSrc(null);
        toast.success("Foto removida.");
      }
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="relative z-10 -mt-10 shrink-0 sm:-mt-12">
        <Avatar
          nome={nome}
          papel="mentorado"
          src={src}
          fallbackSrc={fallbackSrc}
          size={80}
          className="size-20! ring-4 ring-card outline outline-1 outline-[var(--brand-ink)]/15 sm:size-24!"
        />
        <input
          ref={fileRef}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void trocarFoto(f);
          }}
        />
        <button
          type="button"
          aria-label="Trocar foto"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="absolute -right-2 -bottom-2 grid size-11 place-items-center rounded-full bg-card text-foreground shadow-[var(--shadow-border)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:-right-1 sm:-bottom-1 sm:size-9"
        >
          <Camera size={15} aria-hidden />
        </button>
      </div>
      {src && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={uploading}
          onClick={removerFoto}
          className="text-muted-foreground"
        >
          Remover foto
        </Button>
      )}
    </>
  );
}

/** Corpo do Dialog da ficha — estado próprio e Salvar que chama a RPC
 *  jovem_update_ficha: a escrita é em mentorados, então não usa FormSecao
 *  (que posta pro updateMeuPerfil de profiles). Os 3 campos sempre descem
 *  juntos; vazio vira "limpar" no servidor. */
function FormFichaJovem({
  perfil,
  aoSalvar,
}: {
  perfil: JovemPerfil;
  aoSalvar: () => void;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await salvarFichaJovem(new FormData(e.currentTarget));
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Alterações salvas.");
      aoSalvar();
      router.refresh();
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="jf-objetivos">Seus objetivos com a mentoria</Label>
        <Textarea
          id="jf-objetivos"
          name="objetivos"
          rows={3}
          maxLength={2000}
          defaultValue={perfil.objetivos ?? ""}
          placeholder="O que você quer alcançar no programa"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jf-motivacao">O que te motiva a participar</Label>
        <Textarea
          id="jf-motivacao"
          name="motivacao"
          rows={3}
          maxLength={2000}
          defaultValue={perfil.motivacao ?? ""}
          placeholder="O que te trouxe até aqui"
        />
      </div>
      <CampoEscolaridade defaultValue={perfil.escolaridade ?? ""} />
      <DialogFooter sticky>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DialogoFicha({ perfil }: { perfil: JovemPerfil }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<BotaoLapis label="Editar sua ficha" className="-my-3" />}
      />
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Sua ficha no programa</DialogTitle>
          <DialogDescription>
            Os campos que contam quem você é no programa. Seu mentor e a
            coordenação veem a ficha.
          </DialogDescription>
        </DialogHeader>
        <FormFichaJovem perfil={perfil} aoSalvar={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** "Sua ficha no programa" (REALIZA-420) — a gaveta no molde do staff:
 *  summary com badge de pendências + lápis que abre o Dialog (o onClick
 *  da summary segura o toggle — ver cliqueSoDoDialog). Os auto-descritivos
 *  ganharam edição própria; o que é da coordenação (ONG de origem, como
 *  você chegou — dado de importação/matching, REALIZA-429 — e o que não
 *  aparece aqui) continua só leitura. Pendência = campo editável vazio. */
export function FichaSecao({ perfil }: { perfil: JovemPerfil | null }) {
  const escolaridadeRotulo = perfil?.escolaridade
    ? (ESCOLARIDADE_LABELS[perfil.escolaridade as Escolaridade] ??
      perfil.escolaridade)
    : null;
  const pendentes = perfil
    ? [perfil.objetivos, perfil.motivacao, perfil.escolaridade].filter(
        (v) => !v?.trim(),
      ).length
    : 0;

  return (
    <details
      className="group/ficha rounded-xl bg-card shadow-[var(--shadow-border)]"
      open={!perfil || pendentes > 0}
    >
      <summary
        onClick={cliqueSoDoDialog}
        className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-6 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-open/ficha:rounded-b-none [&::-webkit-details-marker]:hidden"
      >
        <span className="text-sm font-semibold">Sua ficha no programa</span>
        {perfil ? (
          pendentes > 0 ? (
            <Badge
              variant="outline"
              className="border-[var(--warn)]/60 font-normal text-[var(--warn-text)]"
            >
              {pendentes} {pendentes === 1 ? "pendente" : "pendentes"}
            </Badge>
          ) : (
            <span className="text-xs text-[var(--ok-text)]">completo</span>
          )
        ) : (
          <Badge
            variant="outline"
            className="border-[var(--warn)]/60 font-normal text-[var(--warn-text)]"
          >
            não vinculada
          </Badge>
        )}
        {perfil && <DialogoFicha perfil={perfil} />}
        <CaretDown
          size={15}
          aria-hidden
          className="ml-auto shrink-0 text-muted-foreground transition-transform group-open/ficha:rotate-180"
        />
      </summary>
      <div className="border-t border-border px-6 pt-5 pb-6">
        {!perfil ? (
          <p className="text-sm text-muted-foreground">
            Sua ficha de mentorado ainda não está vinculada à sua conta. A
            coordenação faz essa conexão no seu cadastro.
          </p>
        ) : (
          <>
            <dl className="space-y-4">
              <Linha
                rotulo="Seus objetivos com a mentoria"
                valor={perfil.objetivos?.trim() || "—"}
                pendente={!perfil.objetivos?.trim()}
              />
              <Linha
                rotulo="O que te motiva"
                valor={perfil.motivacao?.trim() || "—"}
                pendente={!perfil.motivacao?.trim()}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Linha
                  rotulo="Escolaridade"
                  valor={escolaridadeRotulo || "—"}
                  pendente={!perfil.escolaridade}
                />
                <Linha
                  rotulo="Como você chegou"
                  valor={perfil.origem?.trim() || "—"}
                />
              </div>
              <Linha
                rotulo="ONG de origem"
                valor={perfil.ong_origem?.trim() || "—"}
              />
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Objetivos, motivação e escolaridade você edita no lápis. O
              resto da ficha a coordenação mantém.
            </p>
          </>
        )}
      </div>
    </details>
  );
}

/** Corpo do Dialog da grade — estado próprio (remonta a cada abertura, o
 *  rascunho descartado não vaza) e Salvar que chama a RPC do jovem: a
 *  escrita é em mentorados, não em profiles — por isso não usa FormSecao
 *  (que posta pro updateMeuPerfil). */
function FormDisponibilidade({
  grade,
  aoSalvar,
}: {
  grade: Disponibilidade | null;
  aoSalvar: () => void;
}) {
  const router = useRouter();
  const [disp, setDisp] = useState<Disponibilidade | null>(grade);
  const [pending, start] = useTransition();

  function salvar() {
    start(async () => {
      try {
        const res = await salvarDisponibilidadeJovem(disp);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success("Disponibilidade salva.");
        aoSalvar();
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <CampoDisponibilidade value={disp} onChange={setDisp} />
      {/* sticky: a grade de disponibilidade é alta — a ação não rola pra
          fora da viewport */}
      <DialogFooter sticky>
        <Button type="button" variant="outline" onClick={aoSalvar}>
          Cancelar
        </Button>
        <Button type="button" onClick={salvar} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** "Sua disponibilidade" (REALIZA-114) — o campo que o primeiro acesso
 *  coleta e o lembrete da home aponta. Preview em <dl> sempre visível +
 *  edição no Dialog do lápis, mesmo molde do "Seus dados"; grade vazia
 *  marca o chip "pendente" em vez de esconder a linha. */
export function DisponibilidadeCard({
  grade,
}: {
  grade: Disponibilidade | null;
}) {
  const [open, setOpen] = useState(false);
  const vazia = disponibilidadeVazia(grade);

  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">
            Sua disponibilidade
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os dias e períodos que costumam ser livres pra você. A agenda
            do seu mentor cruza com eles pra marcar os encontros.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <BotaoLapis
                label="Editar sua disponibilidade"
                className="-mr-1.5 -my-1.5"
              />
            }
          />
          <DialogContent size="2xl">
            <DialogHeader>
              <DialogTitle>Sua disponibilidade</DialogTitle>
              <DialogDescription>
                Toque nos dias e períodos em que costuma ter tempo livre.
                Com a sua grade e a do seu mentor, a agenda acha horários
                em comum pros encontros.
              </DialogDescription>
            </DialogHeader>
            <FormDisponibilidade grade={grade} aoSalvar={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <dl className="mt-4 space-y-4">
        <Linha
          rotulo="Dias e períodos livres"
          valor={disponibilidadeTexto(grade) ?? "—"}
          pendente={vazia}
        />
      </dl>
    </section>
  );
}

/** "Conta" — as mesmas linhas de credencial do perfil de staff:
 *  e-mail, senha, aparência e saída, cada uma abrindo seu Dialog/form real. */
export function ContaSecao({ me, tema }: { me: Profile; tema: Tema }) {
  return (
    <>
      <section className="rounded-xl bg-card shadow-[var(--shadow-border)]">
        <h2 className="px-6 pt-5 text-base font-semibold">
          Conta
        </h2>
        <ContaLinha
          titulo="E-mail"
          descricao={me.email}
          acao={<DialogoEmail email={me.email} />}
        />
        <ContaLinha
          titulo="Senha"
          descricao="O link de e-mail continua valendo mesmo com senha definida."
          acao={<DialogoSenha email={me.email} />}
          borda
        />
        {/* mesma linha do perfil de staff — preferência do dispositivo,
            não do programa */}
        <ContaLinha
          titulo="Aparência"
          descricao="Tema da interface neste dispositivo."
          acao={<TemaToggle tema={tema} />}
          borda
        />
        <ContaLinha
          titulo="Sessão"
          descricao="Encerra o acesso da sua conta neste dispositivo."
          acao={
            <SignOutButton
              variant="outline"
              size="sm"
              iconSize={15}
              formClassName="contents"
            />
          }
          borda
        />
      </section>
    </>
  );
}

