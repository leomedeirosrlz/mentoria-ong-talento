"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { setAvatarPath, updateMeuPerfil } from "@/lib/actions";
import { avatarPublicUrl, AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AREAS_SUGESTOES, papelLabel } from "@/lib/ciclo";
import type { Profile } from "@/lib/types";

export function PerfilForm({
  me,
  avatarUrl,
  gravatarUrl,
}: {
  me: Profile;
  avatarUrl: string | null;
  gravatarUrl: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [bioLen, setBioLen] = useState(me.bio?.length ?? 0);
  const [volLen, setVolLen] = useState(me.voluntariado?.length ?? 0);
  const [areas, setAreas] = useState<string[]>(me.areas ?? []);

  async function trocarFoto(file: File) {
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Imagem grande demais — use uma de até 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatares")
        .upload(path, file, { contentType: file.type });
      if (error) {
        toast.error("Não foi possível enviar a foto. Tente de novo.");
        return;
      }
      const res = await setAvatarPath(path);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSrc(avatarPublicUrl(path));
      toast.success("Foto atualizada.");
    } catch {
      toast.error("Sem conexão — tente de novo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removerFoto() {
    setUploading(true);
    try {
      const res = await setAvatarPath(null);
      if ("error" in res) toast.error(res.error);
      else {
        setSrc(null);
        toast.success("Foto removida.");
      }
    } catch {
      toast.error("Sem conexão — tente de novo.");
    } finally {
      setUploading(false);
    }
  }

  async function salvarDados(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await updateMeuPerfil(new FormData(e.currentTarget));
      if ("error" in res) toast.error(res.error);
      else toast.success("Dados salvos.");
    } catch {
      toast.error("Sem conexão — tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("Use pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSalvandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { senha_em: new Date().toISOString() },
      });
      if (error) {
        toast.error(
          error.code === "weak_password"
            ? "Senha fraca — combine letras e números."
            : "Não foi possível trocar a senha. Tente de novo."
        );
      } else {
        setSenha("");
        setConfirmacao("");
        toast.success("Senha atualizada.");
      }
    } catch {
      toast.error("Sem conexão — tente de novo.");
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">{papelLabel(me.role)}</p>
      </div>

      {/* foto — upload próprio; sem foto cai no Gravatar do e-mail, depois iniciais */}
      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-semibold">Foto</h2>
        <div className="mt-4 flex items-center gap-4">
          <Avatar nome={me.nome} src={src} fallbackSrc={gravatarUrl} size={72} />
          <div className="space-y-2">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={15} aria-hidden />
              {uploading ? "Enviando…" : src ? "Trocar foto" : "Enviar foto"}
            </Button>
            {src && (
              <button
                type="button"
                disabled={uploading}
                onClick={removerFoto}
                className="flex min-h-11 items-center text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Remover foto
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              PNG, JPG ou WebP até 2 MB. Sem foto, usamos a do seu e-mail.
            </p>
          </div>
        </div>
      </section>

      {/* dados — nome/whatsapp self-edit; e-mail é a credencial, só a coord troca */}
      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-semibold">Dados</h2>
        <form onSubmit={salvarDados} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required defaultValue={me.nome} autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              defaultValue={me.whatsapp ?? ""}
              placeholder="(11) 99999-9999"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={me.email} disabled />
            <p className="text-xs text-muted-foreground">
              O e-mail é sua credencial de acesso — para trocar, fale com a coordenação.
            </p>
          </div>
          {/* apresentação profissional (0030) — aparece em /pessoas/[id] e nas
              áreas do select de especialista */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="bio">Biografia</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {bioLen}/1.000
              </span>
            </div>
            <Textarea
              id="bio"
              name="bio"
              rows={4}
              maxLength={1000}
              defaultValue={me.bio ?? ""}
              onChange={(e) => setBioLen(e.target.value.length)}
              placeholder="O que você faz, o que estudou, o que te trouxe ao programa."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              name="linkedin"
              type="url"
              inputMode="url"
              defaultValue={me.linkedin ?? ""}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <div className="space-y-2">
            {/* o hidden do TagInput manda JSON — camposApresentacao aceita
                JSON ou vírgula, então forms antigos continuam valendo */}
            <Label>Áreas de atuação</Label>
            <TagInput
              name="areas"
              sugestoes={AREAS_SUGESTOES}
              value={areas}
              onChange={setAreas}
              placeholder="ex.: psicologia, idiomas…"
              inputLabel="Digite uma área e pressione Enter"
            />
            <p className="text-xs text-muted-foreground">
              Toque pra selecionar ou digite uma nova área.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="voluntariado">Experiência com voluntariado</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {volLen}/300
              </span>
            </div>
            <Input
              id="voluntariado"
              name="voluntariado"
              maxLength={300}
              defaultValue={me.voluntariado ?? ""}
              onChange={(e) => setVolLen(e.target.value.length)}
              placeholder="ex.: 2 anos como voluntário no Projeto X"
            />
          </div>
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </section>

      {/* senha — updateUser direto; a flag senha_em é o que pula o onboarding */}
      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-semibold">Senha</h2>
        <form onSubmit={salvarSenha} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input
              id="nova-senha"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirma-senha">Confirmar nova senha</Label>
            <Input
              id="confirma-senha"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={salvandoSenha}>
            {salvandoSenha ? "Salvando…" : "Trocar senha"}
          </Button>
        </form>
      </section>
    </div>
  );
}
