"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AddressBook,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Buildings,
  Cake,
  CalendarCheck,
  Camera,
  ChartLineUp,
  Check,
  CircleNotch,
  ClipboardText,
  Flag,
  FolderOpen,
  GenderIntersex,
  GraduationCap,
  HandHeart,
  Handshake,
  Heart,
  ImageSquare,
  LinkedinLogo,
  ListChecks,
  MapPin,
  MapTrifold,
  Medal,
  Megaphone,
  NotePencil,
  PencilLine,
  SealCheck,
  ShieldCheck,
  Signpost,
  Tag,
  ThumbsUp,
  TrafficSignal,
  User,
  UserPlus,
  Users,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { concluirOnboarding, salvarOnboarding } from "@/lib/actions";
import { recomecarDemo } from "@/lib/demo/actions";
import { assinarTermoDemo } from "@/lib/demo/shared";
import { assinarTermo } from "@/lib/actions-assinaturas";
import { AREAS_SUGESTOES, GENERO_LABELS } from "@/lib/ciclo";
import {
  avatarPublicUrl,
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  avisoImagemGrande,
} from "@/lib/avatar";
import { AssinaturaForm } from "@/components/assinatura-form";
import { CaixaSelecao } from "@/components/ui/caixa-selecao";
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
import { temPapel } from "@/lib/types";
import type {
  AppRole,
  Assinatura,
  DadosCivis,
  Disponibilidade,
  MentorProfile,
  Profile,
} from "@/lib/types";
import { Logo } from "@/components/logo";
import { LizaBlob } from "@/components/liza/liza-blob";
import { cn } from "cn";

/** Um form por passo — o botão do footer fixo submete via atributo `form`. */
const FORM_ID = "onboarding-passo";

type Recurso = {
  icon: Icon;
  texto: string;
  /** nome-base do print em public/onboarding (scripts/capturar-onboarding.mjs):
   *  `<img>.webp` é a coluna de conteúdo no desktop, `<img>-m.webp` a tela do
   *  celular. Sem img o item fica só como texto (o mentorado não passa aqui) */
  img?: string;
  alt?: string;
};

/** "O que você pode fazer aqui" — os pontos que mudam a rotina de cada papel,
 *  cada um com a tela real onde ele acontece. */
const RECURSOS: Record<AppRole, Recurso[]> = {
  coordenacao: [
    { icon: TrafficSignal, texto: "Andamento das duplas", img: "coordenacao-home", alt: "Visão geral da coordenação: turmas, situação das duplas e o que precisa de você hoje" },
    { icon: HandHeart, texto: "Pedidos de apoio", img: "coordenacao-dupla", alt: "Ficha de uma dupla em risco com apoio aberto e especialista solicitado" },
    { icon: UsersThree, texto: "Formar e acompanhar duplas", img: "coordenacao-duplas", alt: "Lista de duplas com situação, motivo e encontros" },
    { icon: AddressBook, texto: "Pessoas e cadastros", img: "coordenacao-pessoas", alt: "Lista de pessoas com papéis, filtros e cadastros" },
    { icon: Megaphone, texto: "Comunicados", img: "coordenacao-comunicados", alt: "Avisos publicados para a equipe e para os mentores, com botão de novo aviso" },
    { icon: ChartLineUp, texto: "Relatórios", img: "coordenacao-relatorios", alt: "Construtor de relatórios com filtros de turma, linhas e colunas e exportação em CSV" },
  ],
  supervisor: [
    { icon: UsersThree, texto: "Minhas duplas", img: "supervisor-duplas", alt: "Lista das duplas supervisionadas com a situação de cada uma" },
    { icon: NotePencil, texto: "Notas de acompanhamento", img: "supervisor-dupla", alt: "Ficha de uma dupla com a jornada e o próximo encontro" },
    { icon: TrafficSignal, texto: "Situação das duplas", img: "supervisor-home", alt: "Visão geral do supervisor com a situação das duplas" },
    { icon: FolderOpen, texto: "Materiais de apoio", img: "supervisor-materiais", alt: "Instrumentos do programa com respostas por dupla" },
  ],
  mentor_dpp: [
    { icon: CalendarCheck, texto: "Agendar e registrar encontros", img: "mentor_dpp-dupla", alt: "Ficha da dupla com o próximo encontro e o botão de remarcar" },
    { icon: Users, texto: "Minhas duplas", img: "mentor_dpp-duplas", alt: "Lista das suas duplas com o próximo passo de cada uma" },
    { icon: MapTrifold, texto: "Jornada dos encontros", img: "mentor_dpp-home", alt: "Visão geral do mentor com a jornada dos encontros" },
    { icon: HandHeart, texto: "Pedir apoio", img: "mentor_dpp-apoio", alt: "Meus chamados: pedidos de apoio à coordenação e o andamento de cada um" },
    { icon: UserPlus, texto: "Mentor especialista", img: "mentor_dpp-especialista", alt: "Agenda por mentorado com o pedido de especialista em andamento" },
    { icon: FolderOpen, texto: "Materiais de apoio", img: "mentor_dpp-materiais", alt: "Materiais de apoio do encontro desta semana" },
  ],
  mentor_especialista: [
    { icon: ClipboardText, texto: "Pedidos de mentoria", img: "mentor_especialista-home", alt: "Mural de pedidos de mentoria especializada com filtros por tema" },
    { icon: Handshake, texto: "Trilha de encontros", img: "mentor_especialista-trilha", alt: "Ficha da trilha de especialista com a jornada de 5 encontros" },
    { icon: NotePencil, texto: "Registrar encontros", img: "mentor_especialista-registro", alt: "Encontros da trilha com o botão de registrar" },
    { icon: FolderOpen, texto: "Materiais de apoio", img: "mentor_especialista-materiais", alt: "Materiais de apoio da mentoria especializada" },
  ],
  // o jovem não passa por este wizard (o dele é o OnboardingJovem do
  // /jovem, REALIZA-114) — a entrada existe porque o Record pede todos os
  // papéis e as demos/queries compartilham a lista
  mentorado: [
    { icon: CalendarCheck, texto: "Sua agenda de encontros com o mentor." },
    { icon: ListChecks, texto: "Os combinados que ficaram pra você." },
    { icon: FolderOpen, texto: "Os materiais de apoio do programa." },
  ],
};

