import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BookOpen,
  CalendarBlank,
  CalendarPlus,
  CaretDown,
  ChatsCircle,
  ClockCounterClockwise,
  DotsThree,
  FlagCheckered,
  HandHeart,
  PaperPlaneTilt,
  Sparkle,
  UserPlus,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  getCicloEventos,
  getDupla,
  getDuplaSucessora,
  getDuplaVinculo,
  getDuplasResumo,
  getDuplasResumoTodas,
  getEspecialistaEventos,
  getMateriais,
  getMe,
  getMentorados,
  getMentorProfiles,
  getPessoas,
  type DuplaVinculo,
  type MentorProfile,
} from "@/lib/queries";
import {
  getDevolutivasDupla,
  getEspecialistas,
  getPropostas,
  getSlotsLivres,
  getSolicitacoesDaDupla,
} from "@/lib/queries-especialista";
import { getEncerramentoDaDupla, getAvaliacao360DaDupla } from "@/lib/queries-encerramento";
import {
  getAvaliacaoLinks,
  getAvaliacaoMediaDpp,
  getEspecialistaAvaliacoes,
} from "@/lib/queries-avaliacao";
import { getSupervisoesDaDupla } from "@/lib/queries-supervisao";
import { getFormularios, getInstrumentosDaDupla } from "@/lib/forms/queries";
import { dadosResumoJornada } from "@/lib/encerramento";
import { getAnexosPorRegistros } from "@/lib/anexos";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { VoltarLink } from "@/components/voltar-link";
import {
  alvoAgendamento,
  encontroDoPassoEsp,
  eventoDaSemana,
  eventosDoCronograma,
  formatDate,
  formatDateTime,
  foraDoPrograma,
  jornadaDaDupla,
  linkSeguro,
  passoEsp,
  passosDaTrilha,
  registroTardio,
  saudadeDaDupla,
  SITUACAO_MENTORADO_LABEL,
  toDateStr,
  TRILHA_LABEL,
  type PassoGuia,
} from "@/lib/ciclo";
import { msgsContato } from "@/lib/whatsapp-msgs";
import { AvaliacaoBadge, SemaforoBadge } from "@/components/semaforo";
import { NudgeButton } from "@/components/nudge-button";
import { CopiarChamada } from "@/components/copiar-chamada";
import { WhatsAppRapido, type DestinoWA } from "@/components/whatsapp-rapido";
import { NotaEncontro } from "@/components/nota-encontro";
import {
  AvaliacaoJovemCard,
  AvaliacaoPendenteLinha,
  EstrelaEspecialistaChip,
  VozDoJovemCard,
  VozDoJovemEspecialista,
} from "@/components/avaliacao-jovem";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { EditarDuplaDialog } from "@/components/editar-dupla-dialog";
import { RemanejarDuplaDialog } from "@/components/remanejar-dupla-dialog";
import { RemanejoSugerido } from "@/components/remanejo-sugerido";
import { NaoAconteceuButton, DesfazerNaoAconteceuButton } from "@/components/nao-aconteceu-button";
import { RegistroForm } from "@/components/registro-form";
import {
  RegistroDetails,
  RegistroInline,
  RegistroInlinePanel,
  RegistroInlineTrigger,
} from "@/components/registro-inline";
import { EditarRegistro } from "@/components/editar-registro";
import { EncaminhamentosList } from "@/components/encaminhamentos-list";
import { RevelarApos } from "@/components/revelar-apos";
import { ArquivosDupla } from "@/components/arquivos-dupla";
import { PedirApoioDialog } from "@/components/pedir-apoio-dialog";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import { TrajetoriaAvaliacoes } from "@/components/trajetoria-avaliacoes";
import { SolicitacaoStatusChip } from "@/components/solicitacao-status-chip";
import { SolicitacaoNegociacao } from "@/components/solicitacao-negociacao";
import { SolicitarEspecialistaDialog } from "@/components/solicitar-especialista-dialog";
import { SugerirEspecialistaDialog } from "@/components/sugerir-especialista-dialog";
import { DevolutivaComposer } from "@/components/devolutivas-card";
import { TrilhaJornada } from "@/components/trilha-jornada";
import { TrilhaPrazoBadge } from "@/components/trilha-prazo-badge";
import { TrilhaFechamento } from "@/components/trilha-fechamento";
import { EncerrarTrilhaDialog } from "@/components/encerrar-trilha-dialog";
import { EncerramentoDupla } from "@/components/encerramento-dupla";
import { EnviarFormularioDialog } from "@/components/enviar-formulario-dialog";
import { ResumoJornadaSection } from "@/components/resumo-jornada";
import { InstrumentosDupla } from "./instrumentos-dupla";
import { DevolutivaEspecialista } from "@/components/devolutiva-especialista";
import { SupervisaoDialog } from "@/components/supervisao-dialog";
import { SupervisoesSection } from "@/components/supervisoes-section";
import { MarcoNotifier } from "@/components/marco-notifier";
import { AnexosRegistro } from "@/components/anexos-registro";
import { RegistroView } from "@/components/registro-view";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { temPapel } from "@/lib/types";
import type { AvaliacaoLink, Dupla, Encaminhamento, Encontro, Material, RegistroAnexo } from "@/lib/types";
import { filaMentorados } from "@/lib/fila";
import {
  ladoDeMentor,
  ladoDeMentorado,
  ranquearMentorados,
  ranquearMentores,
} from "@/lib/remanejo";
import { cn } from "@/lib/utils";

// mesma pele do DropdownMenuContent (ui/dropdown-menu), composta à mão aqui:
// o overflow "Mais" precisa de Portal keepMounted — os itens do menu são os
// próprios triggers dos dialogs, e o unmount do popup ao fechar derrubaria
// qualquer dialog aberto a partir dele
const MENU_POPUP =
  "z-50 max-h-(--available-height) w-56 min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-[var(--shadow-overlay)] duration-150 ease-[cubic-bezier(0.2,0,0,1)] outline-none data-[side=bottom]:slide-in-from-top-1 data-[side=bottom]:slide-out-to-top-1 data-[side=left]:slide-in-from-right-1 data-[side=left]:slide-out-to-right-1 data-[side=right]:slide-in-from-left-1 data-[side=right]:slide-out-to-left-1 data-[side=top]:slide-in-from-bottom-1 data-[side=top]:slide-out-to-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95";

/** Pools da sugestão de remanejo (REALIZA-115): mentores do papel da
 *  trilha da dupla ranqueados por afinidade com o mentorado (cheios ficam
 *  marcados, não somem — a saída deles é ajustar capacidade) × a fila
 *  "Aguardando par" pura ranqueada por afinidade com o mentor. As queries
 *  são as do board /pessoas — React.cache reusa o que a página já buscou. */
