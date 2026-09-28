"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type Session } from "@supabase/supabase-js";
import {
  Camera,
  CaretDown,
  FileArrowDown,
  PencilSimple,
  Signature,
  SignOut,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { DEMO_MSG } from "@/lib/demo/shared";
import { setAvatarPath, signOut, updateMeuPerfil } from "@/lib/actions";
import { avatarPublicUrl, AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { PessoaBanner } from "@/components/pessoa-banner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AREAS_SUGESTOES,
  disponibilidadeTexto,
  formatDate,
  formatMesAno,
  formatWhatsApp,
  GENERO_LABELS,
  idade,
  linkSeguro,
  papelLabel,
  PREF_GENERO_LABELS,
} from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import type { Assinatura, Disponibilidade, MentorProfile, Profile } from "@/lib/types";
import Link from "next/link";

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

/** Chip "pendente" nas linhas do preview — a contagem do summary é a soma
 *  destes badges (completude se lê nos dados, não no modo). */
function BadgePendente() {
  return (
    <Badge
      variant="outline"
      className="mt-0.5 shrink-0 border-[var(--warn)]/60 font-normal text-[var(--warn-text)]"
    >
      pendente
    </Badge>
  );
}

/** Linha "rótulo · valor" do preview — o mesmo padrão da ficha em
 *  /pessoas/[id]. No mobile o rótulo empilha sobre o valor (o dt fixo de
 *  128px esmagava a linha em telas estreitas); a partir de sm volta a ser
 *  coluna lateral. `empilhado` trava o modo vertical: é o caso do card de
 *  cadastro, que mora num rail de ~290px e ainda divide em 2 colunas — lá
 *  a coluna lateral nunca cabe. Só entra em <dl>. */
function Linha({
  rotulo,
  valor,
  pendente,
  className,
  empilhado = false,
}: {
  rotulo: string;
  valor: React.ReactNode;
  pendente?: boolean;
  className?: string;
  /** rótulo sempre sobre o valor — pra <dl> dentro de containers estreitos */
  empilhado?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.5 text-sm",
          !empilhado && "sm:flex-row sm:gap-2"
        )}
      >
        <dt
          className={cn(
            "shrink-0 text-muted-foreground",
            !empilhado && "sm:w-32"
          )}
        >
          {rotulo}
        </dt>
        <dd className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {valor}
        </dd>
      </div>
      {pendente && <BadgePendente />}
    </div>
  );
}

/** Tags estilo TagInput no modo leitura — mesmas pílulas, sem o gesto. */
function ChipsTags({ itens }: { itens: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {itens.map((i) => (
        <Badge key={i} variant="secondary" className="font-normal">
          {i}
        </Badge>
      ))}
    </span>
  );
}

/** Leitura de um campo do cadastro no preview — texto já formatado ou
 *  chips; vazio cai no "—" (o chip pendente vem de `pendente`). */
type ValorSpec = {
  rotulo: string;
  texto?: string | null;
  chips?: string[];
};

function Valor({ campo, pendente }: { campo: ValorSpec; pendente?: boolean }) {
  return (
    <Linha
      rotulo={campo.rotulo}
      pendente={pendente}
      // célula de ~140px no grid do rail — a coluna lateral nunca cabe
      empilhado
      valor={
        campo.chips?.length ? (
          <ChipsTags itens={campo.chips} />
        ) : (
          campo.texto?.trim() || "—"
        )
      }
    />
  );
}

/** Um campo do cadastro em duas leituras: `valor` alimenta a <dl> do
 *  preview (sempre visível) e `node` é o input que aparece no Dialog de
 *  edição da seção. `ok` marca pendência no preview e na conta do summary. */
type CampoCadastroSpec = {
  key: string;
  ok: boolean;
  wide?: boolean;
  valor: ValorSpec;
  node: React.ReactNode;
};