const printDesktop = (img: string) => `/onboarding/${img}.webp`;
const printMobile = (img: string) => `/onboarding/${img}-m.webp`;

/** 1px transparent gif — <img> fallback when the <source media> doesn't
 *  match, so the other breakpoint downloads zero bytes (see PrintShot). */
const PIXEL_VAZIO =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Screen print pinned to one breakpoint: the <source media> only supplies
 *  the file where it actually renders — elsewhere the <img> falls back to
 *  the empty pixel and never hits the network. Plain <img> (no next/image):
 *  the files are captured at the exact display size, and the old `priority`
 *  eagerly fetched the ~100KB DESKTOP print inside a `hidden` figure on
 *  mobile (and the mobile one on desktop). eager/high on the active shot is
 *  now safe — on the wrong breakpoint it resolves to the pixel, not bytes. */
function PrintShot({
  src,
  media,
  ativo,
  alt,
}: {
  src: string;
  /** media query of the breakpoint that uses this print */
  media: string;
  ativo: boolean;
  alt: string;
}) {
  return (
    <picture className="contents">
      <source media={media} srcSet={src} />
      <img
        src={PIXEL_VAZIO}
        alt={alt}
        loading={ativo ? "eager" : "lazy"}
        fetchPriority={ativo ? "high" : "auto"}
        className={cn(
          "absolute inset-0 size-full object-cover object-top transition-opacity duration-300",
          ativo ? "opacity-100" : "opacity-0"
        )}
      />
    </picture>
  );
}

// índices dos passos por papel — as declarações (voluntário + LGPD) abrem o
// fluxo pra garantir o consent antes de qualquer dado pedido; o "Sobre você"
// virou 3 sub-passos (identidade, profissional, interesses/motivação) porque
// 11 campos num balão só era a parede que a galera pulava; mentores seguem
// pros passos de ficha/perfil (0034 + 0030) antes do fechamento. O termo de
// voluntariado (0033) entra penúltimo — sempre `total - 2` quando a
// assinatura ainda está pendente e a pessoa se declarou voluntária, pra
// qualquer papel
const PASSO_DECLARACOES = 1;
const PASSO_SOBRE = (ehMentor: boolean) => (ehMentor ? 7 : 3);
const SUBPASSOS_SOBRE = 3;
const PASSO_PAREAMENTO = 10;
const PASSO_DISPONIBILIDADE = 11;

/** Moldura de "janela de navegador" pros prints de tela reais — os três
 *  pontinhos vendem "isso é o produto de verdade" sem custar copy. */
