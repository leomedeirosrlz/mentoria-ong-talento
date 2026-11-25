"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
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
  Signature,
  Signpost,
  Tag,
  Target,
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
import { CaixaSelecao } from "@/components/ui/caixa-selecao";
import { TagInput } from "@/components/tag-input";
import { PassoTermo } from "@/components/termo-vivo";
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
import { Etapa, useTrocaDeEtapa } from "@/components/ui/etapa";
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
import { LizaOnboarding } from "@/components/liza/liza-onboarding";
import {
  PassoRecursos,
  type RecursoTour,
} from "@/components/onboarding-recursos";
import { STATUS_CEP, useBuscaCep } from "@/lib/use-busca-cep";
import { cn } from "@/lib/utils";

/** Um form por passo — o botão do footer fixo submete via atributo `form`. */
const FORM_ID = "onboarding-passo";
/** O passo do termo tem form próprio (AssinaturaForm): o primário do rodapé
 *  fixo submete via `form` mesmo estando fora dele (REALIZA-497). */
const TERMO_FORM_ID = "onboarding-termo";
/** Primeiro campo de cada bloco "Sobre você" que fecha em resumo — o
 *  Editar devolve o foco pra ele ao expandir (o botão desmonta junto
 *  com o resumo). */
const PRIMEIRO_CAMPO_SOBRE: Record<number, string> = {
  0: "ob-social",
  1: "ob-cargo",
};

/** "O que você pode fazer aqui" — os pontos que mudam a rotina de cada papel,
 *  cada um com a tela real onde ele acontece. */