async function montarSugestaoRemanejo(dupla: Dupla) {
  const [pessoas, mentorados, mps, resumo, resumoTodas] = await Promise.all([
    getPessoas(),
    getMentorados(),
    getMentorProfiles(),
    getDuplasResumo(),
    getDuplasResumoTodas(),
  ]);
  const mpMap: Record<string, MentorProfile> = Object.fromEntries(
    mps.map((mp) => [mp.profile_id, mp])
  );
  // a régua do trigger (0073): ativas + pausadas contam vaga, chaveadas
  // por trilha (WP6b — a pool do híbrido é separada em cada trilha)
  const usadas: Record<string, number> = {};
  const ocupados = new Set<string>();
  for (const d of resumo) {
    const chave = `${d.mentor_id}:${d.trilha ?? "dpp"}`;
    usadas[chave] = (usadas[chave] ?? 0) + 1;
    ocupados.add(d.mentorado_id);
  }
  const historico = new Set(resumoTodas.map((d) => d.mentorado_id));
  const fila = filaMentorados(mentorados, ocupados, historico);
  const papel =
    dupla.trilha === "especialista" ? "mentor_especialista" : "mentor_dpp";
  // os lados que ficam vêm do cadastro completo — o embed da dupla não
  // traz os sensíveis de matching (gênero/preferência de par), que a
  // coordenação lê via *_pessoal e o score usa quando existem
  const ficaMentorado =
    mentorados.find((m) => m.id === dupla.mentorado.id) ?? dupla.mentorado;
  const ficaMentor =
    pessoas.find((p) => p.id === dupla.mentor.id) ?? dupla.mentor;
  return {
    mentores: ranquearMentores(
      pessoas,
      papel,
      mpMap,
      usadas,
      ladoDeMentorado(ficaMentorado),
      dupla.mentor.id
    ),
    mentorados: ranquearMentorados(
      fila,
      mentorados,
      ladoDeMentor(ficaMentor, mpMap[dupla.mentor.id])
    ),
    // carimbo do SSR pro "há N dias na fila" — mora na montagem (fora do
    // render) porque o react-hooks/purity barra Date.now() no JSX
    agoraMs: Date.now(),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const dupla = await getDupla(id);
  return {
    title: dupla
      ? `${dupla.mentor.nome} e ${dupla.mentorado.nome} · Realiza.vc`
      : "Dupla · Realiza.vc",
  };
}

export default async function DuplaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dupla, eventos, me, materiais, anexosPorRegistro, encerramento, supervisoes, instrumentos] =
    await Promise.all([
      getDupla(id),
      getCicloEventos(),
      getMe(),
      getMateriais(),
      // getDupla é React.cache — a 2ª chamada reusa o mesmo fetch, sem round-trip extra
      getDupla(id).then((d) =>
        getAnexosPorRegistros(
          (d?.encontros ?? []).flatMap((e) => (e.registro ? [e.registro.id] : []))
        )
      ),
      // fechamento do ciclo — a row pode existir só com a autoavaliação do
      // mentor (decisão da coordenação pendente)
      getEncerramentoDaDupla(id),
      // sessões de supervisão da dupla + as gerais do mentor dela (0041)
      getDupla(id).then((d) =>
        d ? getSupervisoesDaDupla(d.id, d.mentor.id) : []
      ),
      // instrumentos oficiais da jornada (0080) — RPC escopada: coord,
      // mentor e supervisor da dupla (e o próprio jovem, na área dele)
      getInstrumentosDaDupla(id),
    ]);
  if (!dupla || !me) notFound();

  const souMentor = dupla.mentor.id === me.id;
  const souCoord = me.role === "coordenacao";
  // linhagem do remanejo (0063): a ficha nova aponta a origem, a encerrada
  // aponta a sucessora. As queries voltam null quando a outra ponta está
  // fora do escopo do papel (RLS — quem saiu não enxerga a ficha nova) e a
  // linha discreta simplesmente não renderiza
  const [origem, sucessora] = await Promise.all([
    dupla.remanejada_de ? getDuplaVinculo(dupla.remanejada_de) : null,
    dupla.status === "encerrada" ? getDuplaSucessora(dupla.id) : null,
  ]);
  const nomeVinculo = (v: DuplaVinculo) =>
    `${v.mentor?.nome ?? "—"} e ${v.mentorado?.nome ?? "—"}`;
  // o supervisor da dupla registra a sessão daqui mesmo — alvo único, sem
  // query extra (o dialog ganha mentor+dupla já resolvidos)
  const podeRegistrarSupervisao =
    dupla.supervisor?.id === me.id &&
    (dupla.status === "ativa" || dupla.status === "pausada");
  const ehEsp = dupla.trilha === "especialista";
  // forms ativos pra "Enviar formulário" da ficha e pro link de avaliação
  // 360º do encerramento — escopo coord (a query já devolve [] pros demais)
  const formulariosAtivos = souCoord
    ? (await getFormularios()).filter((f) => f.ativo)
    : [];
  // data da resposta 360º oficial (0042) — escopo coord: a proveniência do
  // check é detalhe operacional, e a policy de respostas já é coord-only
  const avaliacao360Em = souCoord ? await getAvaliacao360DaDupla(id) : null;
  // passos do guia da trilha — ciclo_eventos (DPP, com datas) ou os 5 passos
  // do especialista (sem data: a dupla combina dentro dos 3 meses)
  const espEventos = ehEsp ? await getEspecialistaEventos() : [];
  // fluxo entre mentores do guia: a demanda de especialista nasce na dupla
  // DPP. O chip conta o estado a quem olha a ficha; o botão some enquanto uma
  // solicitação está aberta (re-pedir é pra quando a anterior se resolveu)
  const solicitacoes = !ehEsp ? await getSolicitacoesDaDupla(id) : [];
  const solicitacao = solicitacoes[0] ?? null;
  // o pedido que ocupa a vaga agora (0074 — "em aberto" inclui triagem e
  // negociação; o status_efetivo já desconta o slot vencido, então um
  // expirado NÃO bloqueia — bate com o dedup do criarSolicitacao)
  const STATUS_SOL_ABERTA = new Set([
    "aberta",
    "aguardando_coord",
    "contra_proposta",
  ]);
  const solEmAberto =
    solicitacoes.find((s) =>
      STATUS_SOL_ABERTA.has(s.status_efetivo ?? s.status)
    ) ?? null;
  // a negociação precisa da thread e dos slots livres do especialista da
  // mesa — o contra da equipe também sai da grade dele (regra da RPC)
  const espDaMesa =
    solEmAberto?.especialista_id ?? solEmAberto?.especialista_desejado_id;
  const [propostasAberta, slotsEsp] = await Promise.all([
    solEmAberto ? getPropostas(solEmAberto.id) : Promise.resolve([]),
    espDaMesa ? getSlotsLivres(espDaMesa) : Promise.resolve([]),
  ]);
  // avaliação estrela do jovem (0071): links tokenizados são coord-only
  // (policy), a média agregada só faz sentido pro mentor DPP e as estrelas
  // da trilha especialista vêm da view definer — cada leitura no seu papel
  const [avaliacaoLinks, mediaJovem, espAvaliacoes, devolutivasFeed] =
    await Promise.all([
      souCoord ? getAvaliacaoLinks(id) : Promise.resolve([]),
      souMentor && !ehEsp ? getAvaliacaoMediaDpp(id) : Promise.resolve(null),
      souMentor && ehEsp ? getEspecialistaAvaliacoes(id) : Promise.resolve([]),
      // WP6: feed datado da trilha esp — a policy lê pro autor (o
      // especialista) e pra coord; supervisor/mentor DPP não veem a coluna
      ehEsp && (souMentor || souCoord)
        ? getDevolutivasDupla(id)
        : Promise.resolve([]),
    ]);
  const linkAvalPorEncontro = new Map(
    avaliacaoLinks.map((l) => [l.encontro_id, l])
  );
  const estrelaEspPorEncontro = new Map(
    espAvaliacoes.map((a) => [a.encontro_id, a.estrelas])
  );
  // embed RLS já devolveu o que o papel pode ler — pro rail: coord/sup
  // recebem todas, o mentor DPP só as que o jovem liberou
  const avaliacoesDaDupla = dupla.encontros.flatMap((e) =>
    e.avaliacao_jovem ? [e.avaliacao_jovem] : []
  );
  const realizadosCount = dupla.encontros.filter(
    (e) => e.status === "realizado"
  ).length;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const podeSolicitar =
    !ehEsp &&
    dupla.status === "ativa" &&
    !solEmAberto &&
    (souMentor || souCoord);
  // WP6: a sugestão mentor→jovem é do DPP da dupla — e só uma pendente por
  // vez (a RPC deduplica; aqui a gente some o gesto em vez de errar depois)
  const sugestaoPendente = solicitacoes.some((s) => s.status === "sugerida");
  const podeSugerir =
    !ehEsp &&
    dupla.status === "ativa" &&
    souMentor &&
    !sugestaoPendente;
  const especialistas =
    podeSolicitar || podeSugerir ? await getEspecialistas() : [];
  // calendário oficial DA DUPLA (0061): só os eventos do cronograma dela.
  // Especialista e dupla histórica sem vínculo caem em [] — especialista
  // usa os 5 passos próprios; histórica vive do que está gravado (fallback
  // abaixo), nunca de um calendário alheio
  const eventosDaDupla = eventosDoCronograma(eventos, dupla.cronograma_id);
  const passos = passosDaTrilha(dupla.trilha, eventosDaDupla, espEventos);
  const saude = saudadeDaDupla(dupla, eventos);
  // sugestão de remanejo (REALIZA-115): risco já é o gatilho — nada de
  // carência em "atencao". E só com a dupla viva: remanejar encerrada é
  // contraditório (o RPC também barra)
  const sugestaoRemanejo =
    souCoord &&
    (saude.semaforo === "risco" || saude.apoio.aberto) &&
    (dupla.status === "ativa" || dupla.status === "pausada")
      ? await montarSugestaoRemanejo(dupla)
      : null;
  const total = passos.length;
  const { proximoNumero, encontroAlvo, sugeridoProximo, faltantes } =
    alvoAgendamento(dupla, eventos);
  const jornada = jornadaDaDupla(dupla, passos);

  const primeiroNomeMentor = dupla.mentor.nome.split(" ")[0];
  const primeiroNomeMentorado = dupla.mentorado.nome.split(" ")[0];

  // combinados ainda abertos — alimentam o form de registro e a msg de WhatsApp
  const combinadosPendentes = (dupla.encaminhamentos ?? [])
    .filter((e) => e.status !== "feito")
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
  // registro_id → nº de exibição do encontro, pra lista de encaminhamentos
  // dizer de onde veio cada um. Na trilha esp o nº gravado é a TENTATIVA —
  // o que as linhas mostram é o passo do guia (0074), então mapeia pro passo
  const encontroNumeroPorRegistroId = Object.fromEntries(
    dupla.encontros.flatMap((e) =>
      e.registro
        ? [[e.registro.id, ehEsp ? passoEsp(e, dupla.encontros) : e.numero]]
        : []
    )
  );
  // todos os anexos dos registros da dupla, mais novos primeiro — a seção
  // "Arquivos" agrega o que hoje só existe espalhado encontro a encontro
  const arquivosDaDupla = dupla.encontros
    .flatMap((e) =>
      (e.registro ? (anexosPorRegistro[e.registro.id] ?? []) : []).map((a) => ({
        ...a,
        encontroNumero: ehEsp ? passoEsp(e, dupla.encontros) : e.numero,
      }))
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const msgCombinados =
    `Olá ${primeiroNomeMentorado}! Combinados do nosso último encontro: ` +
    combinadosPendentes
      .map((t, i) => `${i + 1}) ${t.descricao}${t.prazo ? ` (até ${formatDate(t.prazo)})` : ""}`)
      .join(" ") +
    `. ${primeiroNomeMentor}`;

  // catálogo whatsapp-msgs — check-in neutro do header ("mentoria com X");
  // msgs específicas de anomalia vivem junto de cada bloco que as usa
  const msgsGenerico = msgsContato("generico", {
    mentorNome: dupla.mentor.nome,
    mentoradoNome: dupla.mentorado.nome,
    autorNome: me.nome,
  });
  // nudge do pedido de apoio: só o mentor recebe — o pedido partiu dele e o
  // mentorado não é canal de resposta (vazio pro mentor = nunca renderiza)
  const apoioDestinos: DestinoWA[] = souMentor
    ? []
    : [
        {
          rotulo: "Chamar mentor",
          telefone: dupla.mentor.whatsapp,
          mensagem:
            msgsContato("apoio", {
              mentorNome: dupla.mentor.nome,
              mentoradoNome: dupla.mentorado.nome,
              autorNome: me.nome,
            }).mentor ?? "",
          t: "apoio",
        },
      ];

  // material de apoio por nº de encontro (guia/template daquele encontro) —
  // a audiência segue a trilha: material DPP nunca cai na trilha especialista
  // (pra coordenação, que enxerga tudo, o número coincidiria errado)
  const audienciasDaTrilha = ehEsp
    ? new Set(["todos", "especialista", "coordenacao"])
    : new Set(["todos", "dpp", "coordenacao"]);
  const materiaisPorNumero = new Map<number, Material[]>();
  for (const m of materiais) {
    if (m.encontro_num == null || !audienciasDaTrilha.has(m.audiencia)) continue;
    const arr = materiaisPorNumero.get(m.encontro_num) ?? [];
    arr.push(m);
    materiaisPorNumero.set(m.encontro_num, arr);
  }

  const hojeStr = toDateStr(new Date());
  const podeRetroativo = souMentor && dupla.status === "ativa" && faltantes.length > 0;

  // fechamento da trilha especialista: especialista dono ou coordenação,
  // enquanto a trilha está aberta (ativa/pausada e sem carimbo)
  const podeEncerrarTrilha =
    ehEsp &&
    (souMentor || souCoord) &&
    (dupla.status === "ativa" || dupla.status === "pausada") &&
    !dupla.encerrada_em;
  // resumo da jornada — gerado dos dados; o "fim" é o carimbo do fechamento
  // (decisão DPP ou encerrada_em da trilha especialista)
  const resumoJornada = dadosResumoJornada(
    dupla,
    passos,
    eventosDaDupla,
    encerramento?.created_at ?? dupla.encerrada_em ?? null
  );
  // bloco só vale a pena com história — dupla zerada mostra a trilha, não um
  // relatório vazio
  const mostrarResumo =
    resumoJornada.realizados > 0 ||
    !!encerramento?.tipo ||
    !!dupla.encerrada_em;

  // encontros depois do oficial da semana ficam colapsados (página tem 16
  // linhas). Na trilha especialista não há "semana oficial" — os 5 passos
  // ficam sempre abertos.
  const numeroSemana = ehEsp
    ? null
    : (eventoDaSemana(eventosDaDupla, new Date())?.numero ?? null);
  // dupla sem cronograma (histórica, ou cadastro ainda sem vínculo): não há
  // trilha pra montar, mas os encontros registrados são fato — a lista cai
  // pro que está gravado em vez de sumir
  const passosLista: PassoGuia[] = passos.length
    ? passos
    : dupla.encontros.map((enc) => ({
        id: `leg-${enc.numero}`,
        numero: enc.numero,
        titulo: `Encontro ${enc.numero}`,
        data: null,
        fase: null,
        instrumentos: [],
      }));
  const encontrosVisiveis = passosLista.filter(
    (ev) => numeroSemana == null || ev.numero <= numeroSemana
  );
  const encontrosFuturos = passosLista.filter(
    (ev) => numeroSemana != null && ev.numero > numeroSemana
  );
  // pendência de registro (realizado sem registro ou agendado já vencido) —
  // nunca entra no collapsible: o deep link #registrar-{id} precisa sempre existir
  const temPendencia = (enc: Encontro | undefined) =>
    !!enc &&
    !enc.registro &&
    (enc.status === "realizado" ||
      (enc.status === "agendado" &&
        enc.data_hora != null &&
        new Date(enc.data_hora) < new Date()));
  const futurosComPendencia = encontrosFuturos.filter((ev) =>
    temPendencia(dupla.encontros.find((e) => e.numero === ev.numero))
  );
  const encontrosColapsados = encontrosFuturos.filter(
    (ev) => !futurosComPendencia.includes(ev)
  );

  // os 2 registros mais recentes nascem abertos; os demais viram linha-resumo
  // sob disclosure — a pendência nunca é registro salvo (ela segue visível
  // via RegistroInline/deep link)
  const registrosRecentes = new Set(
    dupla.encontros
      .filter((e) => e.registro)
      .map((e) => e.numero)
      .sort((a, b) => b - a)
      .slice(0, 2)
  );

  // ações do header: 1 primária contextual por papel + o resto no overflow
  // "Mais". Mentor registra a pendência (senão agenda); coord chama no
  // WhatsApp (o Editar fica quieto ao lado e vira a ação principal quando o
  // mentor não tem número)
  const pendenteRegistro =
    dupla.encontros
      .filter(temPendencia)
      .sort((a, b) => a.numero - b.numero)[0] ?? null;
  // agendar pela ficha é só pra trilha DPP — a sessão de especialista nasce
  // de pedido aceito (0074); aqui o especialista só REMARCA a tentativa que
  // já existe (a action barra criar row nova por esse caminho)
  const podeAgendar =
    souMentor && !ehEsp && saude.feitos < total && dupla.status === "ativa";
  // a tentativa já marcada na trilha esp — remarcável, nunca criável por aqui
  const tentativaAgendada = ehEsp
    ? (dupla.encontros
        .filter((e) => e.status === "agendado" || e.status === "remarcado")
        .sort((a, b) => a.numero - b.numero)[0] ?? null)
    : null;

  // overflow — os dialogs entram pelo trigger custom (Menu.Item é o
  // Dialog.Trigger de fato); o keepMounted do Portal segura o dialog montado
  // quando o menu fecha no clique
  const maisItens: React.ReactNode[] = [];
  if (pendenteRegistro && podeAgendar) {
    maisItens.push(
      <AgendarEncontroDialog
        key="agendar"
        duplaId={dupla.id}
        numero={proximoNumero}
        atual={encontroAlvo}
        sugerido={sugeridoProximo}
        piso={dupla.iniciada_em ?? undefined}
        jovemNome={primeiroNomeMentorado}
        trigger={
          <DropdownMenuItem render={<button type="button" />} nativeButton>
            <CalendarPlus aria-hidden /> Agendar encontro
          </DropdownMenuItem>
        }
      />
    );
  }
  if (souCoord && (dupla.status === "ativa" || dupla.status === "pausada")) {
    maisItens.push(
      <EnviarFormularioDialog
        key="form"
        formularios={formulariosAtivos}
        duplaId={dupla.id}
        mentor={{
          id: dupla.mentor.id,
          nome: dupla.mentor.nome,
          whatsapp: dupla.mentor.whatsapp,
        }}
        mentorado={{
          id: dupla.mentorado.id,
          nome: dupla.mentorado.nome,
          whatsapp: dupla.mentorado.whatsapp,
        }}
        trigger={
          <DropdownMenuItem render={<button type="button" />} nativeButton>
            <PaperPlaneTilt aria-hidden /> Enviar formulário
          </DropdownMenuItem>
        }
      />
    );
  }
  if (podeSolicitar) {
    maisItens.push(
      <SolicitarEspecialistaDialog
        key="esp"
        duplaId={dupla.id}
        especialistas={especialistas}
        trigger={
          <DropdownMenuItem render={<button type="button" />} nativeButton>
            <UserPlus aria-hidden /> Solicitar mentor especialista
          </DropdownMenuItem>
        }
      />
    );
  }
  if (podeSugerir) {
    maisItens.push(
      <SugerirEspecialistaDialog
        key="sug"
        mentoradoId={dupla.mentorado.id}
        duplaDppId={dupla.id}
        especialistas={especialistas}
        nomeJovem={dupla.mentorado.nome}
        trigger={
          <DropdownMenuItem render={<button type="button" />} nativeButton>
            <Sparkle aria-hidden /> Sugerir especialista pro jovem
          </DropdownMenuItem>
        }
      />
    );
  }
  if (podeEncerrarTrilha) {
    maisItens.push(
      <EncerrarTrilhaDialog
        key="trilha"
        duplaId={dupla.id}
        trigger={
          <DropdownMenuItem render={<button type="button" />} nativeButton>
            <FlagCheckered aria-hidden /> Encerrar trilha
          </DropdownMenuItem>
        }
      />
    );
  }
  const renderEncontro = (passo: PassoGuia) => {
    // DPP: numero é a identidade do passo. Especialista (0074): numero é a
    // TENTATIVA — o passo é o rank entre realizados; várias tentativas miram
    // o mesmo passo e a linha mostra a última cartada (o realizado vence)
    const enc = ehEsp
      ? encontroDoPassoEsp(dupla.encontros, passo.numero)
      : (dupla.encontros.find((e) => e.numero === passo.numero) ?? null);
    // sessões furadas antes da que a linha mostra — contexto honesto do
    // "passo 2 na 3ª tentativa", some quando não houve falha
    const tentativasFalhas = ehEsp
      ? dupla.encontros.filter(
          (e) =>
            (e.status === "nao_aconteceu" || e.status === "cancelado") &&
            passoEsp(e, dupla.encontros) === passo.numero &&
            (enc == null || e.numero !== enc.numero)
        ).length
      : 0;
    return (
      <EncontroRow
        key={passo.id}
        passo={passo}
        encontro={enc ?? null}
        tentativasFalhas={tentativasFalhas}
        duplaId={dupla.id}
        souMentor={souMentor}
        podeEditar={souMentor && dupla.status === "ativa"}
        podeMarcar={(souMentor || souCoord) && dupla.status === "ativa"}
        ativa={dupla.status === "ativa"}
        jornadaViva={
          dupla.status === "ativa" || dupla.status === "pausada"
        }
        souCoord={souCoord}
        autorId={me.id}
        // evidência é do mentor — coord só remove (moderação), sup só lê
        podeAnexar={souMentor && dupla.status === "ativa"}
        podeRemoverAnexos={souCoord || (souMentor && dupla.status === "ativa")}
        anexos={(enc?.registro && anexosPorRegistro[enc.registro.id]) || []}
        materiais={materiaisPorNumero.get(passo.numero) ?? []}
        combinadosPendentes={combinadosPendentes}
        nota={dupla.notas?.find((n) => n.numero === passo.numero)?.texto ?? null}
        registroAberto={registrosRecentes.has(passo.numero)}
        apoioDestinos={apoioDestinos}
        linkAvaliacao={
          enc ? (linkAvalPorEncontro.get(enc.id) ?? null) : null
        }
        estrelaJovem={
          enc ? (estrelaEspPorEncontro.get(enc.id) ?? null) : null
        }
        piso={dupla.iniciada_em ?? undefined}
        ehEsp={ehEsp}
        urlBase={siteUrl}
        jovemNome={primeiroNomeMentorado}
        jovemWhatsapp={dupla.mentorado.whatsapp}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        {/* Voltar contextual: link colado cai em /duplas (o mentor tem lista
            própria agora); vindo de dentro do app retorna à origem real */}
        <VoltarLink fallback="/duplas" />
      </div>

      {/* hero da ficha — a dupla como identidade visual: a faixa lime→amarelo
          repete a ordem dos nomes (mentor→mentorado) e as cores de papel do
          logo. No resto da página cada cor volta a significar seu eixo */}
      <header className="relative flex flex-wrap items-start justify-between gap-4 overflow-hidden rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--brand-lime),var(--role-mentorado))]"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {/* par de avatares sobrepostos — a dupla como unidade visual (§4);
                cada foto é o link do próprio perfil */}
            <span className="mr-2 inline-flex align-[-6px]">
              <DuplaAvatares
                mentor={dupla.mentor}
                mentorado={dupla.mentorado}
                size={40}
                linkar
              />
            </span>
            <DuplaNomes mentor={dupla.mentor.nome} mentorado={dupla.mentorado.nome} />
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SemaforoBadge nivel={saude.semaforo} motivo={saude.motivo} />
            {/* pro mentor o próprio pedido de apoio é eixo separado (WP2):
                um chamado já recebido ao lado do semáforo real — o tom é
                "avisamos, relaxa", não alarme */}
            {souMentor && saude.pediuApoio && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--info-text)]">
                <HandHeart size={12} aria-hidden />
                Apoio solicitado
                <span className="font-normal">· a coordenação entra em contato</span>
              </span>
            )}
            {/* apoio aberto é eixo separado do semáforo (WP2): pra equipe a
                jornada pode estar em dia E ter chamado — o pill azul mostra
                o trabalho sem fingir falha da dupla */}
            {!souMentor && saude.apoio.aberto && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--info-text)]">
                <HandHeart size={12} aria-hidden />
                Apoio aberto
                {saude.apoio.origem === "mentorado"
                  ? " · do mentorado"
                  : saude.apoio.origem === "ambos"
                    ? " · dos dois"
                    : ""}
              </span>
            )}
            {/* mono fica só no contador — "encontros" é prosa, volta pro sans */}
            <span><span className="font-mono">{saude.feitos}/{total}</span> encontros</span>
            <TrajetoriaAvaliacoes encontros={dupla.encontros} total={total} />
            {/* trilha fora do padrão DPP é fato da dupla — aparece como badge
                quieto pra ninguém ler o contador /5 como bug */}
            {ehEsp && (
              <Badge variant="secondary" className="font-normal">
                {TRILHA_LABEL[dupla.trilha]}
              </Badge>
            )}
            {/* prazo da trilha curta — 3 meses do aceite (iniciada_em), com
                urgência na quinzena final */}
            {ehEsp && <TrilhaPrazoBadge dupla={dupla} />}
            {!ehEsp && <SolicitacaoStatusChip solicitacao={solicitacao} />}
            {dupla.supervisor && (
              // terciário — não compete em text-sm com o semáforo (§4)
              <span className="text-xs">Auxiliar executivo: {dupla.supervisor.nome}</span>
            )}
          </div>
          {/* linhagem do remanejo — linha discreta, quieta: é navegação de
              contexto, não alerta (a sucessora carrega a nota de que o
              histórico ficou aqui) */}
          {(origem || sucessora) && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {origem && (
                <>
                  Originada de{" "}
                  <Link
                    href={`/duplas/${origem.id}`}
                    className="rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {nomeVinculo(origem)}
                  </Link>
                  .
                </>
              )}
              {sucessora && (
                <>
                  Substituída por{" "}
                  <Link
                    href={`/duplas/${sucessora.id}`}
                    className="rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {nomeVinculo(sucessora)}
                  </Link>{" "}
                  — encontros e registros ficam aqui.
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* a primária é o "o que fazer agora" do papel — o resto mora no
              Mais ou no quieto (Editar, a segunda ação da coordenação) */}
          {souMentor && dupla.status === "ativa" && pendenteRegistro && (
            <a
              href={`#registrar-${pendenteRegistro.id}`}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Registrar encontro
            </a>
          )}
          {souMentor && !pendenteRegistro && podeAgendar && (
            // quem agenda é a dupla · coordenação monitora e faz nudge
            <AgendarEncontroDialog
              duplaId={dupla.id}
              numero={proximoNumero}
              atual={encontroAlvo}
              sugerido={sugeridoProximo}
              piso={dupla.iniciada_em ?? undefined}
              jovemNome={primeiroNomeMentorado}
            />
          )}
          {souMentor && ehEsp && dupla.status === "ativa" && tentativaAgendada && (
            // a sessão nasce do pedido aceito — aqui só se move a tentativa
            // que já existe (numero = tentativa, não passo)
            <AgendarEncontroDialog
              duplaId={dupla.id}
              numero={tentativaAgendada.numero}
              atual={tentativaAgendada}
              piso={dupla.iniciada_em ?? undefined}
              jovemNome={primeiroNomeMentorado}
              rotulo="sessão de especialista"
            />
          )}
          {/* pedido de apoio direto — o checkbox "preciso de apoio" dentro do
              registro exige um encontro feito; a vida aperta entre encontros
              também. Visível pra quem pode pedir (o mentor da dupla) */}
          {souMentor &&
            (dupla.status === "ativa" || dupla.status === "pausada") && (
              <PedirApoioDialog
                duplaId={dupla.id}
                trigger={
                  <Button variant="outline" size="sm">
                    <HandHeart aria-hidden /> Pedir apoio
                  </Button>
                }
              />
            )}
          {/* nudge é papel de coordenação/supervisão — pro próprio mentor o
              botão abriria conversa consigo mesmo e logaria contato falso.
              Os dois lados da dupla lado a lado; tipos "nudge"/"contato"
              distintos coexistem no dedupe de 60s do /api/nudge. Sem número
              o item mostra a razão e o Editar é quem sobra de ação */}
          {!souMentor && (
            <WhatsAppRapido
              duplaId={dupla.id}
              destinos={[
                {
                  rotulo: "Chamar mentor",
                  telefone: dupla.mentor.whatsapp,
                  mensagem: msgsGenerico.mentor ?? "",
                  t: "nudge",
                },
                {
                  rotulo: "Chamar mentorado",
                  telefone: dupla.mentorado.whatsapp,
                  mensagem: msgsGenerico.mentorado ?? "",
                  t: "contato",
                },
              ]}
            />
          )}
          {souCoord && <EditarDuplaDialog dupla={dupla} />}
          {/* remanejo troca um lado sem costurar encerra-e-cria na mão —
              só faz sentido com a dupla viva (o RPC também barra o resto) */}
          {souCoord &&
            (dupla.status === "ativa" || dupla.status === "pausada") && (
              <RemanejarDuplaDialog dupla={dupla} />
            )}
          {maisItens.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <DotsThree size={16} weight="bold" /> Mais
                  </Button>
                }
              />
              <MenuPrimitive.Portal keepMounted>
                <MenuPrimitive.Positioner
                  className="isolate z-50 outline-none"
                  align="end"
                  sideOffset={4}
                >
                  <MenuPrimitive.Popup className={MENU_POPUP}>
                    {maisItens}
                  </MenuPrimitive.Popup>
                </MenuPrimitive.Positioner>
              </MenuPrimitive.Portal>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* trilha da jornada — visível e read-only pra todos os papéis (é fato,
          não placar); o brinde de marco é só do mentor. A borda esquerda
          carrega o semáforo — mesmo idioma do tomCard da lista de duplas */}
      <section
        className={cn(
          "rounded-xl border-l-4 bg-card px-4 py-3.5 shadow-[var(--shadow-border)]",
          dupla.status !== "ativa"
            ? "border-l-muted-foreground/40"
            : saude.semaforo === "risco"
              ? "border-l-[var(--danger)]"
              : saude.semaforo === "atencao" || saude.apoio.aberto
                ? "border-l-[var(--warn)]"
                : "border-l-[var(--ok)]"
        )}
      >
        <TrilhaJornada
          jornada={jornada}
          statusDupla={dupla.status}
          inicioDupla={dupla.iniciada_em}
          duplaId={dupla.id}
        />
      </section>
      {souMentor && (
        <MarcoNotifier duplaId={dupla.id} feitos={jornada.feitos} total={jornada.total} />
      )}

      {/* risco virou pergunta de trabalho pra coordenação (REALIZA-115):
          quem pode assumir cada lado, por afinidade — um clique abre o
          remanejo atômico de sempre com o par já escolhido */}
      {sugestaoRemanejo && (
        <RemanejoSugerido
          dupla={dupla}
          // semáforo aceso explica pela jornada; apoio sozinho (dupla em
          // dia + chamado) explica pelo eixo de trabalho — "Em dia." não
          // sustenta a frase de remanejo
          motivo={
            saude.semaforo !== "ok"
              ? saude.motivo
              : saude.apoio.origem === "mentorado"
                ? "Pedido de apoio aberto pelo mentorado"
                : saude.apoio.origem === "ambos"
                  ? "Pedidos de apoio abertos nos dois lados"
                  : "Pedido de apoio aberto pelo mentor"
          }
          mentores={sugestaoRemanejo.mentores}
          mentorados={sugestaoRemanejo.mentorados}
          agoraMs={sugestaoRemanejo.agoraMs}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* o rail vem antes no DOM: no mobile os combinados e o contexto são o
            conteúdo primário (a lista de encontros é o histórico longo); no lg
            o order devolve a coluna pra direita — mesmo padrão da ficha de
            pessoa, o foco segue a ordem da leitura mobile */}
        <aside className="min-w-0 space-y-6 lg:order-2">
          {/* o porquê da mentoria especialista — contexto pro especialista
              antes do 1º encontro e pra coordenação acompanhar */}
          {ehEsp && (
            <section className="rounded-xl bg-card p-4 text-sm space-y-2 shadow-[var(--shadow-border)]">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--info)]" />
                Contexto
              </h2>
              {dupla.demanda ? (
                <p className="whitespace-pre-line break-words text-muted-foreground">
                  {dupla.demanda}
                </p>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  {souCoord
                    ? "Sem contexto registrado. Edite a dupla pra adicionar."
                    : "Sem contexto registrado."}
                </p>
              )}
            </section>
          )}
          {/* depois do fechamento a trilha conta o desfecho: motivo + a
              devolutiva que seguiu pro PDM do jovem */}
          {ehEsp && <TrilhaFechamento dupla={dupla} />}
          {/* sem combinados a seção não rende nada — some de vez (os links
              #combinados só nascem quando existe pendente pra marcar) */}
          {(dupla.encaminhamentos?.length ?? 0) > 0 && (
          <section
            id="combinados"
            className="scroll-mt-20 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--info)]" />
                Combinados
              </h2>
              {/* sem WhatsApp o botão fica desabilitado com a razão visível —
                  esconder deixaria o mentor procurando uma ação que sumiu */}
              {souMentor && combinadosPendentes.length > 0 && (
                <NudgeButton
                  telefone={dupla.mentorado.whatsapp}
                  mensagem={msgCombinados}
                  label="Enviar combinados"
                  duplaId={dupla.id}
                  t="contato"
                />
              )}
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Tarefas que a dupla combinou nos encontros
              {(souMentor || souCoord) &&
                (dupla.status === "ativa" || dupla.status === "pausada") &&
                ". Marque quando forem feitas"}.
            </p>
            <EncaminhamentosList
              itens={dupla.encaminhamentos}
              duplaId={dupla.id}
              podeEditar={
                souMentor &&
                (dupla.status === "ativa" || dupla.status === "pausada")
              }
              podeMarcar={
                (souMentor || souCoord) &&
                (dupla.status === "ativa" || dupla.status === "pausada")
              }
              hoje={hojeStr}
              encontroNumeroPorRegistroId={encontroNumeroPorRegistroId}
            />
          </section>
          )}

          <ArquivosDupla arquivos={arquivosDaDupla} />

          <section className="rounded-xl bg-card p-4 text-sm space-y-2 shadow-[var(--shadow-border)]">
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {/* papel da pessoa no dot — amarelo do jovem, gramática da §1 */}
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
              Mentorado
            </h2>
            {/* avatar+nome num link só (padrão da lista de pessoas) */}
            <Link
              href={`/pessoas/${dupla.mentorado.id}`}
              aria-label={`Abrir perfil de ${dupla.mentorado.nome}`}
              className="group -my-1.5 flex items-center gap-2.5 rounded-lg py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar
                nome={dupla.mentorado.nome}
                src={dupla.mentorado.avatar_path ? avatarPublicUrl(dupla.mentorado.avatar_path) : null}
                papel="mentorado"
                size={32}
              />
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {!dupla.mentorado.avatar_path && (
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--role-mentorado)]" />
                )}
                <span className="underline-offset-4 transition-colors group-hover:underline">
                  {dupla.mentorado.nome}
                </span>
              </span>
            </Link>
            {/* saída do programa (0077) — a dupla encerrada já conta a
                história, mas o badge evita ler "desistente" como bug */}
            {foraDoPrograma(dupla.mentorado) && (
              <Badge
                variant="outline"
                className={cn(
                  "w-fit font-normal",
                  dupla.mentorado.situacao === "desistente" &&
                    "border-[var(--warn)]/60 text-[var(--warn-text)]"
                )}
              >
                {SITUACAO_MENTORADO_LABEL[dupla.mentorado.situacao ?? "ativo"]}
              </Badge>
            )}
            {dupla.mentorado.ong_origem ? (
              <p className="text-muted-foreground">{dupla.mentorado.ong_origem}</p>
            ) : (
              // dado faltante não imita dado presente — vira nota discreta só
              // pra coordenação, que pode completar o cadastro
              souCoord && (
                <p className="text-xs italic text-muted-foreground">
                  sem ONG de origem cadastrada
                </p>
              )
            )}
            {(souMentor || souCoord || me.role === "supervisor") && (
              <WhatsAppRapido
                duplaId={dupla.id}
                destinos={[
                  {
                    rotulo: "Falar com mentorado",
                    telefone: dupla.mentorado.whatsapp,
                    // o mentor fala como mentor, não como equipe — msg própria
                    mensagem: souMentor
                      ? `Olá ${primeiroNomeMentorado}! Aqui é ${primeiroNomeMentor}, seu mentor no Programa de Mentoria Social.`
                      : (msgsGenerico.mentorado ?? ""),
                    t: "contato",
                  },
                ]}
              />
            )}
            {/* PDM vive no instrumento nativo (0080) — o link externo
                (pdm_url, 0044) foi removido na 0098; PDMs antigos entram
                por importação de materiais. */}
          </section>

          {/* voz do jovem (0071) — o recorte que cada papel pode ler:
              coord/sup o rollup completo, o mentor DPP a média quantizada,
              o especialista a lista de estrelas por sessão. Na trilha esp
              as linhas de estrela também moram nos cards dos encontros */}
          {(souCoord || me.role === "supervisor" || souMentor) &&
            (ehEsp ? (
              souMentor && <VozDoJovemEspecialista itens={espAvaliacoes} />
            ) : (
              <VozDoJovemCard
                avaliacoes={avaliacoesDaDupla}
                pendentes={
                  souCoord || me.role === "supervisor"
                    ? saude.avaliacaoJovemPendente
                    : 0
                }
                media={souMentor ? mediaJovem : null}
                papel={souMentor ? "mentor" : (me.role as "coordenacao" | "supervisor")}
                realizados={realizadosCount}
              />
            ))}

          {/* instrumentos oficiais (0080) — visão, metas, PDM e roda com o
              estado de cada um na dupla e a leitura estruturada da resposta.
              O mentor entrega (o guia é dele), não é job coord-only */}
          {!ehEsp && (
            <InstrumentosDupla
              duplaId={dupla.id}
              itens={instrumentos}
              mentoradoNome={dupla.mentorado.nome}
              mentoradoWhatsapp={dupla.mentorado.whatsapp}
              podeEnviar={souCoord || souMentor}
              jornadaViva={
                dupla.status === "ativa" || dupla.status === "pausada"
              }
            />
          )}

          {/* supervisão (0041) — sessões da dupla + as gerais do mentor; a
              seção fica visível pra coord/supervisor/mentor (o mentor lê o
              resumo — transparência). Vazia só aparece pra quem pode
              registrar — pro resto seria um card vazio de ruído */}
          {(supervisoes.length > 0 || podeRegistrarSupervisao) && (
            <SupervisoesSection
              itens={supervisoes}
              visao="mentor"
              duplaAtualId={dupla.id}
              podeExcluir={souCoord}
              acao={
                podeRegistrarSupervisao ? (
                  <SupervisaoDialog
                    alvos={[
                      {
                        dupla_id: dupla.id,
                        mentor_id: dupla.mentor.id,
                        mentor_nome: dupla.mentor.nome,
                        mentorado_nome: dupla.mentorado.nome,
                      },
                    ]}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-my-1 text-muted-foreground"
                      >
                        <ChatsCircle size={14} />
                        Registrar supervisão
                      </Button>
                    }
                  />
                ) : undefined
              }
            />
          )}

          {/* o pedido em andamento é assunto da ficha: quem abriu (ou a
              coord) responde a proposta daqui; a thread mostra a mesa. Fora
              da triagem — aguardando_coord é espera, não negociação */}
          {!ehEsp &&
            solEmAberto &&
            (solEmAberto.status_efetivo ?? solEmAberto.status) !==
              "aguardando_coord" && (
              <section className="rounded-xl bg-card p-4 text-sm space-y-3 shadow-[var(--shadow-border)]">
                <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <span aria-hidden className="size-1.5 rounded-full bg-[var(--info)]" />
                  Pedido de especialista
                </h2>
                {/* papel-no-contexto (WP6b): o componente só habilita o lado
                    especialista quando o visitante é o alvo/desejado ou o
                    pedido é broadcast — informar o papel efetivo é seguro e
                    destrava o híbrido DPP-primário */}
                <SolicitacaoNegociacao
                  s={solEmAberto}
                  propostas={propostasAberta}
                  slots={slotsEsp}
                  meuId={me.id}
                  papel={
                    temPapel(me, "mentor_especialista")
                      ? "mentor_especialista"
                      : me.role
                  }
                  mentoradosProprios={
                    souMentor && dupla.trilha !== "especialista"
                      ? [dupla.mentorado.id]
                      : undefined
                  }
                />
              </section>
            )}

          {/* a trilha de especialista devolve o resultado pro PDM — chega ao
              mentor DPP pela solicitação que ele abriu */}
          {!ehEsp && <DevolutivaEspecialista solicitacoes={solicitacoes} />}

          {/* WP6: feed datado das devolutivas da trilha esp — o especialista
              posta ao longo do percurso e o jovem lê na página dele; a
              entrega final segue na devolutiva_pdm do encerramento */}
          {ehEsp && (devolutivasFeed.length > 0 || souMentor) && (
            <section className="rounded-xl bg-card p-4 text-sm space-y-3 shadow-[var(--shadow-border)]">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--info)]" />
                Devolutivas da trilha
              </h2>
              {devolutivasFeed.length > 0 && (
                <ul className="space-y-3">
                  {devolutivasFeed.map((v) => (
                    <li key={v.id} className="space-y-1">
                      <blockquote className="rounded-lg border-l-2 border-[var(--brand-lime)] bg-muted/30 px-3 py-2 text-muted-foreground">
                        <p className="whitespace-pre-line break-words">{v.texto}</p>
                      </blockquote>
                      <p className="text-xs text-muted-foreground">
                        {v.autor?.nome ?? "O especialista"} ·{" "}
                        {formatDateTime(v.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {/* o especialista da dupla posta enquanto a trilha segue
                  aberta — depois do encerramento a devolutiva final é a
                  devolutiva_pdm */}
              {souMentor &&
                (dupla.status === "ativa" || dupla.status === "pausada") &&
                dupla.encerrada_em == null && (
                  <DevolutivaComposer duplaId={dupla.id} />
                )}
            </section>
          )}

          {/* o rito de fechamento do ciclo DPP: checklist da coordenação +
              decisão; a autoavaliação é a parte do mentor */}
          {!ehEsp && (
            <EncerramentoDupla
              dupla={dupla}
              encerramento={encerramento}
              souMentor={souMentor}
              souCoord={souCoord}
              formularios={formulariosAtivos}
              avaliacao360Em={avaliacao360Em}
              realizadosCount={realizadosCount}
            />
          )}
        </aside>

        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {/* rótulo de seção de lista → overline padrão (§3), igual ao
                "Todos os eventos" da agenda. O sufixo carrega o "sugerido"
                uma vez só: as datas das linhas são as do guia do ciclo —
                a dupla confirma ou remarca (a real aparece como "agendado
                {data}" na própria linha) */}
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
              Encontros
              <span className="font-normal normal-case tracking-normal">
                {" "}
                ·{" "}
                {ehEsp
                  ? "datas combinadas pela dupla"
                  : "datas sugeridas pelo guia"}
              </span>
            </h2>
            {podeRetroativo && (
              <RegistrarRetroativoDialog
                duplaId={dupla.id}
                faltantes={faltantes}
                esp={ehEsp}
                trigger={
                  <Button variant="ghost" size="sm" className="-my-1 text-muted-foreground">
                    <ClockCounterClockwise size={14} />
                    {ehEsp
                      ? "Registrar sessão já realizada"
                      : "Registrar encontro já realizado"}
                  </Button>
                }
              />
            )}
          </div>
          {/* DPP sem cronograma é estado inválido pra dupla ativa (0061) —
              a nota explica o caminho em vez de deixar a trilha sumir */}
          {!ehEsp && !dupla.cronograma_id && souCoord && (
            <p className="mb-2 text-xs italic text-muted-foreground">
              Dupla sem cronograma vinculado — escolha um na edição da dupla.
            </p>
          )}
          {encontrosVisiveis.concat(futurosComPendencia).map(renderEncontro)}
          {encontrosColapsados.length > 0 && (
            <Collapsible.Root>
              <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Próximos {encontrosColapsados.length} encontros
                <CaretDown size={14} aria-hidden className="transition-transform group-data-[panel-open]:rotate-180" />
              </Collapsible.Trigger>
              <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
                <div className="space-y-3">{encontrosColapsados.map(renderEncontro)}</div>
              </Collapsible.Panel>
            </Collapsible.Root>
          )}
        </section>
      </div>

      {/* resumo gerado da jornada — base do relatório final do guia; no
          print o CSS isola este bloco */}
      {mostrarResumo && (
        <ResumoJornadaSection resumo={resumoJornada} encerramento={encerramento} />
      )}
    </div>
  );
}

function EncontroRow({
  passo,
  encontro,
  tentativasFalhas = 0,
  duplaId,
  souMentor,
  podeEditar,
  podeMarcar,
  ativa,
  souCoord,
  autorId,
  podeAnexar,
  podeRemoverAnexos,
  anexos,
  materiais,
  combinadosPendentes,
  nota,
  registroAberto,
  apoioDestinos,
  linkAvaliacao,
  estrelaJovem,
  piso,
  ehEsp,
  urlBase,
  jovemNome,
  jovemWhatsapp,
  jornadaViva,
}: {
  /** Passo do guia da trilha (data sugerida no DPP; sem data no especialista). */
  passo: PassoGuia;
  encontro: Encontro | null;
  /** Tentativas furadas que miraram este passo antes da exibida — a linha
   *  conta o caminho ("1 tentativa anterior não aconteceu"), trilha esp. */
  tentativasFalhas?: number;
  duplaId: string;
  /** O visitante é o mentor da dupla — o "entrar na chamada" é gesto dele;
   *  coord/sup (e qualquer outro) copiam o link. Distinto de podeEditar:
   *  dupla pausada não edita mas o mentor dela ainda entra na call. */
  souMentor: boolean;
  podeEditar: boolean;
  podeMarcar: boolean;
  /** Dupla ativa — badge "sem registro" só aparece quando alguém ainda pode agir. */
  ativa: boolean;
  souCoord: boolean;
  autorId: string;
  podeAnexar: boolean;
  podeRemoverAnexos: boolean;
  anexos: RegistroAnexo[];
  materiais: Material[];
  combinadosPendentes: Encaminhamento[];
  /** Anotação/plano do mentor pra esse nº do ciclo — null = sem nota. */
  nota: string | null;
  /** Registro entre os mais recentes da dupla — nasce expandido; os demais
   *  viram linha-resumo sob disclosure (o deep link `#registrar-{id}` abre). */
  registroAberto: boolean;
  /** Destinos do nudge do pedido de apoio (só o mentor — o pedido é dele).
   *  Vazio pro próprio mentor: WhatsAppRapido some sozinho. */
  apoioDestinos: DestinoWA[];
  /** Link tokenizado deste encontro (0071) — só a coordenação recebe a
   *  lista (policy coord-only); pros demais chega null. */
  linkAvaliacao: AvaliacaoLink | null;
  /** Estrela que o jovem deu nesta sessão de especialista — da view
   *  definer (só o número); null pra qualquer outro papel. */
  estrelaJovem: number | null;
  /** YYYY-MM-DD do início da dupla — piso de data do dialog de remarcar. */
  piso?: string;
  /** Trilha especialista — o remarcar da linha se lê "sessão de especialista". */
  ehEsp: boolean;
  /** Origem pública (NEXT_PUBLIC_SITE_URL) — monta o /avaliar/<token>. */
  urlBase: string;
  jovemNome: string;
  jovemWhatsapp: string | null;
  /** Dupla viva (ativa|pausada) — destrava as ações de link da pendência
   *  de avaliação; fechada deixa só o aviso como fato. */
  jornadaViva: boolean;
}) {
  const feito = encontro?.status === "realizado";
  const naoAconteceu = encontro?.status === "nao_aconteceu";
  // agendado/remarcado com horário marcado = compromisso firmado — o disco
  // ganha o tom da trilha; "a combinar" segue neutro (é só o passo do guia)
  const marcado =
    (encontro?.status === "agendado" || encontro?.status === "remarcado") &&
    !!encontro.data_hora;
  const reg = encontro?.registro;
  // realizado sem registro — a dupla deve o follow-up; marca a linha em warn
  // suave. Em dupla pausada/encerrada ninguém pode registrar: a badge e a
  // lavagem viram ruído de algo sem saída e são suprimidas
  const registroPendente = feito && !reg && ativa;
  // realizado_em ≠ data_hora: aconteceu em data diferente da agendada/registrada
  const diverge =
    feito && encontro?.realizado_em != null && encontro.realizado_em !== encontro.data_hora;
  // material do encontro: com destino (arquivo oficial ou url) vira chip; sem, só o título muted
  const material = materiais.find((m) => m.path || m.url) ?? materiais[0] ?? null;
  const materialHref = material?.path
    ? `/api/material/${material.id}`
    : linkSeguro(material?.url);
  // a chamada é a ação nº1 na janela do encontro (15 min antes a 2h depois do
  // início) — vira CTA primário; fora da janela fica chip de apoio comum
  const msAteInicio = encontro?.data_hora
    ? new Date(encontro.data_hora).getTime() - new Date().getTime()
    : null;
  const chamadaAgora =
    encontro?.status === "agendado" &&
    msAteInicio != null &&
    msAteInicio <= 15 * 60000 &&
    msAteInicio >= -2 * 3600000;
  // registro feito mais de 3 dias depois do encontro → "registro tardio"
  const tardio = reg != null && registroTardio(reg, encontro);
  // CTA e form de registro: realizado libera na hora; pros demais status
  // (agendado vencido, não-aconteceu) só depois do horário — RevelarApos cobre
  // a aba que ficou aberta atravessando o encontro, sem depender de re-render
  const liberadoNoHorario = (node: React.ReactNode) =>
    encontro?.status === "realizado"
      ? node
      : encontro?.data_hora
        ? <RevelarApos from={encontro.data_hora}>{node}</RevelarApos>
        : null;
  const podeRegistrar = !!(encontro && !reg && podeEditar);
  // remarcar e trocar o link são gestos do encontro agendado — mentor de
  // dupla ativa; a coord (e o sup) copia o link, nunca edita
  const podeRemarcar = encontro?.status === "agendado" && podeEditar;
  // ≤3 ações por linha: status à esquerda, primária da pendência, o resto ghost
  const temAcoes =
    registroPendente ||
    podeRegistrar ||
    podeRemarcar ||
    (encontro?.status === "agendado" && podeMarcar && !!encontro.data_hora) ||
    (naoAconteceu && podeMarcar) ||
    !!reg?.precisa_apoio;
  // linha 1 (data + situação): a 1ª cláusula é a data do guia, nua — o
  // "sugerido" mora uma vez no rótulo da seção, não em cada linha. Depois de
  // realizado sem divergência a data oficial é ruído e a linha abre direto
  // no "realizado {data}" (§4). Join com " · " evita separador órfão
  const linha1 = [
    !(feito && !diverge) && passo.data && formatDate(passo.data),
    encontro?.data_hora &&
      `${feito && !diverge ? "realizado" : "agendado"} ${formatDateTime(encontro.data_hora)}`,
    naoAconteceu && "não aconteceu",
  ]
    .filter(Boolean)
    .join(" · ");
  // linha 2 (secundários — só quando existe): contexto que não é o estado do
  // encontro — divergência de data, origem externa, motivo da remarcação,
  // material sem destino e o foco do passo (trilha especialista)
  const linha2 = [
    diverge && `de fato em ${formatDate(encontro?.realizado_em)}`,
    encontro?.origem === "externo" && "marcado fora da plataforma",
    encontro?.motivo_reagendamento && `remarcado: ${encontro.motivo_reagendamento}`,
    tentativasFalhas > 0 &&
      `${tentativasFalhas === 1 ? "1 tentativa anterior não aconteceu" : `${tentativasFalhas} tentativas anteriores não aconteceram`}`,
    !materialHref &&
      material &&
      `${material.titulo}${materiais.length > 1 ? ` +${materiais.length - 1}` : ""}`,
    passo.foco,
  ]
    .filter(Boolean)
    .join(" · ");
  // resumo do registro na linha colapsada: tema (com ferramenta) é a leitura
  // mais rápida; atividades ou reflexões cobrem registro sem tema
  const regPreview = reg
    ? (reg.tema
        ? `${reg.tema}${reg.ferramenta ? ` · ${reg.ferramenta}` : ""}`
        : null) ??
      (reg.atividades.length > 0 ? reg.atividades.join(", ") : null) ??
      reg.reflexoes
    : null;

  const card = (
    <div
      id={encontro ? `registrar-${encontro.id}` : undefined}
      className={cn(
        // border-transparent: a borda fica reservada pro estado; quem desenha
        // a aresta no estado normal é o anel do shadow-border
        "scroll-mt-20 overflow-hidden rounded-xl border border-transparent bg-card shadow-[var(--shadow-border)]",
        reg?.precisa_apoio
          ? "border-[var(--danger)]/50"
          : registroPendente && "border-[var(--warn)]/50"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5",
          registroPendente && "bg-[var(--warn)]/5"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span
            className={cn(
              // disco do nº do encontro — lime cheio = aconteceu; lime de
              // contorno = compromisso firmado (agendado/remarcado); muted =
              // passo do guia ainda sem data; riscado = não aconteceu
              "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums",
              feito
                ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                : naoAconteceu
                  ? "bg-muted text-muted-foreground/60 line-through"
                  : marcado
                    ? "bg-[var(--brand-lime)]/20 text-[var(--brand-ink)] ring-1 ring-[var(--brand-lime)]/60"
                    : "bg-muted text-muted-foreground"
            )}
          >
            {passo.numero}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-2">{passo.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {linha1 || "Data a combinar"}
            </p>
            {linha2 && (
              <p className="mt-0.5 text-xs text-muted-foreground/75 line-clamp-2">
                {linha2}
              </p>
            )}
            {/* o lápis do link entra no gate mesmo sem link/material: um
                agendado SEM link é justamente quem precisa do "adicionar" —
                colado ao entrar/copiar quando eles existem */}
            {(linkSeguro(encontro?.link) || materialHref || podeRemarcar) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {linkSeguro(encontro?.link) &&
                  // entrar é da dupla (e pode virar CTA primário na janela do
                  // encontro); quem monitora copia pra repassar — nunca primário
                  (souMentor ? (
                    <a
                      href={linkSeguro(encontro?.link)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: chamadaAgora ? "default" : "outline",
                        size: "sm",
                      })}
                    >
                      <VideoCamera />
                      Entrar na chamada
                    </a>
                  ) : (
                    <CopiarChamada url={linkSeguro(encontro?.link)!} />
                  ))}
                {podeRemarcar && encontro && (
                  <EditarLinkDialog
                    encontroId={encontro.id}
                    linkAtual={encontro.link}
                  />
                )}
                {materialHref && (
                  <a
                    href={materialHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <BookOpen />
                    Material{materiais.length > 1 ? ` +${materiais.length - 1}` : ""}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
        {temAcoes && (
          // ml-auto ancora as ações à direita do bloco de título mesmo quando o
          // wrap joga o grupo pra linha de baixo no mobile
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {registroPendente && (
              <Badge variant="outline" className="border-[var(--warn)] text-[var(--warn-text)] shrink-0">
                registro pendente
              </Badge>
            )}
            {encontro && !reg && podeEditar &&
              liberadoNoHorario(
                <RegistroInlineTrigger encontroId={encontro.id} primario={!naoAconteceu} />
              )}
            {/* remarcar mora na linha do próprio encontro — vale pro agendado
                futuro E pro já passado (limbo): a action move a fonte passada
                pra um alvo futuro; nº = a tentativa na trilha esp */}
            {podeRemarcar && encontro && (
              <AgendarEncontroDialog
                duplaId={duplaId}
                numero={encontro.numero}
                atual={encontro}
                piso={piso}
                jovemNome={jovemNome}
                rotulo={ehEsp ? "sessão de especialista" : undefined}
                trigger={
                  <Button variant="outline" size="sm">
                    <CalendarBlank size={16} />
                    Remarcar
                  </Button>
                }
              />
            )}
            {/* o botão só vale depois do horário — RevelarApos faz ele aparecer
                pra quem ficou com a aba aberta atravessando o encontro */}
            {encontro?.status === "agendado" && podeMarcar && encontro.data_hora && (
              <RevelarApos from={encontro.data_hora}>
                <NaoAconteceuButton encontroId={encontro.id} duplaId={duplaId} />
              </RevelarApos>
            )}
            {naoAconteceu && podeMarcar && (
              <DesfazerNaoAconteceuButton encontroId={encontro.id} duplaId={duplaId} />
            )}
            {reg?.precisa_apoio && souCoord && (
              <ResolverApoioButton registroId={reg.id} duplaId={duplaId} />
            )}
            {reg?.precisa_apoio && !souCoord && (
              <Badge variant="outline" className="border-[var(--danger)] text-[var(--danger)] shrink-0">
                <HandHeart size={13} /> apoio solicitado
              </Badge>
            )}
            {/* o pedido partiu do mentor — a resposta de coord/sup é chamar
                ele direto, junto do resolver/badge */}
            {reg?.precisa_apoio && (
              <WhatsAppRapido duplaId={duplaId} destinos={apoioDestinos} />
            )}
          </div>
        )}
      </div>

      {/* anotações/plano do encontro — o mentor prepara aqui; pra quem não
          edita (coord/sup, dupla inativa) a nota existente vira leitura */}
      {(podeEditar || nota) && (
        <div className="border-t border-border/60 px-4 py-3">
          <NotaEncontro
            duplaId={duplaId}
            numero={passo.numero}
            nota={nota}
            somenteLeitura={!podeEditar}
          />
        </div>
      )}

      {/* registro salvo = histórico: linha-resumo (apoio, avaliação, tema) +
          disclosure pro corpo completo. Só os mais recentes nascem abertos;
          o deep link #registrar-{id} continua abrindo o bloco */}
      {reg && encontro && (
        <RegistroDetails
          encontroId={encontro.id}
          aberto={registroAberto}
          className="border-t border-border/60 bg-muted/50 shadow-[var(--shadow-inset)]"
          summary={
            <>
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
                Registro
              </span>
              {reg.precisa_apoio && (
                <HandHeart
                  size={13}
                  aria-label="Apoio solicitado"
                  className="shrink-0 text-[var(--danger)]"
                />
              )}
              {reg.avaliacao && <AvaliacaoBadge avaliacao={reg.avaliacao} />}
              {regPreview && (
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {regPreview}
                </span>
              )}
              <CaretDown
                size={13}
                aria-hidden
                className="ml-auto shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
              />
            </>
          }
        >
          <div className="space-y-2 px-4 pb-3.5 pt-1 text-sm">
            <RegistroView
              reg={reg}
              tardio={tardio}
              anexos={
                <AnexosRegistro
                  registroId={reg.id}
                  duplaId={duplaId}
                  autorId={autorId}
                  podeAnexar={podeAnexar}
                  podeRemover={podeRemoverAnexos}
                  anexos={anexos}
                />
              }
            />
            {podeEditar && (
              <div className="pt-1">
                <EditarRegistro
                  encontroId={encontro.id}
                  duplaId={duplaId}
                  evento={passo}
                  registro={reg}
                />
              </div>
            )}
          </div>
        </RegistroDetails>
      )}

      {/* avaliação estrela do jovem (0071) — canal paralelo ao registro do
          mentor: coord/sup leem a linha que a RLS entregou, o mentor DPP só
          a que o jovem liberou ("meu mentor pode ler esta"), e na trilha
          especialista só sobra a estrela da view definer */}
      {feito && encontro?.avaliacao_jovem && (
        <AvaliacaoJovemCard
          avaliacao={encontro.avaliacao_jovem}
          duplaId={duplaId}
          souCoord={souCoord}
          liberadaProMentor={souMentor}
        />
      )}
      {/* pendência do jovem — fato operacional pra coord/sup (o mentor não
          vê: saber que "a do encontro 4 não chegou" o convida a cobrar, e
          a pressão corrói o anonimato que a média protege) */}
      {feito &&
        !encontro?.avaliacao_jovem &&
        !souMentor &&
        estrelaJovem == null && (
          <AvaliacaoPendenteLinha
            link={linkAvaliacao}
            urlBase={urlBase}
            jovemNome={jovemNome}
            jovemWhatsapp={jovemWhatsapp}
            numero={passo.numero}
            souCoord={souCoord}
            jornadaViva={jornadaViva}
          />
        )}
      {/* especialista: só a estrela — a view definer é o recorte inteiro */}
      {feito && estrelaJovem != null && (
        <div className="border-t border-border/60 px-4 py-2.5">
          <EstrelaEspecialistaChip estrelas={estrelaJovem} />
        </div>
      )}

      {encontro && !reg && podeEditar &&
        liberadoNoHorario(
          <RegistroInlinePanel
            encontroId={encontro.id}
            className={cn(
              // região inset do card — poço afundado na superfície, mesma
              // gramática do bloco de reg acima; em registro pendente, a
              // lavagem warn da linha continua aqui
              "border-t border-border/60 px-4 py-4 shadow-[var(--shadow-inset)]",
              registroPendente ? "bg-[var(--warn)]/5" : "bg-muted/50"
            )}
          >
            <RegistroForm
              encontroId={encontro.id}
              duplaId={duplaId}
              evento={passo}
              combinadosPendentes={combinadosPendentes}
            />
          </RegistroInlinePanel>
        )}
    </div>
  );

  // um form de registro aberto por vez: o provider lê o hash #registrar-{id}
  // (mesma âncora do CTA da linha e dos deep-links) e fecha os irmãos
  return encontro && !reg && podeEditar ? (
    <RegistroInline encontroId={encontro.id}>{card}</RegistroInline>
  ) : (
    card
  );
}
