"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type Session } from "@supabase/supabase-js";
import { Camera, CaretDown } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { DEMO_MSG } from "@/lib/demo/shared";
import { setAvatarPath, updateMeuPerfil } from "@/lib/actions";
import { avatarPublicUrl, AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { TagInput } from "@/components/tag-input";
import {
  CampoConsentimento,
  CampoDisponibilidade,
  CampoGenero,
  CampoInteresses,
  CampoNascimento,
  CampoPrefGenero,
  CampoUf,
} from "@/components/campos-pessoais";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AREAS_SUGESTOES, formatWhatsApp, papelLabel } from "@/lib/ciclo";
import type { Disponibilidade, MentorProfile, Profile } from "@/lib/types";

/** Qual form está salvando — três forms chamam a mesma action e o patch é
 *  parcial, mas salvar dois ao mesmo tempo misturaria toasts/estados. */
type FormId = "publico" | "cadastro" | "mentoria";

// troca de credencial sem senha atual pra conferir (quem nunca definiu) só
// vale com autenticação recente — sessão velha não pode virar senha nova
const SESSAO_FRESCA_MS = 15 * 60 * 1000;

function sessaoFresca(session: Session | null): boolean {
  if (!session) return false;
  const login = Date.parse(session.user.last_sign_in_at ?? "");
  if (!Number.isNaN(login)) return Date.now() - login < SESSAO_FRESCA_MS;
  // fallback: iat do próprio access_token
  try {
    const payload = JSON.parse(
      atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.iat === "number" && Date.now() - payload.iat * 1000 < SESSAO_FRESCA_MS;
  } catch {
    return false;
  }
}

export function PerfilForm({
  me,
  mentorProfile,
  avatarUrl,
  gravatarUrl,
}: {
  me: Profile;
  mentorProfile: MentorProfile | null;
  avatarUrl: string | null;
  gravatarUrl: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState<FormId | null>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  // quem tem senha prova a posse com ela antes de trocar; quem dispensou no
  // onboarding não tem o que conferir — o gate vira sessão fresca. Default
  // true: quando não dá pra saber, exige a senha atual
  const [temSenha, setTemSenha] = useState(true);
  const [bioLen, setBioLen] = useState(me.bio?.length ?? 0);
  const [volLen, setVolLen] = useState(me.voluntariado?.length ?? 0);
  const [areas, setAreas] = useState<string[]>(me.areas ?? []);
  const [interesses, setInteresses] = useState<string[]>(me.interesses ?? []);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(
    mentorProfile?.disponibilidade ?? null
  );

  // quem dispensou a senha no onboarding (senha_dispensada sem senha_em) não
  // tem "senha atual" pra conferir — o campo some e o gate vira sessão fresca
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      if (meta?.senha_dispensada && !meta?.senha_em) setTemSenha(false);
    });
  }, [supabase]);

  // ---------- pendência × preenchido ----------
  // Os sensíveis (nascimento/gênero/motivação/pref. de par) chegam
  // pré-preenchidos pra todo papel — a page mergea a RPC self-scoped
  // meus_dados_pessoais (0048) por cima do getMe. Conta simples: vazio/null
  // = pendente; e-mail não entra (credencial, sempre presente).
  const tem = (v: string | null | undefined) => Boolean(v?.trim());
  const camposCadastro: { key: string; ok: boolean; wide?: boolean; node: React.ReactNode }[] = [
    {
      key: "nome",
      ok: tem(me.nome),
      node: (
        <div className="space-y-2">
          <Label htmlFor="nome">Nome civil</Label>
          <Input id="nome" name="nome" required defaultValue={me.nome} autoComplete="name" />
        </div>
      ),
    },
    {
      key: "whatsapp",
      ok: tem(me.whatsapp),
      node: (
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          {/* máscara só na exibição — normWhatsapp re-normaliza no save,
              então salvar sem editar não corrompe o número */}
          <Input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            defaultValue={formatWhatsApp(me.whatsapp)}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
          />
        </div>
      ),
    },
    {
      key: "nascimento",
      ok: tem(me.data_nascimento),
      node: <CampoNascimento id="nasc" defaultValue={me.data_nascimento ?? ""} />,
    },
    {
      key: "genero",
      ok: Boolean(me.genero),
      node: <CampoGenero defaultValue={me.genero ?? ""} />,
    },
    {
      key: "origem",
      ok: tem(me.origem),
      node: (
        <div className="space-y-2">
          <Label htmlFor="origem">Como você chegou ao programa</Label>
          <Input
            id="origem" name="origem" maxLength={300}
            defaultValue={me.origem ?? ""}
            placeholder="Indicação, ONG parceira, rede social…"
          />
        </div>
      ),
    },
    {
      key: "pref_genero_par",
      ok: Boolean(me.pref_genero_par),
      node: <CampoPrefGenero defaultValue={me.pref_genero_par ?? ""} />,
    },
    {
      key: "motivacao",
      ok: tem(me.motivacao),
      wide: true,
      node: (
        <div className="space-y-2">
          <Label htmlFor="motivacao">O que te traz ao programa</Label>
          <Textarea
            id="motivacao" name="motivacao" rows={2} maxLength={2000}
            defaultValue={me.motivacao ?? ""}
            placeholder="Sua motivação pra participar da mentoria"
          />
        </div>
      ),
    },
    {
      key: "consent_lgpd",
      ok: Boolean(me.consent_lgpd_em),
      wide: true,
      node: <CampoConsentimento carimbadoEm={me.consent_lgpd_em} />,
    },
  ];
  const cadPendentes = camposCadastro.filter((c) => !c.ok);
  const cadPreenchidos = camposCadastro.filter((c) => c.ok);

  // ficha de mentor: disponibilidade sem nenhum dia conta como pendente
  // (é o dado que o matching cruza), igual os textos vazios
  const mentPendentes = mentorProfile
    ? [
        !(mentorProfile.disponibilidade?.dias?.length ?? 0),
        !tem(mentorProfile.experiencia_previa),
        !tem(mentorProfile.formacao_externa),
      ].filter(Boolean).length
    : 0;

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

  function salvarDados(form: FormId) {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSalvando(form);
      try {
        const res = await updateMeuPerfil(new FormData(e.currentTarget));
        if ("error" in res) toast.error(res.error);
        else toast.success("Dados salvos.");
      } catch {
        toast.error("Sem conexão — tente de novo.");
      } finally {
        setSalvando(null);
      }
    };
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
      if (temSenha) {
        // reautenticação: trocar credencial exige prova recente — a senha
        // atual é a prova (e o sign-in já renova a sessão pro updateUser)
        const { error: erroLogin } = await supabase.auth.signInWithPassword({
          email: me.email,
          password: senhaAtual,
        });
        if (erroLogin) {
          toast.error(
            erroLogin.message === DEMO_MSG
              ? DEMO_MSG
              : erroLogin.code === "invalid_credentials" ||
                  /invalid (login )?credentials/i.test(erroLogin.message)
                ? "Senha atual incorreta."
                : "Não foi possível confirmar a senha atual. Tente de novo."
          );
          return;
        }
      } else {
        // sem senha pra conferir: só uma sessão recém-saída do magic link
        // pode criar uma — sessão velha pede reentrada
        const { data } = await supabase.auth.getSession();
        if (!sessaoFresca(data.session)) {
          toast.error(
            "Por segurança, entre de novo pelo link de e-mail e crie a senha logo em seguida."
          );
          return;
        }
      }
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
        setSenhaAtual("");
        setConfirmacao("");
        setTemSenha(true);
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

      {/* perfil público — os campos que a ficha em /pessoas/[id] mostra a
          quem alcança a página (pra profile: coordenação e supervisão) */}
      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-semibold">Perfil público</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          É o que aparece na sua página em Pessoas — visível pra coordenação e supervisão.
        </p>
        <form onSubmit={salvarDados("publico")} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_social">Nome social</Label>
            <Input
              id="nome_social"
              name="nome_social"
              maxLength={150}
              defaultValue={me.nome_social ?? ""}
              placeholder="Nome de uso, se diferente"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="bio">Biografia</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {bioLen}/1.000
              </span>
            </div>
            {/* apresentação profissional (0030) — alimenta também as áreas do
                select de especialista */}
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
            <p className="text-sm font-medium">Áreas de atuação</p>
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
          <CampoInteresses value={interesses} onChange={setInteresses} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" name="cidade" maxLength={100} defaultValue={me.cidade ?? ""} />
            </div>
            <CampoUf defaultValue={me.uf ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" name="cargo" maxLength={120} defaultValue={me.cargo ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Input id="empresa" name="empresa" maxLength={150} defaultValue={me.empresa ?? ""} />
            </div>
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
          <Button type="submit" disabled={salvando !== null}>
            {salvando === "publico" ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </section>

      {/* dados de cadastro — o burocrático recolhido: com buracos abre e
          avisa no summary; completo fica a um gesto de distância */}
      <details
        className="group/cadastro rounded-xl bg-card shadow-[var(--shadow-border)]"
        open={cadPendentes.length > 0}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-6 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-open/cadastro:rounded-b-none [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold">Dados de cadastro</span>
          {cadPendentes.length > 0 ? (
            <Badge
              variant="outline"
              className="border-[var(--warn)]/60 font-normal text-[var(--warn-text)]"
            >
              {cadPendentes.length} {cadPendentes.length === 1 ? "pendente" : "pendentes"}
            </Badge>
          ) : (
            <span className="text-xs text-[var(--ok-text)]">completo</span>
          )}
          <CaretDown
            size={15}
            aria-hidden
            className="ml-auto shrink-0 text-muted-foreground transition-transform group-open/cadastro:rotate-180"
          />
        </summary>
        <div className="border-t border-border px-6 pb-6 pt-5">
          {/* onInvalid: campo inválido dentro do <details> "Já cadastrados"
              fechado bloqueava o submit em silêncio (controle não focável) —
              abrir o ancestral deixa o bubble do browser ancorar no campo */}
          <form
            onSubmit={salvarDados("cadastro")}
            onInvalid={(e) => {
              const d = (e.target as HTMLElement).closest("details");
              if (d) d.open = true;
            }}
            className="space-y-4"
          >
            {/* e-mail é a credencial, só a coord troca — sempre preenchido,
                então fica fora da conta de pendentes e fora do split */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={me.email} disabled />
              <p className="text-xs text-muted-foreground">
                O e-mail é sua credencial de acesso — para trocar, fale com a coordenação.
              </p>
            </div>
            {cadPendentes.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {cadPendentes.map((c) => (
                  <div key={c.key} className={c.wide ? "sm:col-span-2" : undefined}>
                    {c.node}
                  </div>
                ))}
              </div>
            )}
            {cadPreenchidos.length > 0 && (
              <details
                className={
                  "group/cadastrados" +
                  (cadPendentes.length > 0 ? " border-t border-border pt-3" : "")
                }
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 [&::-webkit-details-marker]:hidden">
                  Já cadastrados ({cadPreenchidos.length})
                  <CaretDown
                    size={13}
                    aria-hidden
                    className="ml-auto transition-transform group-open/cadastrados:rotate-180"
                  />
                </summary>
                <div className="grid gap-4 pb-1 sm:grid-cols-2">
                  {cadPreenchidos.map((c) => (
                    <div key={c.key} className={c.wide ? "sm:col-span-2" : undefined}>
                      {c.node}
                    </div>
                  ))}
                </div>
              </details>
            )}
            <Button type="submit" disabled={salvando !== null}>
              {salvando === "cadastro" ? "Salvando…" : "Salvar"}
            </Button>
          </form>
        </div>
      </details>

      {/* ficha de mentor (0034) — self-update cobre experiência/formação/
          disponibilidade; capacidade/tipo/validações seguem só com a coord */}
      {mentorProfile && (
        <details
          className="group/mentoria rounded-xl bg-card shadow-[var(--shadow-border)]"
          open={mentPendentes > 0}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-6 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-open/mentoria:rounded-b-none [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-semibold">Mentoria</span>
            {mentPendentes > 0 ? (
              <Badge
                variant="outline"
                className="border-[var(--warn)]/60 font-normal text-[var(--warn-text)]"
              >
                {mentPendentes} {mentPendentes === 1 ? "pendente" : "pendentes"}
              </Badge>
            ) : (
              <span className="text-xs text-[var(--ok-text)]">completo</span>
            )}
            <CaretDown
              size={15}
              aria-hidden
              className="ml-auto shrink-0 text-muted-foreground transition-transform group-open/mentoria:rotate-180"
            />
          </summary>
          <div className="border-t border-border px-6 pb-6 pt-5">
            <form onSubmit={salvarDados("mentoria")} className="space-y-4">
              <CampoDisponibilidade value={disponibilidade} onChange={setDisponibilidade} />
              <div className="space-y-2">
                <Label htmlFor="experiencia_previa">Experiência prévia como mentor</Label>
                <Textarea
                  id="experiencia_previa" name="experiencia_previa" rows={3} maxLength={2000}
                  defaultValue={mentorProfile.experiencia_previa ?? ""}
                  placeholder="Mentorias anteriores, mediação, ensino…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formacao_externa">Formação e certificações</Label>
                <Textarea
                  id="formacao_externa" name="formacao_externa" rows={3} maxLength={2000}
                  defaultValue={mentorProfile.formacao_externa ?? ""}
                  placeholder="Cursos e certificações relevantes pra mentoria"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A coordenação cruza sua disponibilidade com a do mentorado na hora de formar a dupla.
              </p>
              <Button type="submit" disabled={salvando !== null}>
                {salvando === "mentoria" ? "Salvando…" : "Salvar"}
              </Button>
            </form>
          </div>
        </details>
      )}

      {/* senha — reautentica antes do updateUser (senha atual ou sessão
          fresca do magic link); a flag senha_em é o que pula o onboarding */}
      <details className="group/senha rounded-xl bg-card shadow-[var(--shadow-border)]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-6 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-open/senha:rounded-b-none [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold">Senha</span>
          <CaretDown
            size={15}
            aria-hidden
            className="ml-auto shrink-0 text-muted-foreground transition-transform group-open/senha:rotate-180"
          />
        </summary>
        <div className="border-t border-border px-6 pb-6 pt-5">
          <form onSubmit={salvarSenha} className="space-y-4">
            {temSenha ? (
              <div className="space-y-2">
                <Label htmlFor="senha-atual">Senha atual</Label>
                <Input
                  id="senha-atual"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você entra pelo link de e-mail — por segurança, a sessão
                precisa ser recente pra criar uma senha.
              </p>
            )}
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
        </div>
      </details>
    </div>
  );
}