function MolduraTela({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-border",
        className
      )}
    >
      <div
        aria-hidden
        className="flex items-center gap-1.5 border-b border-border/60 bg-muted/60 px-3 py-2"
      >
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
      </div>
      {children}
    </div>
  );
}

/** Label com micro-ícone do assunto — no primeiro acesso o ícone ancora o
 *  campo antes da leitura (os forms densos do app seguem com label puro). */
function Rotulo({
  htmlFor,
  icon: Icone,
  children,
}: {
  htmlFor?: string;
  icon: Icon;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
      <Icone size={15} className="text-muted-foreground" aria-hidden />
      {children}
    </Label>
  );
}

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
  const ehMentor =
    temPapel(me, "mentor_dpp") || temPapel(me, "mentor_especialista");
  // a declaração do passo 1 (não a prop) decide se o termo existe no fim:
  // desmarcar "Sou voluntário(a)" ali encolhe o wizard na hora e o termo
  // nunca renderiza — o freeze que existia era contra o router.refresh()
  // pós-assinatura mexendo na prop, e estado local não sofre com refresh
  const [souVoluntario, setSouVoluntario] = useState(me.voluntario !== false);
  const temTermo = assinaturaTermo?.status !== "assinado" && souVoluntario;
  // coord/supervisor: boas-vindas + declarações + recursos + ficha pessoal
  // em 3 sub-passos + fechamento (7); mentores: + foto, apresentação,
  // pareamento e disponibilidade (13); termo pendente adiciona 1 passo
  const total = (ehMentor ? 13 : 7) + (temTermo ? 1 : 0);
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
  // feature whose screen illustrates the "what you can do" step — hover,
  // focus or tap on a row swaps the shot (last gesture wins); on mobile the
  // frame pins under the header so the tap feedback stays in view
  const [recursoAtivo, setRecursoAtivo] = useState(() =>
    Math.max(0, RECURSOS[me.role ?? "mentor_dpp"].findIndex((r) => r.img))
  );
  // sub-passos do "Sobre você" colapsam quando a importação da coordenação já
  // preencheu — "Corrigir" expande o form de volta pra editar
  const [editarSobre, setEditarSobre] = useState<Record<number, boolean>>({});

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
    // voltar ao topo antes do foco — sem isso um passo novo pode abrir já
    // rolado (ex.: saindo do termo com a página no fim)
    window.scrollTo(0, 0);
    tituloRef.current?.focus();
  }, [step]);

  const primeiroNome = me.nome.trim().split(/\s+/)[0] || me.nome;
  const ultimo = step === total - 1;
  // passos de ficha/perfil são opcionais — ganham o ghost "Pular etapa" e a
  // saída "Pular tudo"; faixa contínua do primeiro passo de ficha
  // até a disponibilidade (mentor) ou o fim dos sub-passos (coord/superv.)
  const passoSobre = PASSO_SOBRE(ehMentor);
  const ultimoComCampos = ehMentor
    ? PASSO_DISPONIBILIDADE
    : passoSobre + SUBPASSOS_SOBRE - 1;
  const passoComCampos = step >= 3 && step <= ultimoComCampos;
  // o termo é penúltimo (antes do "Tudo certo") e fica FORA do <form>
  // compartilhado: o AssinaturaForm tem form e submit próprios. -1 quando a
  // assinatura já existe (assinado) — o passo some do wizard inteiro
  const passoTermo = temTermo ? total - 2 : -1;
  const ehPassoTermo = step === passoTermo;

  function avancar() {
    setStep((s) => Math.min(s + 1, total - 1));
  }

  /** "Pular etapa" com campo preenchido: o que a pessoa digitou é dela —
   *  se o passo tem dado, submete (salva e avança); vazio, só avança. */
  function pularEtapa() {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return avancar();
    const fd = new FormData(form);
    // a foto mora fora do FormData (state) e só conta no passo dela —
    // contar sempre reenviaria o arquivo a cada pulo seguinte
    const temDado =
      (!!foto && step === 3) ||
      [...fd.entries()].some(([, v]) => {
        if (typeof v !== "string") return false;
        const val = v.trim();
        return (
          val !== "" &&
          val !== SENTINEL_VAZIO &&
          val !== "[]" &&
          val !== '{"celulas":[]}'
        );
      });
    if (temDado) form.requestSubmit();
    else avancar();
  }

  /** Passo "Declarações": o LGPD é o único gate do wizard (sem consent não
   *  dá pra tratar os dados que os próximos passos pedem); a flag de
   *  voluntário decide se o termo aparece no fim. Tudo salva num post só. */
  function avancarDasDeclaracoes() {
    if (!consent && !me.consent_lgpd_em) {
      toast.error("Marque a caixa \"Autorizo o uso dos meus dados\" pra continuar.");
      return;
    }
    const fd = new FormData();
    fd.set("decl_voluntario", "1");
    if (souVoluntario) fd.set("voluntario", "on");
    if (consent) fd.set("consent_lgpd", "on");
    start(async () => {
      const res = await salvarOnboarding(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      avancar();
    });
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
      toast.error(avisoImagemGrande(f.size));
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
          <Rotulo htmlFor="ob-social" icon={User}>Nome social</Rotulo>
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
        <CampoNascimento id="ob-nasc" value={nascimento} onChange={setNascimento} icon={Cake} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoGenero
          value={genero}
          onChange={(v) => setGenero(v === SENTINEL_VAZIO ? "" : v)}
          icon={GenderIntersex}
        />
        {/* cidade + UF na mesma linha: um conceito só (onde) e o select de
            2 letras não precisa de uma linha inteira */}
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
          <div className="space-y-2">
            <Rotulo htmlFor="ob-cidade" icon={MapPin}>Cidade</Rotulo>
            <Input
              id="ob-cidade"
              name="cidade"
              maxLength={100}
              autoCapitalize="words"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
            />
          </div>
          <CampoUf
            value={uf}
            onChange={(v) => setUf(v === SENTINEL_VAZIO ? "" : v)}
            icon={Flag}
          />
        </div>
      </div>
    </div>
  );

  const passoSobreProfissional = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Rotulo htmlFor="ob-cargo" icon={Briefcase}>Cargo</Rotulo>
          <Input
            id="ob-cargo"
            name="cargo"
            maxLength={120}
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Rotulo htmlFor="ob-empresa" icon={Buildings}>Empresa</Rotulo>
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
        <Rotulo htmlFor="ob-origem" icon={Signpost}>Como você chegou ao programa</Rotulo>
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
      <CampoInteresses value={interesses} onChange={setInteresses} icon={ThumbsUp} />
      <div className="space-y-2">
        <Rotulo htmlFor="ob-motivacao" icon={Heart}>O que te traz ao programa</Rotulo>
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
    </div>
  );

  const PASSOS_SOBRE = [passoSobreIdentidade, passoSobreProfissional, passoSobreMotivacao];

  // sub-passos burocráticos já preenchidos pela importação da coordenação
  // viram resumo compacto com "Corrigir" — "o que te move" fica sempre
  // aberto porque interesses/motivação são o dado que alimenta o matching
  const sobrePreenchido = [
    !!(nascimento && genero && cidade && uf),
    !!(cargo && empresa),
    false,
  ];
  const resumoItensSobre: [string, string][][] = [
    [
      ["Nome social", nomeSocial],
      [
        "Nascimento",
        nascimento
          ? new Date(nascimento + "T00:00:00").toLocaleDateString("pt-BR")
          : "",
      ],
      ["Gênero", GENERO_LABELS[genero as keyof typeof GENERO_LABELS] ?? genero],
      ["Cidade", [cidade, uf].filter(Boolean).join("/")],
    ],
    [
      ["Cargo", cargo],
      ["Empresa", empresa],
      ["Como chegou", origem],
    ],
    [],
  ];
  const resumoSobre = (sub: number) => (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ClipboardText size={15} className="text-muted-foreground" aria-hidden />
          Já temos esses dados do cadastro
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditarSobre((s) => ({ ...s, [sub]: true }))}
        >
          Editar
        </Button>
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {resumoItensSobre[sub]
          .filter(([, v]) => v)
          .map(([rotulo, valor]) => (
            <div key={rotulo} className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {rotulo}
              </dt>
              <dd className="truncate text-sm" title={valor}>{valor}</dd>
            </div>
          ))}
      </dl>
    </div>
  );

  /** Passo "Pareamento" (mentor, 0034) — o que ajuda a coordenação a escolher
   *  a dupla: preferência de gênero do par + a bagagem que entra na ficha. */
  const passoPareamento = (
    <div className="space-y-4">
      <CampoPrefGenero
        value={prefGenero}
        onChange={(v) => setPrefGenero(v === SENTINEL_VAZIO ? "" : v)}
        icon={Users}
      />
      <div className="space-y-2">
        <Rotulo htmlFor="ob-exp" icon={Medal}>Experiência prévia como mentor</Rotulo>
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
        <Rotulo htmlFor="ob-form" icon={GraduationCap}>Formação e certificações</Rotulo>
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
        return "Antes de tudo: duas confirmações";
      case 2:
        return "O que você pode fazer aqui";
      case 3:
        return "Uma foto ajuda as pessoas a te reconhecer";
      case 4:
        return "Conte sua trajetória em poucas linhas";
      case 5:
        return "No que você pode ajudar?";
      case 6:
        // case 6 é passo de mentor — pra coord/supervisor o índice 6 é o
        // fechamento ("Tudo certo"), não os campos de LinkedIn
        return ehMentor ? "LinkedIn e experiência com voluntariado" : `Tudo certo, ${primeiroNome}!`;
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
      return ehMentor
        ? "Interesses e motivação ajudam a formar a sua dupla; a motivação fica só com a coordenação."
        : "Interesses e motivação ajudam a equipe a te conhecer; a motivação fica só com a coordenação.";
    if (ehMentor && step === PASSO_PAREAMENTO)
      return "A coordenação usa isso pra escolher a dupla: tudo opcional, dá pra completar depois no Perfil.";
    if (ehMentor && step === PASSO_DISPONIBILIDADE)
      return "Toque nos dias e períodos em que você costuma ter agenda livre. A coordenação cruza com a do mentorado.";
    if (ehPassoTermo)
      return demo
        ? "O documento que formaliza o voluntariado de toda a equipe no programa. Leia e, se quiser, já assine: na demonstração a assinatura é simulada, nada sai do seu navegador."
        : "O documento que formaliza o voluntariado de toda a equipe no programa, com a mesma validade de uma assinatura em papel. Leia e, se quiser, já assine; dá pra deixar pra depois também.";
    switch (step) {
      case 0:
        return ehMentor
          ? "A plataforma do Programa de Mentoria Social: a jornada da sua dupla, os registros e os materiais de apoio num lugar só."
          : "A plataforma do Programa de Mentoria Social: o andamento das duplas, os registros e os materiais de apoio num lugar só.";
      case 1:
        return "Rapidinho: diz se você é voluntário(a). A segunda confirmação, obrigatória, autoriza o uso dos dados do cadastro.";
      case 2:
        return "O essencial da sua rotina no programa. Escolha um item pra ver a tela onde ele acontece.";
      case 3:
        return "Aparece no seu perfil e nas duplas. Dá pra colocar depois.";
      case 4:
        return temPapel(me, "mentor_especialista")
          ? "Aparece no seu perfil pra equipe e pros mentorados do catálogo."
          : "Aparece no seu perfil pra equipe.";
      case 5:
        return "Toque pra selecionar ou digite uma nova. Dá pra mudar depois no seu perfil.";
      case 6:
        return ehMentor
          ? "Os dois são opcionais e ajudam a equipe a te conhecer melhor."
          : "Seu perfil já está visível pra equipe. Dá pra completar ou mudar tudo depois em Perfil.";
      default:
        return "Seu perfil já está visível pra equipe. Dá pra completar ou mudar tudo depois em Perfil.";
    }
  })();

  // fechamento: quem pulou o termo sai do wizard com o lembrete de onde ele
  // fica — pendência permanece (ausência de row), resolvida pelo banner da
  // home, pela linha do /perfil ou direto em /assinar. Só no último passo:
  // o default do switch é o índice final, mas o boas-vindas (step 0) cai
  // nele também — sem o gate a nag aparecia antes da jornada começar
  const corpoFechamento =
    ultimo && temTermo && !termoOk ? (
      <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Falta só o termo de adesão ao voluntariado: assine quando puder pelo
        banner da sua home ou pela página{" "}
        <Link
          href="/assinar"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Assinar
        </Link>
        .
      </p>
    ) : null;

  const corpo = (() => {
    if (step >= passoSobre && step < passoSobre + SUBPASSOS_SOBRE) {
      const sub = step - passoSobre;
      return sobrePreenchido[sub] && !editarSobre[sub]
        ? resumoSobre(sub)
        : PASSOS_SOBRE[sub];
    }
    if (ehMentor && step === PASSO_PAREAMENTO) return passoPareamento;
    if (ehMentor && step === PASSO_DISPONIBILIDADE) return passoDisponibilidade;
    // o termo tem form próprio (AssinaturaForm) — intercepta antes do switch
    // porque o índice colide com o case 6 (linkedin) pra coord/supervisor
    if (ehPassoTermo) {
      // demo: o fluxo real inteiro — documento, dados civis da persona e o
      // form — só a gravação é simulada (cookie demo_termo; os espelhos
      // leem como "assinado" e a via em PDF sai com o que foi digitado)
      if (demo) {
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
                  : "Pra assinar precisamos dos seus dados civis: preencha como no documento de identidade. Eles entram no termo exatamente como digitados."}{" "}
                Na demonstração a assinatura é simulada: nada sai do seu navegador.
              </p>
            </div>
            <AssinaturaForm
              modo="termo"
              acao={(fd) => assinarTermoDemo(me.role ?? "mentor_dpp", fd)}
              dados={civis}
              onSucesso={() => {
                setTermoOk(true);
                avancar();
              }}
            />
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
                : "Pra assinar precisamos dos seus dados civis: preencha como no documento de identidade. Eles entram no termo exatamente como digitados."}{" "}
              Eles ficam restritos à coordenação e ao termo, não aparecem no seu perfil.
            </p>
          </div>
          <AssinaturaForm
            modo="termo"
            acao={assinarTermo}
            dados={
              civis ?? {
                // prefill com o que o wizard já coletou — os dados civis são
                // um silo à parte (RPC 0046), mas nascimento/cidade/UF valem
                // nos dois mundos
                nome_civil: null,
                rg: null,
                cpf: null,
                data_nascimento: nascimento || null,
                endereco: {
                  logradouro: null,
                  numero: null,
                  complemento: null,
                  bairro: null,
                  cidade: cidade || null,
                  uf: uf || null,
                  cep: null,
                },
              }
            }
            onSucesso={() => {
              setTermoOk(true);
              avancar();
            }}
          />
        </div>
      );
    }
    switch (step) {
      case PASSO_DECLARACOES: {
        const lgpdCarimbado = me.consent_lgpd_em;
        return (
          <div className="space-y-3">
            <CaixaSelecao
              icon={HandHeart}
              titulo="Sou voluntário(a)"
              descricao="Quem atua como voluntário(a) assina um termo de adesão. Marcando aqui, ele aparece no final do cadastro."
              checked={souVoluntario}
              onCheckedChange={(v) => setSouVoluntario(v)}
            />
            {lgpdCarimbado ? (
              <CaixaSelecao
                icon={ShieldCheck}
                titulo="Uso dos meus dados (LGPD)"
                descricao={`Consentimento registrado em ${new Date(lgpdCarimbado).toLocaleDateString("pt-BR")}.`}
                checked
                disabled
              />
            ) : (
              <CaixaSelecao
                icon={ShieldCheck}
                titulo="Autorizo o uso dos meus dados"
                descricao={
                  ehMentor
                    ? "Seus dados servem pra formar duplas e acompanhar o programa: a coordenação lê tudo, a sua dupla vê o essencial. É a única confirmação obrigatória do cadastro."
                    : "Seus dados servem pra organizar e acompanhar o programa: a coordenação lê tudo, a equipe vê o essencial. É a única confirmação obrigatória do cadastro."
                }
                checked={consent}
                onCheckedChange={(v) => setConsent(v)}
              />
            )}
            {/* voluntário com termo já assinado: o passo do termo não existe
                no fim — a nota confirma o estado em vez de anunciar pendência */}
            {souVoluntario && assinaturaTermo?.status === "assinado" && (
              <p className="flex items-start gap-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
                <SealCheck size={14} className="mt-0.5 shrink-0 text-[var(--ok-text)]" aria-hidden />
                <span>
                  Termo de adesão ao voluntariado: assinado. Pra reler ou
                  baixar o PDF, é só ir em Perfil.
                </span>
              </p>
            )}
          </div>
        );
      }
      case 2: {
        const recursos = RECURSOS[me.role ?? "mentor_dpp"];
        const ativo = recursos[recursoAtivo];
        return (
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
            {/* mobile: the frame pins under the fixed header while the list
                scrolls beneath — a tap swaps the shot in place, no layout
                shift. The band is opaque and edge-to-edge (-mx-4 cancels the
                page gutter) so rows slide under it without peeking through
                the gap to the header */}
            {ativo?.img && (
              <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 bg-background px-4 pb-3 pt-2 sm:hidden">
                {/* portrait shot at its native 3:4 — height-driven so the
                    whole capture shows uncropped (width follows the ratio);
                    object-top keeps the app chrome in frame on any drift */}
                <div className="relative mx-auto aspect-[3/4] h-[clamp(11rem,42dvh,16rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-border" aria-live="polite">
                  {recursos.map(
                    (r, i) =>
                      r.img && (
                        <PrintShot
                          key={`m-${r.img}`}
                          src={printMobile(r.img)}
                          media="(max-width: 639px)"
                          ativo={i === recursoAtivo}
                          alt={i === recursoAtivo ? (r.alt ?? "") : ""}
                        />
                      )
                  )}
                </div>
              </div>
            )}
            <ul className="space-y-2">
              {recursos.map((r, i) => {
                const aceso = !!r.img && i === recursoAtivo;
                const cartao = cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left outline-none transition-colors sm:px-4 sm:py-3",
                  aceso
                    ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/10"
                    : cn(
                        "border-border bg-card",
                        r.img && "hover:border-foreground/40"
                      )
                );
                const conteudo = (
                  <>
                    {/* o disco lime é sinal de estado (mesma regra do
                        CaixaSelecao): neutro no repouso, aceso no ativo */}
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                        aceso
                          ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <r.icon size={18} weight="fill" aria-hidden />
                    </span>
                    <span className="text-sm leading-snug">{r.texto}</span>
                    {/* the small screen icon marks which rows have a shot to
                        preview — a caret read as a dropdown that never opened */}
                    {r.img && (
                      <ImageSquare
                        size={16}
                        aria-hidden
                        className={cn(
                          "ml-auto shrink-0 transition-colors",
                          aceso ? "text-foreground" : "text-muted-foreground/70"
                        )}
                      />
                    )}
                  </>
                );
                return (
                  <li key={r.texto}>
                    {r.img ? (
                      <button
                        type="button"
                        onMouseEnter={() => setRecursoAtivo(i)}
                        onFocus={() => setRecursoAtivo(i)}
                        onClick={() => setRecursoAtivo(i)}
                        aria-current={aceso || undefined}
                        className={cn(
                          cartao,
                          "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/60"
                        )}
                      >
                        {conteudo}
                      </button>
                    ) : (
                      <div className={cartao}>{conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {/* desktop: a coluna de conteúdo da tela real ao lado, com
                crossfade — capturada a 876px, sai perto do tamanho real */}
            {ativo?.img && (
              // a largura acompanha a altura da janela (24rem = header,
              // balão e footer fixos): em 1280×720 a moldura passava do
              // footer e a página rolava; assim a proporção do print se mantém
              <figure className="hidden sm:sticky sm:top-20 sm:block sm:max-w-[calc((100dvh-24rem)*73/60)]">
                <MolduraTela>
                  <div className="relative aspect-[73/60]" aria-live="polite">
                    {recursos.map(
                      (r, i) =>
                        r.img && (
                          <PrintShot
                            key={r.img}
                            src={printDesktop(r.img)}
                            media="(min-width: 640px)"
                            ativo={i === recursoAtivo}
                            alt={i === recursoAtivo ? (r.alt ?? "") : ""}
                          />
                        )
                    )}
                  </div>
                </MolduraTela>
                <figcaption className="mt-2 px-1 text-xs text-muted-foreground">
                  {ativo.alt}
                </figcaption>
              </figure>
            )}
          </div>
        );
      }
      case 3:
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
      case 4:
        return (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Rotulo htmlFor="ob-bio" icon={PencilLine}>Biografia</Rotulo>
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
      case 5:
        return (
          <div className="space-y-2">
            {/* rótulo de grupo, não de controle — o input livre do TagInput
                tem aria-label próprio, então <p> em vez de <Label> órfão */}
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Tag size={15} className="text-muted-foreground" aria-hidden />
              Áreas de atuação
            </p>
            <TagInput
              name="areas"
              sugestoes={AREAS_SUGESTOES}
              value={areas}
              onChange={setAreas}
              inputLabel="Digite uma área e pressione Enter"
            />
          </div>
        );
      case 6:
        // passo de mentor — pra coord/supervisor o índice 6 já é o
        // fechamento; cair aqui renderizaria campos fora do <form>
        if (!ehMentor) return corpoFechamento;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Rotulo htmlFor="ob-linkedin" icon={LinkedinLogo}>LinkedIn</Rotulo>
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
                <Rotulo htmlFor="ob-voluntariado" icon={HandHeart}>Experiência com voluntariado</Rotulo>
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
          <Button
            type="button"
            variant="outline"
            size="icon"
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
            className="shrink-0 rounded-full"
          >
            {/* pending no passo 0 só pode ser o recomecarDemo — spinner enquanto sai */}
            {pending && step === 0 ? (
              <CircleNotch className="animate-spin" aria-hidden />
            ) : (
              <ArrowLeft aria-hidden />
            )}
          </Button>
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
          <span aria-hidden className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {step + 1}/{total}
          </span>
          {demo}
        </div>
      </header>

      {/* coluna central — pb/pt compensam header e footer fixos. O passo de
          recursos com telas reais respira em desktop (balão apertado deixava
          o print ilegível); os demais passos ficam na coluna estreita de
          conversa. Mobile ancora no topo (justify-center deixava ~200px
          mortos sob o header e o balão flutuando no meio da tela) — o
          centro vertical volta a partir de sm, onde o wizard lê como card.
          pb-40 no mobile cobre o footer empilhado (~154px com safe-area) */}
      <main
        className={cn(
          "mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col pb-40 pt-[calc(5rem+env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] transition-[max-width] duration-500 sm:justify-center sm:px-6 sm:pb-32",
          step === 2 && "sm:max-w-6xl"
        )}
      >
        <Logo size="sm" className="mb-6 self-start" />
        <div key={step} className="animate-rise">
          <div className="flex items-end gap-3">
            {/* a Liza abre e fecha a jornada — a cauda do balão aponta pra
                ela; nos passos do meio ela sai pra não disputar o form */}
            {(step === 0 || ultimo) && (
              <LizaBlob
                estado={ultimo ? "pronto" : "atento"}
                tamanho={64}
                className="mb-1 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1 rounded-3xl rounded-bl-md border border-border bg-card px-5 py-4 sm:max-w-xl">
              <h1
                ref={tituloRef}
                tabIndex={-1}
                className="text-xl font-semibold leading-snug outline-none"
              >
                {titulo}
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
            </div>
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

      {/* footer fixo: "Pular etapa" nos passos opcionais + primário.
          Mobile empilha (ghosts centrados em cima, primário full-width
          colado na borda = polegar) — em linha única os dois ghosts +
          Continuar estouravam 390px e o primário saía cortado da tela */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl flex-col items-stretch gap-1.5 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:flex-row sm:items-center sm:gap-3 sm:px-6">
          {(passoComCampos || ehPassoTermo) && (
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3">
              {/* no termo o ghost é "Assinar depois": avança sem gravar —
                  a pendência segue como ausência de assinatura. Nos demais
                  passos da demo sem form o primário cobre o pulo; no termo
                  demo ele aparece porque o primário some (paridade com o
                  fluxo real: quem decide é o botão dentro do form) */}
              {(passoComCampos || ehPassoTermo || !demo) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={pularEtapa}
                  disabled={pending}
                >
                  {ehPassoTermo ? "Assinar depois" : "Pular etapa"}
                </Button>
              )}
              {/* saída honesta pros passos opcionais acumulados: conclui o
                  onboarding direto (mesmo concluirOnboarding do último
                  passo) — a ficha pode ser completada depois no Perfil. No
                  termo some: "Assinar depois" já é a saída desse passo */}
              {!ehPassoTermo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={concluir}
                  disabled={pending}
                  className="text-muted-foreground"
                >
                  Concluir agora
                </Button>
              )}
            </div>
          )}
          {/* sempre type=button + requestSubmit explícito: um botão que vira
              submit no MESMO clique dispara o form do passo seguinte — o
              default action do clique é avaliado depois do re-render, então
              "Continuar" avançava 2 passos (pulava a foto).
              No passo do termo o primário some: o submit mora dentro do
              AssinaturaForm e um "Continuar" ao lado de "Assinar depois"
              seria ambíguo — na demo vale o mesmo, o form simulado é que
              conduz */}
          {!ehPassoTermo && (
            <Button
              type="button"
              onClick={() => {
                if (passoComCampos) {
                  (
                    document.getElementById(FORM_ID) as HTMLFormElement | null
                  )?.requestSubmit();
                } else if (ultimo) {
                  concluir();
                } else if (step === PASSO_DECLARACOES) {
                  avancarDasDeclaracoes();
                } else {
                  avancar();
                }
              }}
              disabled={pending}
              className="h-11 w-full font-semibold sm:flex-1"
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