/** Lápis de seção — a convenção de rede social: editar é por card, nunca um
 *  modo global. Sempre visível e discreto (muted → foreground no hover);
 *  o aria-label nomeia a seção que o Dialog vai abrir. O `...props` é
 *  obrigatório: usado como `render` do DialogTrigger, ele recebe as props
 *  injetadas pelo base-ui (onClick, aria-haspopup, ref…) — sem repassar, o
 *  trigger vira um botão morto. */
function BotaoLapis({
  label,
  className,
  ...props
}: { label: string } & Omit<
  React.ComponentProps<typeof Button>,
  "aria-label" | "children"
>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      {...props}
      aria-label={label}
      className={cn(
        "shrink-0 text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <PencilSimple size={16} aria-hidden />
    </Button>
  );
}

/** Clique no lápis dentro de <summary>: o gesto é só do Dialog — sem o
 *  preventDefault o activation behavior do summary abriria/fecharia a
 *  gaveta junto (o lápis é filho dela, e o toggle dispara em qualquer
 *  clique interno). Fica no onClick do summary pra rodar DEPOIS do handler
 *  do trigger (o Dialog já abriu quando o default morre aqui). */
function cliqueSoDoDialog(e: React.MouseEvent<HTMLElement>) {
  if ((e.target as HTMLElement).closest("[data-slot='dialog-trigger']")) {
    e.preventDefault();
  }
}

/** <form> comum dos modais de seção — cada um manda só os próprios campos;
 *  o action grava patch parcial por chave presente (o que não veio no
 *  FormData não é tocado). Sucesso: toast + refresh + fecha o modal. */
function FormSecao({
  aoSalvar,
  children,
}: {
  aoSalvar: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await updateMeuPerfil(new FormData(e.currentTarget));
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
      {children}
      <Button type="submit" className="w-full" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

/** Corpo do Dialog "Perfil público" — os campos que a ficha em
 *  /pessoas/[id] mostra a quem alcança a página (hoje qualquer papel — a
 *  ficha do colega é o diretório interno).
 *  Monta a cada abertura do modal: os defaultValues vêm sempre do profile
 *  mais recente e os controlados (tags/grade) recomeçam limpos — fechar sem
 *  salvar descarta o rascunho sozinho. */
function FormPerfilPublico({
  me,
  aoSalvar,
}: {
  me: Profile;
  aoSalvar: () => void;
}) {
  const [bioLen, setBioLen] = useState(me.bio?.length ?? 0);
  const [volLen, setVolLen] = useState(me.voluntariado?.length ?? 0);
  const [areas, setAreas] = useState<string[]>(me.areas ?? []);
  const [interesses, setInteresses] = useState<string[]>(me.interesses ?? []);

  return (
    <FormSecao aoSalvar={aoSalvar}>
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
        {/* o hidden do TagInput manda JSON — camposApresentacao aceita JSON
            ou vírgula, então forms antigos continuam valendo */}
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
          <Input
            id="cidade"
            name="cidade"
            maxLength={100}
            defaultValue={me.cidade ?? ""}
          />
        </div>
        <CampoUf defaultValue={me.uf} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cargo">Cargo</Label>
          <Input
            id="cargo"
            name="cargo"
            maxLength={120}
            defaultValue={me.cargo ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa</Label>
          <Input
            id="empresa"
            name="empresa"
            maxLength={150}
            defaultValue={me.empresa ?? ""}
          />
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
    </FormSecao>
  );
}

/** Corpo do Dialog "Dados de cadastro" — o burocrático da ficha (contato,
 *  sensíveis do matching e LGPD). O e-mail entra só como leitura: é a
 *  credencial, trocável só pela coordenação — nunca vai pro FormData. */
function FormCadastro({
  me,
  campos,
  aoSalvar,
}: {
  me: Profile;
  campos: CampoCadastroSpec[];
  aoSalvar: () => void;
}) {
  return (
    <FormSecao aoSalvar={aoSalvar}>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" value={me.email} disabled />
        <p className="text-xs text-muted-foreground">
          O e-mail é sua credencial de acesso. Para trocar, fale com a coordenação.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {campos.map((c) => (
          <div key={c.key} className={c.wide ? "sm:col-span-2" : undefined}>
            {c.node}
          </div>
        ))}
      </div>
    </FormSecao>
  );
}

/** Corpo do Dialog "Mentoria" — self-update cobre disponibilidade/
 *  experiência/formação; capacidade/tipo/validações seguem só com a coord. */
function FormMentoria({
  mentorProfile,
  aoSalvar,
}: {
  mentorProfile: MentorProfile;
  aoSalvar: () => void;
}) {
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(
    mentorProfile.disponibilidade ?? null
  );

  return (
    <FormSecao aoSalvar={aoSalvar}>
      <CampoDisponibilidade value={disponibilidade} onChange={setDisponibilidade} />
      <div className="space-y-2">
        <Label htmlFor="experiencia_previa">Experiência prévia como mentor</Label>
        <Textarea
          id="experiencia_previa"
          name="experiencia_previa"
          rows={3}
          maxLength={2000}
          defaultValue={mentorProfile.experiencia_previa ?? ""}
          placeholder="Mentorias anteriores, mediação, ensino…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="formacao_externa">Formação e certificações</Label>
        <Textarea
          id="formacao_externa"
          name="formacao_externa"
          rows={3}
          maxLength={2000}
          defaultValue={mentorProfile.formacao_externa ?? ""}
          placeholder="Cursos e certificações relevantes pra mentoria"
        />
      </div>
    </FormSecao>
  );
}

/** Dialog da seção "Perfil público" — lápis no canto do card abre só os
 *  campos dela, com Salvar próprio (patch parcial no updateMeuPerfil). */
function DialogoPerfilPublico({ me }: { me: Profile }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <BotaoLapis label="Editar perfil público" className="-mr-1.5 -my-1.5" />
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Perfil público</DialogTitle>
          <DialogDescription>
            É o que aparece na sua página em Pessoas, visível pra coordenação
            e supervisão.
          </DialogDescription>
        </DialogHeader>
        <FormPerfilPublico me={me} aoSalvar={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Dialog da seção "Dados de cadastro" — o lápis mora dentro do <summary>
 *  da gaveta (o onClick dela segura o toggle — ver cliqueSoDoDialog). */
function DialogoCadastro({
  me,
  campos,
}: {
  me: Profile;
  campos: CampoCadastroSpec[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <BotaoLapis
            label="Editar dados de cadastro"
            className="-my-3 ml-auto"
          />
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dados de cadastro</DialogTitle>
          <DialogDescription>
            Os dados do seu cadastro no programa — a coordenação usa pra
            contato e pra formar as duplas.
          </DialogDescription>
        </DialogHeader>
        <FormCadastro me={me} campos={campos} aoSalvar={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Dialog da seção "Mentoria" — idem, lápis dentro do <summary>. */
function DialogoMentoria({ mentorProfile }: { mentorProfile: MentorProfile }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <BotaoLapis label="Editar mentoria" className="-my-3 ml-auto" />
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Mentoria</DialogTitle>
          <DialogDescription>
            A coordenação cruza sua disponibilidade com a do mentorado na
            hora de formar a dupla.
          </DialogDescription>
        </DialogHeader>
        <FormMentoria mentorProfile={mentorProfile} aoSalvar={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function PerfilForm({
  me,
  mentorProfile,
  avatarUrl,
  gravatarUrl,
  assinaturaTermo,
}: {
  me: Profile;
  mentorProfile: MentorProfile | null;
  avatarUrl: string | null;
  gravatarUrl: string;
  /** Termo de voluntariado do próprio usuário — pendência do cadastro que
   *  não é campo de form (a assinatura é outra página, /assinar). */
  assinaturaTermo: Assinatura | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  // quem tem senha prova a posse com ela antes de trocar; quem dispensou no
  // onboarding não tem o que conferir — o gate vira sessão fresca. Default
  // true: quando não dá pra saber, exige a senha atual
  const [temSenha, setTemSenha] = useState(true);

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
  const anosNasc = idade(me.data_nascimento);
  // `valor` é a leitura do campo no <dl> do preview; `node` é o input que o
  // Dialog da seção renderiza — a mesma ordem nos dois lugares
  const camposCadastro: CampoCadastroSpec[] = [
    {
      key: "nome",
      ok: tem(me.nome),
      valor: { rotulo: "Nome civil", texto: me.nome },
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
      valor: { rotulo: "WhatsApp", texto: formatWhatsApp(me.whatsapp) },
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
      valor: {
        rotulo: "Nascimento",
        texto: me.data_nascimento
          ? `${formatDate(me.data_nascimento)}${anosNasc != null ? ` (${anosNasc} anos)` : ""}`
          : null,
      },
      node: <CampoNascimento id="nasc" defaultValue={me.data_nascimento ?? ""} />,
    },
    {
      key: "genero",
      ok: Boolean(me.genero),
      valor: {
        rotulo: "Gênero",
        texto: me.genero ? GENERO_LABELS[me.genero] : null,
      },
      node: <CampoGenero defaultValue={me.genero} />,
    },
    {
      key: "origem",
      ok: tem(me.origem),
      valor: { rotulo: "Origem", texto: me.origem },
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
      valor: {
        rotulo: "Pref. de par",
        texto: me.pref_genero_par ? PREF_GENERO_LABELS[me.pref_genero_par] : null,
      },
      node: <CampoPrefGenero defaultValue={me.pref_genero_par} />,
    },
    {
      key: "motivacao",
      ok: tem(me.motivacao),
      wide: true,
      valor: { rotulo: "Motivação", texto: me.motivacao },
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
      valor: {
        rotulo: "LGPD",
        texto: me.consent_lgpd_em
          ? `Consentimento em ${formatDate(me.consent_lgpd_em)}`
          : null,
      },
      node: <CampoConsentimento carimbadoEm={me.consent_lgpd_em} />,
    },
  ];
  const cadPendentes = camposCadastro.filter((c) => !c.ok);
  // o termo de voluntariado entra na conta de pendências da gaveta mesmo
  // não sendo campo — cadastro completo = dados + assinatura
  const termoOk = assinaturaTermo?.status === "assinado";
  const pendentesTotal = cadPendentes.length + (termoOk ? 0 : 1);

  // ficha de mentor: disponibilidade sem nenhum dia conta como pendente
  // (é o dado que o matching cruza), igual os textos vazios
  const dispOk = (mentorProfile?.disponibilidade?.dias?.length ?? 0) > 0;
  const experienciaOk = tem(mentorProfile?.experiencia_previa);
  const formacaoOk = tem(mentorProfile?.formacao_externa);
  const mentPendentes = mentorProfile
    ? [!dispOk, !experienciaOk, !formacaoOk].filter(Boolean).length
    : 0;

  // LinkedIn vira link quieto quando a URL é http(s) — texto cru senão
  const linkedinUrl = linkSeguro(me.linkedin);
  const linkedinPreview = me.linkedin?.trim() ? (
    linkedinUrl ? (
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        {me.linkedin}
      </a>
    ) : (
      me.linkedin
    )
  ) : (
    "—"
  );

  // ---------- capa ----------
  // o h1 da página é o nome de uso — social quando existe, civil senão
  const nomeExibicao = me.nome_social?.trim() || me.nome;
  // mentores ganham o dot lime no chip de papel — "quem age" na dupla,
  // mesma convenção do board de matching e da lista de pessoas
  const isMentor = me.role === "mentor_dpp" || me.role === "mentor_especialista";
  // linha meta do header: cada segmento só entra com dado — created_at é
  // opcional no tipo (selects parciais podem omitir), então "no programa
  // desde" é condicional
  const metaItens = [
    [me.cargo?.trim(), me.empresa?.trim()].filter(Boolean).join(" · ") || null,
    [me.cidade?.trim(), me.uf?.trim()].filter(Boolean).join(" · ") || null,
    me.created_at ? `no programa desde ${formatMesAno(me.created_at)}` : null,
  ].filter((s): s is string => Boolean(s));

  async function trocarFoto(file: File) {
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Imagem grande demais: use uma de até 2 MB.");
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
      toast.error("Sem conexão. Tente de novo.");
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
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setUploading(false);
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
            ? "Senha fraca: combine letras e números."
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
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* capa estilo rede social: banner ink com brilho lime + avatar
          sobreposto, nome como h1 e linha meta (papel, trabalho, cidade,
          entrada no programa). A foto segue o gesto instantâneo das redes —
          o overlay de câmera fica sempre à vista e o upload é direto,
          sem modo edição nem botão de save */}
      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        {/* o mesmo banner generativo da ficha — a identidade da pessoa não
            muda entre "eu me vejo" e "colegas me veem" */}
        <PessoaBanner
          papel={me.role}
          nome={me.nome}
          cidade={me.cidade}
          uf={me.uf}
          areas={
            // mesma precedência da ficha: só áreas PROFISSIONAIS — sem
            // nenhuma, a linha mono fica só cidade·uf (interesses são
            // hobbies, não atuação)
            me.areas?.length
              ? me.areas
              : (mentorProfile?.areas ?? [])
          }
          seed={me.id}
        />
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="flex items-end justify-between gap-3">
            {/* relative z-10: o wrapper posicionado já ganhava a pintura do
                banner; o z explícito segura a sobreposição se o banner um
                dia ganhar camada própria */}
            <div className="relative z-10 -mt-10 shrink-0 sm:-mt-12">
              {/* size-20!/sm:size-24! sobem por cima do style inline que o
                  Avatar fixa via prop (width/height) — a prop segue ditando
                  fontSize e o fallback de 80px abaixo de sm */}
              <Avatar
                nome={me.nome}
                src={src}
                fallbackSrc={gravatarUrl}
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
                className="absolute -right-0.5 -bottom-0.5 grid size-8 place-items-center rounded-full bg-card text-foreground shadow-[var(--shadow-border)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
            {nomeExibicao}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1.5 font-normal">
              {isMentor && (
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-[var(--role-mentor)]"
                />
              )}
              {papelLabel(me.role)}
            </Badge>
            {metaItens.length > 0 && <span>{metaItens.join(" · ")}</span>}
          </div>
          {/* chip-âncora pro cadastro — só existe quando há o que apontar */}
          {pendentesTotal > 0 && (
            <Badge
              variant="outline"
              render={<a href="#cadastro" />}
              className="mt-3 border-[var(--warn)]/60 font-normal text-[var(--warn-text)]"
            >
              {pendentesTotal}{" "}
              {pendentesTotal === 1 ? "pendência" : "pendências"} no cadastro
            </Badge>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            PNG, JPG ou WebP até 2 MB. Sem foto, usamos a do seu e-mail.
          </p>
        </div>
      </header>

      {/* xl e não lg: a 1024px o rail deixaria a ficha com ~390px e
          esmagaria os dt — a quebra só vale quando a coluna respira */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* coluna principal — antes do rail no DOM: no mobile a ficha
            pública empilha primeiro, logo abaixo da capa */}
        <div className="min-w-0 space-y-6">
          {/* perfil público — os campos que a ficha em /pessoas/[id] mostra
              a quem alcança a página (pra profile: coordenação e
              supervisão). Preview é sempre a <dl>; a edição acontece no
              Dialog do lápis, nunca inline */}
          <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Perfil público
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  É o que aparece na sua página em Pessoas, visível pra
                  coordenação e supervisão.
                </p>
              </div>
              <DialogoPerfilPublico me={me} />
            </div>
            <dl className="mt-4 space-y-4">
              <Linha rotulo="Nome social" valor={me.nome_social?.trim() || "—"} />
              <Linha rotulo="Biografia" valor={me.bio?.trim() || "—"} />
              <Linha rotulo="LinkedIn" valor={linkedinPreview} />
              <Linha
                rotulo="Áreas de atuação"
                valor={me.areas?.length ? <ChipsTags itens={me.areas} /> : "—"}
              />
              <Linha
                rotulo="Interesses"
                valor={
                  me.interesses?.length ? <ChipsTags itens={me.interesses} /> : "—"
                }
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Linha
                  rotulo="Cidade"
                  valor={me.cidade?.trim() || "—"}
                  className="sm:col-span-2"
                />
                <Linha rotulo="UF" valor={me.uf?.trim() || "—"} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Linha rotulo="Cargo" valor={me.cargo?.trim() || "—"} />
                <Linha rotulo="Empresa" valor={me.empresa?.trim() || "—"} />
              </div>
              <Linha
                rotulo="Voluntariado"
                valor={me.voluntariado?.trim() || "—"}
              />
            </dl>
          </section>

          {/* ficha de mentor (0034) — gaveta com os dados que o matching
              cruza; a edição é o Dialog do lápis no summary */}
          {mentorProfile && (
            <details
              className="group/mentoria rounded-xl bg-card shadow-[var(--shadow-border)]"
              open={mentPendentes > 0}
            >
              <summary
                onClick={cliqueSoDoDialog}
                className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-6 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-open/mentoria:rounded-b-none [&::-webkit-details-marker]:hidden"
              >
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
                <DialogoMentoria mentorProfile={mentorProfile} />
                <CaretDown
                  size={15}
                  aria-hidden
                  className="shrink-0 text-muted-foreground transition-transform group-open/mentoria:rotate-180"
                />
              </summary>
              <div className="border-t border-border px-6 pb-6 pt-5">
                <dl className="space-y-4">
                  <Linha
                    rotulo="Disponível"
                    valor={disponibilidadeTexto(mentorProfile.disponibilidade) ?? "—"}
                    pendente={!dispOk}
                  />
                  <Linha
                    rotulo="Experiência"
                    valor={mentorProfile.experiencia_previa?.trim() || "—"}
                    pendente={!experienciaOk}
                  />
                  <Linha
                    rotulo="Formação"
                    valor={mentorProfile.formacao_externa?.trim() || "—"}
                    pendente={!formacaoOk}
                  />
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  A coordenação cruza sua disponibilidade com a do mentorado
                  na hora de formar a dupla.
                </p>
              </div>
            </details>
          )}
        </div>

        {/* rail — o burocrático (cadastro + termo) e a conta */}
        <div className="min-w-0 space-y-6">
          {/* dados de cadastro — o burocrático recolhido: com buracos abre e
              avisa no summary; completo fica a um gesto de distância. O chip
              da capa ancora aqui (scroll-mt respeita o header) */}
          <details
            id="cadastro"
            className="group/cadastro scroll-mt-20 rounded-xl bg-card shadow-[var(--shadow-border)]"
            open={pendentesTotal > 0}
          >
            <summary
              onClick={cliqueSoDoDialog}
              className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-6 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-open/cadastro:rounded-b-none [&::-webkit-details-marker]:hidden"
            >
              <span className="text-sm font-semibold">Dados de cadastro</span>
              {pendentesTotal > 0 ? (
                <Badge
                  variant="outline"
                  className="border-[var(--warn)]/60 font-normal text-[var(--warn-text)]"
                >
                  {pendentesTotal} {pendentesTotal === 1 ? "pendente" : "pendentes"}
                </Badge>
              ) : (
                <span className="text-xs text-[var(--ok-text)]">completo</span>
              )}
              <DialogoCadastro me={me} campos={camposCadastro} />
              <CaretDown
                size={15}
                aria-hidden
                className="shrink-0 text-muted-foreground transition-transform group-open/cadastro:rotate-180"
              />
            </summary>
            <div className="border-t border-border px-6 pb-6 pt-5">
              {/* ordem fixa no preview: o que falta ganha badge "pendente"
                  inline em vez de mudar de lugar (o split "pendentes × já
                  cadastrados" fazia o campo sumir depois do save) */}
              <dl className="space-y-4">
                {/* rail estreito: tudo aqui empilha rótulo sobre valor */}
                <Linha rotulo="E-mail" valor={me.email} empilhado />
                <div className="grid gap-4 sm:grid-cols-2">
                  {camposCadastro.map((c) => (
                    <div key={c.key} className={c.wide ? "sm:col-span-2" : undefined}>
                      <Valor campo={c.valor} pendente={!c.ok} />
                    </div>
                  ))}
                </div>
              </dl>
              {/* o termo não é campo do form — a assinatura mora em /assinar;
                  a gaveta só anuncia o estado e manda pra lá */}
              <div className="mt-5 flex items-center gap-3 rounded-lg border border-border px-3.5 py-3">
                <Signature
                  size={18}
                  aria-hidden
                  className={
                    termoOk
                      ? "shrink-0 text-[var(--ok-text)]"
                      : "shrink-0 text-[var(--warn-text)]"
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Termo de Adesão ao Trabalho Voluntário
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {termoOk
                      ? `Assinado em ${new Date(assinaturaTermo!.assinado_em!).toLocaleDateString("pt-BR")}.`
                      : assinaturaTermo
                        ? "Emitido, aguardando sua assinatura."
                        : "Ainda não assinado. Vale pra toda a equipe."}
                  </p>
                </div>
                {termoOk ? (
                  <a
                    href={`/api/assinatura/${assinaturaTermo!.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    <FileArrowDown size={14} aria-hidden />
                    Ver PDF
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                ) : (
                  <Link
                    href="/assinar"
                    className="inline-flex min-h-9 shrink-0 items-center rounded-lg px-2 text-xs font-medium text-primary underline-offset-4 transition-colors hover:underline"
                  >
                    Ler e assinar
                  </Link>
                )}
              </div>
            </div>
          </details>

          {/* conta — senha e saída no mesmo card: credenciais são o mesmo
              assunto. Os forms reais ficam no fim da página; os campos e
              botões se ligam a eles pelo atributo form=, então validação e
              Enter seguem nativos */}
          <section className="rounded-xl bg-card shadow-[var(--shadow-border)]">
            <h2 className="px-6 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Conta
            </h2>
            {/* senha — disclosure sem card próprio dentro do card; reautentica
                antes do updateUser (senha atual ou sessão fresca do magic
                link); a flag senha_em é o que pula o onboarding */}
            <details className="group/senha">
              <summary className="mt-1 flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-6 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-medium">Senha</span>
                <CaretDown
                  size={15}
                  aria-hidden
                  className="ml-auto shrink-0 text-muted-foreground transition-transform group-open/senha:rotate-180"
                />
              </summary>
              <div className="space-y-4 px-6 pb-6 pt-2">
                {temSenha ? (
                  <div className="space-y-2">
                    <Label htmlFor="senha-atual">Senha atual</Label>
                    <Input
                      id="senha-atual"
                      form="form-senha"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Você entra pelo link de e-mail. Por segurança, a sessão
                    precisa ser recente pra criar uma senha.
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <Input
                    id="nova-senha"
                    form="form-senha"
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
                    form="form-senha"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                  />
                </div>
                <Button type="submit" form="form-senha" disabled={salvandoSenha}>
                  {salvandoSenha ? "Salvando…" : "Trocar senha"}
                </Button>
              </div>
            </details>
            {/* saída — o "Sair" morava no header do app; na conta da pessoa
                faz mais sentido junto das outras credenciais */}
            <div className="border-t border-border/60 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Sessão</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Encerra o acesso da sua conta neste dispositivo.
                  </p>
                </div>
                <Button
                  type="submit"
                  form="form-sair"
                  variant="outline"
                  size="sm"
                >
                  <SignOut size={15} aria-hidden />
                  Sair
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* forms reais da senha e do Sair — sem filhos, só existem pra receber
          o submit dos campos/botões ligados por form= lá no card Conta */}
      <form id="form-senha" onSubmit={salvarSenha} className="hidden" />
      <form id="form-sair" action={signOut} className="hidden" />
    </div>
  );
}
