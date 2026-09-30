"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Camera,
  ChartLineUp,
  Check,
  CircleNotch,
  ClipboardText,
  FolderOpen,
  HandHeart,
  Handshake,
  MapTrifold,
  Megaphone,
  NotePencil,
  TrafficSignal,
  UserPlus,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { concluirOnboarding, salvarOnboarding } from "@/lib/actions";
import { recomecarDemo } from "@/lib/demo/actions";
import { assinarTermo } from "@/lib/actions-assinaturas";
import { AREAS_SUGESTOES } from "@/lib/ciclo";
import { avatarPublicUrl, AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { AssinaturaForm } from "@/components/assinatura-form";
import { TagInput } from "@/components/tag-input";
import { TermoVoluntarioDoc } from "@/components/termo-doc";
import {
  CampoDisponibilidade,
  CampoGenero,
  CampoInteresses,
  CampoNascimento,
  CampoPrefGenero,
  CampoUf,
  SENTINEL_VAZIO,
} from "@/components/campos-pessoais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DadosPessoais } from "@/lib/queries";
import type {
  AppRole,
  Assinatura,
  DadosCivis,
  Disponibilidade,
  MentorProfile,
  Profile,
} from "@/lib/types";

/** Um form por passo — o botão do footer fixo submete via atributo `form`. */
const FORM_ID = "onboarding-passo";

type Recurso = { icon: Icon; texto: string };

/** "O que você pode fazer aqui" — os 4-5 pontos que mudam a rotina de cada papel. */
const RECURSOS: Record<AppRole, Recurso[]> = {
  coordenacao: [
    { icon: TrafficSignal, texto: "O andamento das duplas em tempo real: quem precisa de atenção aparece destacado." },
    { icon: HandHeart, texto: "Pedidos de apoio e de mentoria especializada chegam pra você." },
    { icon: UsersThree, texto: "Formar duplas e gerenciar os cadastros da equipe e dos mentorados." },
    { icon: Megaphone, texto: "Comunicados pra equipe e pra cada grupo de mentores." },
    { icon: ChartLineUp, texto: "Exportar relatórios do programa." },
  ],
  supervisor: [
    { icon: UsersThree, texto: "As duplas sob sua supervisão num lugar só." },
    { icon: NotePencil, texto: "Notas de acompanhamento na ficha de cada dupla." },
    { icon: TrafficSignal, texto: "O andamento de cada dupla: quem vai bem e quem precisa de atenção." },
    { icon: FolderOpen, texto: "Os materiais oficiais do programa." },
  ],
  mentor_dpp: [
    { icon: CalendarCheck, texto: "Agendar e registrar os encontros com a sua dupla." },
    { icon: MapTrifold, texto: "A jornada dos 16 encontros do guia, passo a passo." },
    { icon: HandHeart, texto: "Pedir apoio à coordenação quando precisar." },
    { icon: UserPlus, texto: "Solicitar um mentor especialista pro seu mentorado." },
    { icon: FolderOpen, texto: "Os materiais oficiais do programa." },
  ],
  mentor_especialista: [
    { icon: ClipboardText, texto: "Uma lista de pedidos que combinam com o seu perfil." },
    { icon: Handshake, texto: "Aceitar um pedido e conduzir até 5 encontros." },
    { icon: NotePencil, texto: "Registrar cada encontro realizado." },
    { icon: FolderOpen, texto: "Os materiais oficiais do programa." },
  ],
};

// índices dos passos por papel — o "Sobre você" virou 3 sub-passos
// (identidade, profissional, interesses/motivação/consentimento) porque 11
// campos num balão só era a parede que a galera pulava; mentores seguem
// pros passos de ficha/perfil (0034 + 0030) antes do fechamento. O termo de
// voluntariado (0033) entra penúltimo — sempre `total - 2` quando a
// assinatura ainda está pendente, pra qualquer papel
const PASSO_SOBRE = (ehMentor: boolean) => (ehMentor ? 6 : 2);
const SUBPASSOS_SOBRE = 3;
const PASSO_PAREAMENTO = 9;
const PASSO_DISPONIBILIDADE = 10;

/** Wizard de primeiro acesso — balão de pergunta por passo, salvando um pedaço
 *  do perfil por vez (salvarOnboarding com patch parcial: só o que o passo
 *  mandou é escrito). O gate mora no layout: onboarded_em null renderiza isto
 *  no lugar do shell. */
export function OnboardingFlow({
  me,
  pessoal,
  mentorProfile,
  civis,
  assinaturaTermo,
  demo,
}: {
  me: Profile;
  /** sensíveis do próprio cadastro (RPC self-scoped, 0048) — preenchem o
   *  passo "Sobre você" quando a importação da coordenação já os trouxe. */
  pessoal?: Pick<
    DadosPessoais,
    "data_nascimento" | "genero" | "pref_genero_par" | "motivacao"
  > | null;
  /** ficha de mentor (mentor_profiles é legível pelo dono) — preenche os
   *  passos de pareamento e disponibilidade. */
  mentorProfile?: MentorProfile | null;
  /** dados civis do próprio usuário (RPC self-scoped, 0046) — prefill do
   *  form do termo; null mostra o documento com blanks e o form vazio */
  civis?: DadosCivis | null;
  /** assinatura mais recente do termo de voluntariado — status "assinado"
   *  tira o passo do termo do wizard (não há o que reassinar) */
  assinaturaTermo?: Assinatura | null;
  /** pill da DemoBar dockada no header do wizard (demo ativa) — clicável em
   *  todos os passos sem cobrir campo nenhum */
  demo?: React.ReactNode;
}) {
  const router = useRouter();
  const ehMentor = me.role === "mentor_dpp" || me.role === "mentor_especialista";
  // passo do termo existe só enquanto a assinatura estiver pendente — e é
  // CONGELADO no mount: assinar no próprio wizard dispara router.refresh() e
  // a prop voltaria "assinado", encolhendo `total` com o usuário já sentado
  // no último passo
  const [temTermo] = useState(() => assinaturaTermo?.status !== "assinado");
  // coord/supervisor: boas-vindas + recursos + ficha pessoal em 3 sub-passos
  // + fechamento (6); mentores: + foto, apresentação, pareamento e
  // disponibilidade (12); termo pendente adiciona 1 passo pra todo papel
  const total = (ehMentor ? 12 : 6) + (temTermo ? 1 : 0);
  const [step, setStep] = useState(0);
  const [termoOk, setTermoOk] = useState(false);
  const [pending, start] = useTransition();
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // campos controlados — voltar um passo não pode perder o que foi digitado
  // (o step remonta no key={step} e o FormData é montado na hora de salvar)
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(
    me.avatar_path ? avatarPublicUrl(me.avatar_path) : null
  );
  const [bio, setBio] = useState(me.bio ?? "");
  const [areas, setAreas] = useState<string[]>(me.areas ?? []);
  const [linkedin, setLinkedin] = useState(me.linkedin ?? "");
  const [voluntariado, setVoluntariado] = useState(me.voluntariado ?? "");

  // ficha pessoal (0034) — os sensíveis chegam por `pessoal` (RPC self-
  // scoped 0048): se a importação da coordenação já os trouxe, vêm
  // preenchidos e a pessoa só confere
  const [nomeSocial, setNomeSocial] = useState(me.nome_social ?? "");
  const [nascimento, setNascimento] = useState(pessoal?.data_nascimento ?? "");
  const [genero, setGenero] = useState(pessoal?.genero ?? "");
  const [cidade, setCidade] = useState(me.cidade ?? "");
  const [uf, setUf] = useState(me.uf ?? "");
  const [cargo, setCargo] = useState(me.cargo ?? "");
  const [empresa, setEmpresa] = useState(me.empresa ?? "");
  const [origem, setOrigem] = useState(me.origem ?? "");
  const [interesses, setInteresses] = useState<string[]>(me.interesses ?? []);
  const [motivacao, setMotivacao] = useState(pessoal?.motivacao ?? "");
  const [consent, setConsent] = useState(false);

  // ficha de mentor (0034) — pareamento + grade semanal, já preenchidos se
  // a coordenação importou (mentor_profiles é legível pelo dono)
  const [prefGenero, setPrefGenero] = useState(pessoal?.pref_genero_par ?? "");
  const [experiencia, setExperiencia] = useState(mentorProfile?.experiencia_previa ?? "");
  const [formacao, setFormacao] = useState(mentorProfile?.formacao_externa ?? "");
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(
    mentorProfile?.disponibilidade ?? null
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const objUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (objUrl.current) URL.revokeObjectURL(objUrl.current);
    },
    []
  );

  // foco no título do balão a cada passo — o botão que disparou a navegação
  // segue montado (footer fixo), então sem isso o foco não acompanharia a
  // "pergunta" nova (mesmo padrão das etapas do importar-csv)
  useEffect(() => {
    tituloRef.current?.focus();
  }, [step]);

  const primeiroNome = me.nome.trim().split(/\s+/)[0] || me.nome;
  const ultimo = step === total - 1;
  // passos de ficha/perfil são opcionais — ganham o ghost "Agora não" e a
  // saída "Pular tudo e começar"; faixa contínua do primeiro passo de ficha
  // até a disponibilidade (mentor) ou o fim dos sub-passos (coord/superv.)
  const passoSobre = PASSO_SOBRE(ehMentor);
  const ultimoComCampos = ehMentor
    ? PASSO_DISPONIBILIDADE
    : passoSobre + SUBPASSOS_SOBRE - 1;
  const passoComCampos = step >= 2 && step <= ultimoComCampos;
  // o termo é penúltimo (antes do "Tudo certo") e fica FORA do <form>
  // compartilhado: o AssinaturaForm tem form e submit próprios. -1 quando a
  // assinatura já existe (assinado) — o passo some do wizard inteiro
  const passoTermo = temTermo ? total - 2 : -1;
  const ehPassoTermo = step === passoTermo;

  function avancar() {
    setStep((s) => Math.min(s + 1, total - 1));
  }

  function salvarPasso(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // o input file perde a seleção quando o passo remonta — o state é a fonte
    if (foto) fd.set("foto", foto);
    start(async () => {
      try {
        const res = await salvarOnboarding(fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        if (res.aviso) toast.warning(res.aviso);
        avancar();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function concluir() {
    start(async () => {
      try {
        const res = await concluirOnboarding();
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        // o layout relê getMe — onboarded_em setado devolve o shell do app
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // limpa o input: escolher o mesmo arquivo de novo dispara onChange outra vez
    e.target.value = "";
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      toast.error("A foto não entrou: use PNG, JPG ou WebP.");
      return;
    }
    if (f.size > AVATAR_MAX_BYTES) {
      toast.error("Imagem grande demais: use uma de até 2 MB.");
      return;
    }
    if (objUrl.current) URL.revokeObjectURL(objUrl.current);
    objUrl.current = URL.createObjectURL(f);
    setFoto(f);
    setFotoUrl(objUrl.current);
  }

  /** "Sobre você" em 3 sub-passos (0034) — a ficha pessoal que alimenta o
   *  cadastro e o matching, fatiada por assunto: identidade, profissional,
   *  interesses/motivação/consentimento. Os sensíveis voltam preenchidos
   *  via `pessoal` (self-scoped); depois do cadastro, fora da coordenação
   *  ninguém mais os lê. Cada sub-passo salva seu pedaço (patch parcial). */
  const passoSobreIdentidade = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ob-social">Nome social</Label>
          <Input
            id="ob-social"
            name="nome_social"
            maxLength={150}
            autoCapitalize="words"
            value={nomeSocial}
            onChange={(e) => setNomeSocial(e.target.value)}
            placeholder="Como você prefere ser chamado(a)"
          />
        </div>
        <CampoNascimento id="ob-nasc" value={nascimento} onChange={setNascimento} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoGenero
          value={genero}
          onChange={(v) => setGenero(v === SENTINEL_VAZIO ? "" : v)}
        />
        <div className="space-y-2">
          <Label htmlFor="ob-cidade">Cidade</Label>
          <Input
            id="ob-cidade"
            name="cidade"
            maxLength={100}
            autoCapitalize="words"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
          />
        </div>
      </div>
      <CampoUf
        value={uf}
        onChange={(v) => setUf(v === SENTINEL_VAZIO ? "" : v)}
      />
    </div>
  );

  const passoSobreProfissional = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ob-cargo">Cargo</Label>
          <Input
            id="ob-cargo"
            name="cargo"
            maxLength={120}
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-empresa">Empresa</Label>
          <Input
            id="ob-empresa"
            name="empresa"
            maxLength={150}
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ob-origem">Como você chegou ao programa</Label>
        <Input
          id="ob-origem"
          name="origem"
          maxLength={300}
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          placeholder="Indicação, ONG parceira, rede social…"
        />
      </div>
    </div>
  );

  const passoSobreMotivacao = (
    <div className="space-y-4">
      <CampoInteresses value={interesses} onChange={setInteresses} />
      <div className="space-y-2">
        <Label htmlFor="ob-motivacao">O que te traz ao programa</Label>
        <Textarea
          id="ob-motivacao"
          name="motivacao"
          rows={3}
          maxLength={2000}
          value={motivacao}
          onChange={(e) => setMotivacao(e.target.value)}
          placeholder="Sua motivação pra participar da mentoria"
        />
      </div>
      {/* consent_lgpd → consentPatch grava o carimbo; unchecked não manda
          a chave e não apaga um carimbo já existente */}
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          name="consent_lgpd"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>
          Autorizo o uso dos meus dados do cadastro no programa (LGPD).
        </span>
      </label>
    </div>
  );

  const PASSOS_SOBRE = [passoSobreIdentidade, passoSobreProfissional, passoSobreMotivacao];

  /** Passo "Pareamento" (mentor, 0034) — o que ajuda a coordenação a escolher
   *  a dupla: preferência de gênero do par + a bagagem que entra na ficha. */
  const passoPareamento = (
    <div className="space-y-4">
      <CampoPrefGenero
        value={prefGenero}
        onChange={(v) => setPrefGenero(v === SENTINEL_VAZIO ? "" : v)}
      />
      <div className="space-y-2">
        <Label htmlFor="ob-exp">Experiência prévia como mentor</Label>
        <Textarea
          id="ob-exp"
          name="experiencia_previa"
          rows={3}
          maxLength={2000}
          value={experiencia}
          onChange={(e) => setExperiencia(e.target.value)}
          placeholder="Mentorias anteriores, mediação, ensino…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ob-form">Formação e certificações</Label>
        <Textarea
          id="ob-form"
          name="formacao_externa"
          rows={3}
          maxLength={2000}
          value={formacao}
          onChange={(e) => setFormacao(e.target.value)}
          placeholder="Cursos e certificações relevantes pra mentoria"
        />
      </div>
    </div>
  );

  /** Passo "Disponibilidade" (mentor, 0034) — a grade semanal que entra no
   *  cruzamento de agenda do matching. */
  const passoDisponibilidade = (
    <CampoDisponibilidade value={disponibilidade} onChange={setDisponibilidade} />
  );

  const titulo = (() => {
    if (step === passoSobre) return "Sobre você: quem você é";
    if (step === passoSobre + 1) return "Sobre você: seu trabalho";
    if (step === passoSobre + 2) return "Sobre você: o que te move";
    if (ehMentor && step === PASSO_PAREAMENTO) return "O que ajuda a formar sua dupla";
    if (ehMentor && step === PASSO_DISPONIBILIDADE) return "Quando você pode encontrar sua dupla";
    if (ehPassoTermo) return "Termo de adesão ao trabalho voluntário";
    switch (step) {
      case 0:
        return `Bem-vindo(a) ao Realiza.vc, ${primeiroNome}!`;
      case 1:
        return "O que você pode fazer aqui";
      case 2:
        return "Uma foto ajuda as pessoas a te reconhecer";
      case 3:
        return "Conte sua trajetória em poucas linhas";
      case 4:
        return "No que você pode ajudar?";
      case 5:
        // case 5 é passo de mentor — pra coord/supervisor o índice 5 é o
        // fechamento ("Tudo certo"), não os campos de LinkedIn
        return ehMentor ? "Pra fechar: LinkedIn e voluntariado" : `Tudo certo, ${primeiroNome}!`;
      default:
        return `Tudo certo, ${primeiroNome}!`;
    }
  })();

  const hint = (() => {
    if (step === passoSobre)
      return "Como você se apresenta e onde vive. Nascimento e gênero ficam visíveis só pra coordenação.";
    if (step === passoSobre + 1)
      return "Cargo, empresa e como você chegou: contexto rápido pra equipe te conhecer.";
    if (step === passoSobre + 2)
      return "Interesses e motivação alimentam o matching e ficam só com a coordenação. O consentimento fecha a ficha.";
    if (ehMentor && step === PASSO_PAREAMENTO)
      return "A coordenação usa isso pra escolher a dupla: tudo opcional, dá pra completar depois no Perfil.";
    if (ehMentor && step === PASSO_DISPONIBILIDADE)
      return "Toque nos dias e períodos em que você costuma ter agenda livre. A coordenação cruza com a do mentorado.";
    if (ehPassoTermo)
      return demo
        ? "O documento que formaliza o voluntariado de toda a equipe no programa. Na demonstração ele é só leitura."
        : "O documento que formaliza o voluntariado de toda a equipe no programa, com a mesma validade de uma assinatura em papel. Leia e, se quiser, já assine; dá pra deixar pra depois também.";
    switch (step) {
      case 0:
        return "A plataforma do Programa de Mentoria Social: a jornada da sua dupla, os registros e os materiais oficiais num lugar só.";
      case 1:
        return "O essencial da sua rotina no programa cabe nesta tela.";
      case 2:
        return "PNG, JPG ou WebP até 2 MB. Aparece no seu perfil e nas duplas.";
      case 3:
        return "O que você faz, o que estudou, o que te trouxe ao programa. Aparece no seu perfil pra equipe e pros mentorados.";
      case 4:
        return "Toque pra selecionar ou digite uma nova. Dá pra mudar depois no seu perfil.";
      case 5:
        return ehMentor
          ? "Os dois são opcionais e ajudam a equipe e os mentorados a te conhecerem melhor."
          : "Seu perfil já está visível pra equipe. Dá pra completar ou mudar tudo depois em Perfil.";
      default:
        return "Seu perfil já está visível pra equipe. Dá pra completar ou mudar tudo depois em Perfil.";
    }
  })();

  // fechamento: quem pulou o termo sai do wizard com o lembrete de onde ele
  // fica — pendência permanece (ausência de row), resolvida pelo banner da
  // home, pela linha do /perfil ou direto em /assinar
  const corpoFechamento =
    temTermo && !termoOk ? (
      <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Falta só o termo de adesão ao voluntariado: assine quando puder pelo
        banner da sua home ou em{" "}
        <Link
          href="/assinar"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Assinar
        </Link>
        .
      </p>
    ) : null;

  const corpo = (() => {
    if (step >= passoSobre && step < passoSobre + SUBPASSOS_SOBRE)
      return PASSOS_SOBRE[step - passoSobre];
    if (ehMentor && step === PASSO_PAREAMENTO) return passoPareamento;
    if (ehMentor && step === PASSO_DISPONIBILIDADE) return passoDisponibilidade;
    // o termo tem form próprio (AssinaturaForm) — intercepta antes do switch
    // porque o índice colide com o case 5 (linkedin) pra coord/supervisor
    if (ehPassoTermo) {
      // demo: só leitura — botão de assinar que sempre falha é má UX
      if (demo) {
        return (
          <div className="space-y-4">
            <TermoVoluntarioDoc civis={civis} />
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              Na demonstração a assinatura não é gravada. No cadastro real é
              aqui que você confere os dados civis e assina.
            </p>
          </div>
        );
      }
      return (
        <div className="space-y-4">
          <TermoVoluntarioDoc
            civis={civis}
            continuar={{
              href: "#ob-termo-dados",
              rotulo: "Continuar para seus dados ↓",
            }}
          />
          <div id="ob-termo-dados" className="scroll-mt-24 space-y-2">
            <h2 className="text-base font-semibold">Seus dados para assinar</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {civis
                ? "Já temos seus dados do cadastro: confira, corrija se preciso e assine."
                : "Pra assinar precisamos dos seus dados civis: preencha como no documento de identidade. Eles entram no termo exatamente como digitados."}
            </p>
          </div>
          <AssinaturaForm
            modo="termo"
            acao={assinarTermo}
            dados={civis}
            onSucesso={() => {
              setTermoOk(true);
              avancar();
            }}
          />
        </div>
      );
    }
    switch (step) {
      case 1:
        return (
          <ul className="space-y-2">
            {RECURSOS[me.role ?? "mentor_dpp"].map((r) => (
              <li
                key={r.texto}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
                  <r.icon size={18} weight="fill" aria-hidden />
                </span>
                <span className="text-sm leading-snug">{r.texto}</span>
              </li>
            ))}
          </ul>
        );
      case 2:
        return (
          <div className="flex flex-col items-center gap-3 py-1">
            <span className="grid size-24 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground ring-1 ring-border">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera size={26} aria-hidden />
              )}
            </span>
            {/* fora da tab order — o botão é o controle (ref.click), igual ao
                FotoField dos cadastros */}
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={escolherFoto}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={15} aria-hidden />
              {fotoUrl ? "Trocar foto" : "Escolher foto"}
            </Button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="ob-bio">Biografia</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {bio.length}/1.000
              </span>
            </div>
            <Textarea
              id="ob-bio"
              name="bio"
              rows={5}
              maxLength={1000}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="O que você faz, o que estudou, o que te trouxe ao programa."
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-2">
            {/* rótulo de grupo, não de controle — o input livre do TagInput
                tem aria-label próprio, então <p> em vez de <Label> órfão */}
            <p className="text-sm font-medium">Áreas de atuação</p>
            <TagInput
              name="areas"
              sugestoes={AREAS_SUGESTOES}
              value={areas}
              onChange={setAreas}
              inputLabel="Digite uma área e pressione Enter"
            />
          </div>
        );
      case 5:
        // passo de mentor — pra coord/supervisor o índice 5 já é o
        // fechamento; cair aqui renderizaria campos fora do <form>
        if (!ehMentor) return corpoFechamento;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ob-linkedin">LinkedIn</Label>
              <Input
                id="ob-linkedin"
                name="linkedin"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ob-voluntariado">Experiência com voluntariado</Label>
                <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                  {voluntariado.length}/300
                </span>
              </div>
              <Input
                id="ob-voluntariado"
                name="voluntariado"
                maxLength={300}
                value={voluntariado}
                onChange={(e) => setVoluntariado(e.target.value)}
                placeholder="ex.: 2 anos como voluntário no Projeto X"
              />
            </div>
          </div>
        );
      default:
        return corpoFechamento;
    }
  })();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* header fixo: voltar circular + progresso + contador (+ pill demo);
          pt safe-area tira o header de sob o notch em standalone */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-3 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <button
            type="button"
            onClick={() => {
              // demo no passo 0: voltar sai da demo e devolve a seleção de
              // papel — troca de visão sem precisar abrir a pill
              if (step === 0) {
                start(async () => {
                  await recomecarDemo();
                });
                return;
              }
              setStep((s) => s - 1);
            }}
            disabled={(step === 0 && !demo) || pending}
            aria-label={
              step === 0 && demo ? "Escolher outro papel" : "Voltar um passo"
            }
            title={step === 0 && demo ? "Escolher outro papel" : undefined}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 md:size-9"
          >
            {/* pending no passo 0 só pode ser o recomecarDemo — spinner enquanto sai */}
            {pending && step === 0 ? (
              <CircleNotch size={17} className="animate-spin" aria-hidden />
            ) : (
              <ArrowLeft size={17} aria-hidden />
            )}
          </button>
          <div
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-label={`Passo ${step + 1} de ${total}`}
            className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-[var(--brand-lime)] transition-all duration-500"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {step + 1}/{total}
          </span>
          {demo}
        </div>
      </header>

      {/* coluna central — pb/pt compensam header e footer fixos */}
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col justify-center px-4 pb-32 pt-20 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-realiza.png" alt="Realiza.vc" className="mb-6 h-5 w-auto self-start" />
        <div key={step} className="animate-rise">
          <div className="rounded-3xl rounded-bl-md border border-border bg-card px-5 py-4">
            <h1
              ref={tituloRef}
              tabIndex={-1}
              className="text-xl font-semibold leading-snug outline-none"
            >
              {titulo}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
          </div>
          {passoComCampos ? (
            <form id={FORM_ID} onSubmit={salvarPasso} className="mt-5">
              {corpo}
            </form>
          ) : (
            corpo && <div className="mt-5">{corpo}</div>
          )}
        </div>
      </main>

      {/* footer fixo: "Agora não" nos passos opcionais + primário */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          {(passoComCampos || ehPassoTermo) && (
            <div className="flex shrink-0 flex-col items-start">
              {/* no termo o ghost é "Assinar depois": avança sem gravar —
                  a pendência segue como ausência de assinatura. Na demo o
                  Continuar primário já cobre o pulo, sem ghost duplicado */}
              {(passoComCampos || !demo) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={avancar}
                  disabled={pending}
                >
                  {ehPassoTermo ? "Assinar depois" : "Agora não"}
                </Button>
              )}
              {/* saída honesta pros passos opcionais acumulados: conclui o
                  onboarding direto (mesmo concluirOnboarding do último
                  passo) — a ficha pode ser completada depois no Perfil */}
              <button
                type="button"
                onClick={concluir}
                disabled={pending}
                className="min-h-9 px-4 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
              >
                Pular tudo e começar
              </button>
            </div>
          )}
          {/* sempre type=button + requestSubmit explícito: um botão que vira
              submit no MESMO clique dispara o form do passo seguinte — o
              default action do clique é avaliado depois do re-render, então
              "Continuar" avançava 2 passos (pulava a foto).
              No passo do termo o primário some: o submit mora dentro do
              AssinaturaForm e um "Continuar" ao lado de "Assinar depois"
              seria ambíguo; na demo (só leitura) ele volta */}
          {(!ehPassoTermo || demo) && (
            <Button
              type="button"
              onClick={() => {
                if (passoComCampos) {
                  (
                    document.getElementById(FORM_ID) as HTMLFormElement | null
                  )?.requestSubmit();
                } else if (ultimo) {
                  concluir();
                } else {
                  avancar();
                }
              }}
              disabled={pending}
              className="h-11 flex-1 font-semibold"
            >
              {pending
                ? ultimo || ehPassoTermo
                  ? "Entrando…"
                  : "Salvando…"
                : ultimo
                  ? "Começar"
                  : "Continuar"}
              {!pending && (ultimo ? <Check weight="bold" aria-hidden /> : <ArrowRight aria-hidden />)}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