const RECURSOS: Record<AppRole, RecursoTour[]> = {
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
    { icon: Target, texto: "PDM do mentorado: metas e plano vivem na plataforma", img: "mentor_dpp-pdm", alt: "Aba Instrumentos da dupla com o PDM aberto: metas, indicadores e submetas" },
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
  // /jovem, REALIZA-114, com um passo de recursos próprio) — a entrada
  // existe porque o Record pede todos os papéis e as demos/queries
  // compartilham a lista
  mentorado: [
    { icon: CalendarCheck, texto: "Sua agenda de encontros com o mentor." },
    { icon: ListChecks, texto: "Os combinados que ficaram pra você." },
    { icon: FolderOpen, texto: "Os materiais de apoio do programa." },
  ],
};

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
// review 21/11 (REALIZA-497): pro mentor os 4 passos da ficha/pareamento
// viraram 2 telas de confirmação — o dado que a importação já trouxe fecha
// em resumo com Editar próprio e o pareamento se junta à motivação; os
// outros papéis seguem com os 3 sub-passos
const SUBPASSOS_SOBRE = (ehMentor: boolean) => (ehMentor ? 2 : 3);

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
  // nunca renderiza. O status da prop é congelado no mount: o revalidatePath
  // pós-assinatura reentrega "assinado" e recalcular o total no meio da sessão
  // deixaria o step órfão (sem fechamento, sem carinha e com header N+1/N)
  const [souVoluntario, setSouVoluntario] = useState(me.voluntario !== false);
  const [assinaturaInicial] = useState(
    () => assinaturaTermo?.status === "assinado"
  );
  const temTermo = !assinaturaInicial && souVoluntario;
  // coord/supervisor: boas-vindas + declarações + recursos + ficha pessoal
  // em 3 sub-passos + fechamento (7); mentores: + foto, apresentação, os 2
  // passos "Sobre você" fundidos (497) e a disponibilidade (11); termo
  // pendente adiciona 1 passo
  const total = (ehMentor ? 11 : 7) + (temTermo ? 1 : 0);
  // wizard pelo kit (ui/etapa): o índice já vem clampado — o total encolhe
  // quando a pessoa desmarca "voluntário" (e o status da prop pode chegar
  // assinado depois), sem o valuenow > valuemax do bug. A direção alimenta
  // o slide da Etapa; o foco segue no efeito próprio (scroll + título)
  const { etapa: step, direcao, irPara } = useTrocaDeEtapa(total);
  const [termoOk, setTermoOk] = useState(false);
  const [pendingTermo, setPendingTermo] = useState(false);
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
  // o CEP do "Sobre você" é só alavanca do ViaCEP: profiles não guarda
  // CEP (ele é dado civil) — o valor digitado vira prefill do termo no
  // fim do wizard e a busca preenche cidade/UF aqui mesmo
  const buscaCep = useBuscaCep({
    onEndereco: (endereco) => {
      setCidade(endereco.cidade);
      setUf(endereco.uf);
    },
  });
  const [cargo, setCargo] = useState(me.cargo ?? "");
  const [empresa, setEmpresa] = useState(me.empresa ?? "");
  const [origem, setOrigem] = useState(me.origem ?? "");
  const [interesses, setInteresses] = useState<string[]>(me.interesses ?? []);
  const [motivacao, setMotivacao] = useState(pessoal?.motivacao ?? "");
  const [consent, setConsent] = useState(false);
  // sub-passos do "Sobre você" colapsam quando a importação da coordenação já
  // preencheu — "Corrigir" expande o form de volta pra editar
  const [editarSobre, setEditarSobre] = useState<Record<number, boolean>>({});
  // bloco cujo resumo acabou de expandir — o efeito devolve o foco pro
  // primeiro campo dele depois do commit (o botão Editar desmonta junto)
  const focoEditarRef = useRef<number | null>(null);
  useEffect(() => {
    const sub = focoEditarRef.current;
    if (sub == null) return;
    focoEditarRef.current = null;
    const id = PRIMEIRO_CAMPO_SOBRE[sub];
    if (id) document.getElementById(id)?.focus();
  }, [editarSobre]);

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
  const ultimo = step >= total - 1;
  // passos de ficha/perfil são opcionais — ganham o ghost "Pular etapa" e a
  // saída "Pular tudo"; faixa contínua do primeiro passo de ficha
  // até a disponibilidade (mentor) ou o fim dos sub-passos (coord/superv.)
  const passoSobre = PASSO_SOBRE(ehMentor);
  const subpassosSobre = SUBPASSOS_SOBRE(ehMentor);
  // grade do mentor fica logo depois dos sub-passos — era um índice fixo
  // quando o "Sobre você" tinha 4 telas
  const passoDisponibilidadeIdx = passoSobre + subpassosSobre;
  const ultimoComCampos = ehMentor
    ? passoDisponibilidadeIdx
    : passoSobre + subpassosSobre - 1;
  const passoComCampos = step >= 3 && step <= ultimoComCampos;
  // o termo é penúltimo (antes do "Tudo certo") e fica FORA do <form>
  // compartilhado: o AssinaturaForm tem form e submit próprios. -1 quando a
  // assinatura já existe (assinado) — o passo some do wizard inteiro
  const passoTermo = temTermo ? total - 2 : -1;
  const ehPassoTermo = step === passoTermo;

  function avancar() {
    // foco fica no efeito [step] da superfície (scroll + título) — irPara
    // com alvo null marca só a direção do slide
    irPara(step + 1, null);
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
      </div>
      {/* CEP + cidade + UF na mesma linha: um conceito só (onde). O CEP
          vem primeiro porque o ViaCEP preenche os outros dois — edição
          manual posterior sempre vence o autofill */}
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_6.5rem]">
        <div className="space-y-2">
          <Rotulo htmlFor="ob-cep" icon={Signpost}>CEP</Rotulo>
          <div className="relative">
            <Input
              id="ob-cep"
              name="cep"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              placeholder="00000-000"
              value={buscaCep.cep}
              onChange={(e) => buscaCep.onCepChange(e.target.value)}
              onBlur={(e) => buscaCep.onCepBlur(e.currentTarget.value)}
              aria-describedby="ob-cep_status"
            />
            {buscaCep.buscando && (
              <CircleNotch
                size={16}
                aria-hidden
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
              />
            )}
          </div>
          {buscaCep.status !== "idle" && (
            <p
              id="ob-cep_status"
              aria-live="polite"
              className="text-xs text-muted-foreground"
            >
              {STATUS_CEP[buscaCep.status]}
            </p>
          )}
        </div>
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
  // aberto porque interesses/motivação são o dado que alimenta o matching.
  // Congelado no mount (padrão assinaturaInicial): recalcular por render
  // trocava campos↔resumo na tecla que completava o bloco e derrubava o
  // input focado — parcial abre campos, completo abre resumo (503)
  const [sobrePreenchido] = useState(() => [
    !!(nascimento && genero && cidade && uf),
    !!(cargo && empresa),
    false,
  ]);
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
  const resumoSobre = (sub: number, rotulo = "Já temos esses dados do cadastro") => (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ClipboardText size={15} className="text-muted-foreground" aria-hidden />
          {rotulo}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            focoEditarRef.current = sub;
            setEditarSobre((s) => ({ ...s, [sub]: true }));
          }}
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

  // mentor (497): a 1ª tela "Sobre você" confirma os dois blocos que a
  // importação costuma trazer — cada um fecha num resumo com Editar
  // próprio; sem importação (ou com buraco) o bloco abre os campos. Todos
  // os `name`s seguem no FormData do passo — o patch salvo é o mesmo dos
  // dois envios anteriores, num só
  const passoSobreDados = (
    <div className="space-y-6">
      {[
        { rotulo: "Quem você é", sub: 0, campos: passoSobreIdentidade },
        { rotulo: "Seu trabalho", sub: 1, campos: passoSobreProfissional },
      ].map((grupo) => (
        <section
          key={grupo.rotulo}
          aria-label={grupo.rotulo}
          className="space-y-3"
        >
          {sobrePreenchido[grupo.sub] && !editarSobre[grupo.sub] ? (
            resumoSobre(grupo.sub, grupo.rotulo)
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {grupo.rotulo}
              </p>
              {grupo.campos}
            </>
          )}
        </section>
      ))}
    </div>
  );

  /** Blocos do "Pareamento" (mentor, 0034) — preferência de gênero do par +
   *  a bagagem que entra na ficha. Na 497 a tela própria foi fundida no
   *  2º "Sobre você" do mentor, mas os campos e os nomes são os mesmos. */
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

  // mentor (497): a 2ª tela "Sobre você" junta o que a coordenação cruza
  // pra formar a dupla — interesses/motivação (sempre abertos) + a
  // preferência de par e a bagagem que antes tinham tela própria
  const passoSobreDupla = (
    <div className="space-y-6">
      <section aria-label="O que te move" className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          O que te move
        </p>
        {passoSobreMotivacao}
      </section>
      <section aria-label="Pra formar sua dupla" className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Pra formar sua dupla
        </p>
        {passoPareamento}
      </section>
    </div>
  );

  const titulo = (() => {
    if (step === passoSobre)
      return ehMentor
        ? "Sobre você: confira seus dados"
        : "Sobre você: quem você é";
    if (step === passoSobre + 1)
      return ehMentor
        ? "Sobre você: o que ajuda a formar sua dupla"
        : "Sobre você: seu trabalho";
    if (!ehMentor && step === passoSobre + 2) return "Sobre você: o que te move";
    if (ehMentor && step === passoDisponibilidadeIdx) return "Quando você pode encontrar sua dupla";
    if (ehPassoTermo) return "Termo de adesão ao trabalho voluntário";
    switch (step) {
      case 0:
        return `Boas-vindas ao Realiza.vc, ${primeiroNome}!`;
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
      return ehMentor
        ? "O cadastro já trouxe estes dados: confira os dois blocos e corrija o que precisar. Nascimento e gênero ficam visíveis só pra coordenação."
        : "Como você se apresenta e onde vive. Nascimento e gênero ficam visíveis só pra coordenação.";
    if (step === passoSobre + 1)
      return ehMentor
        ? "Interesses, motivação e a sua bagagem ajudam a coordenação a formar a sua dupla. Tudo opcional, dá pra completar depois no Perfil; a motivação fica só com a coordenação."
        : "Cargo, empresa e como você chegou: contexto rápido pra equipe te conhecer.";
    if (!ehMentor && step === passoSobre + 2)
      return "Interesses e motivação ajudam a equipe a te conhecer; a motivação fica só com a coordenação.";
    if (ehMentor && step === passoDisponibilidadeIdx)
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
    if (step >= passoSobre && step < passoSobre + subpassosSobre) {
      const sub = step - passoSobre;
      if (ehMentor) return sub === 0 ? passoSobreDados : passoSobreDupla;
      return sobrePreenchido[sub] && !editarSobre[sub]
        ? resumoSobre(sub)
        : PASSOS_SOBRE[sub];
    }
    if (ehMentor && step === passoDisponibilidadeIdx) return passoDisponibilidade;
    // o termo tem form próprio (AssinaturaForm dentro do PassoTermo) —
    // intercepta antes do switch porque o índice colide com o case 6
    // (linkedin) pra coord/supervisor. Na demo o fluxo é o real inteiro —
    // documento, dados civis da persona e o form — só a gravação é simulada
    // (cookie demo_termo; os espelhos leem como "assinado" e a via em PDF
    // sai com o que foi digitado). O documento interpola o que a pessoa
    // digita e o primário fica no rodapé fixo (497)
    if (ehPassoTermo) {
      return (
        <PassoTermo
          doc="voluntario"
          civis={civis}
          dados={
            civis ?? {
              // prefill com o que o wizard já coletou — os dados civis são
              // um silo à parte (RPC 0046), mas nascimento/cidade/UF/CEP
              // valem nos dois mundos
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
                cep: buscaCep.cep.replace(/\D/g, "") || null,
              },
            }
          }
          acao={
            demo
              ? (fd) => assinarTermoDemo(me.role ?? "mentor_dpp", fd)
              : assinarTermo
          }
          demo={!!demo}
          formId={TERMO_FORM_ID}
          onSucesso={() => {
            setTermoOk(true);
            avancar();
          }}
          onPendingChange={setPendingTermo}
        />
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
      case 2:
        return <PassoRecursos recursos={RECURSOS[me.role ?? "mentor_dpp"]} />;
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
              irPara(step - 1, null);
            }}
            // pendingTermo trava o Voltar no meio do submit do termo —
            // sair do passo desmontava o form com a action voando
            disabled={(step === 0 && !demo) || pending || pendingTermo}
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
              className="h-full origin-left rounded-full bg-[var(--brand-lime)] transition-transform duration-500"
              style={{ transform: `scaleX(${(step + 1) / total})` }}
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
          "mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col pb-40 pt-[calc(5rem+env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:justify-center sm:px-6 sm:pb-32",
          // sem transition-[max-width]: a spec 028 bane max-width em
          // transição (layout por frame) — a largura muda seca junto do
          // slide da etapa, que já sinaliza a mudança
          step === 2 && "sm:max-w-6xl"
        )}
      >
        <Logo size="sm" className="mb-6 self-start" />
        {/* remount por passo é deliberado (FormData por passo) — a Etapa
            com key mantém o remount e traz o slide direcional */}
        <Etapa key={step} direcao={direcao}>
          <div className="flex items-end gap-3">
            {/* a Liza abre e fecha a jornada — a cauda do balão aponta pra
                ela; nos passos do meio ela sai pra não disputar o form */}
            {(step === 0 || ultimo) && (
              <LizaOnboarding ultimo={ultimo} />
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
            // noValidate: a validação é a da action (mensagens pt-BR);
            // campos opcionais com formato (o type=url do LinkedIn) não
            // podem travar Continuar nem Pular etapa na bolha nativa
            <form
              id={FORM_ID}
              onSubmit={salvarPasso}
              noValidate
              className="mt-5"
            >
              {corpo}
            </form>
          ) : (
            corpo && <div className="mt-5">{corpo}</div>
          )}
        </Etapa>
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
                  a pendência segue como ausência de assinatura, agora ao
                  lado do primário real que submete o form (497). Nos demais
                  passos da demo sem form o primário cobre o pulo; no termo
                  demo ele aparece também (paridade com o fluxo real) */}
              {(passoComCampos || ehPassoTermo || !demo) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={pularEtapa}
                  disabled={pending || pendingTermo}
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
              No passo do termo o primário vira o submit do AssinaturaForm
              (form=id, sem botão interno): o "Assinar" fica sempre à vista
              no rodapé e "Assinar depois" segue como a saída secundária
              (497) — na demo vale o mesmo, o form simulado é que conduz */}
          {ehPassoTermo ? (
            <Button
              type="submit"
              form={TERMO_FORM_ID}
              formNoValidate
              disabled={pending || pendingTermo}
              className="h-11 w-full font-semibold sm:flex-1"
            >
              {pendingTermo ? (
                <CircleNotch className="animate-spin" aria-hidden />
              ) : (
                <Signature aria-hidden />
              )}
              {pendingTermo ? "Assinando…" : "Assinar eletronicamente"}
            </Button>
          ) : (
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
                ? ultimo
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
