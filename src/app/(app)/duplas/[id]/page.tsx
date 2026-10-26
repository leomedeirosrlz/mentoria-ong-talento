import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarBlank,
  CaretDown,
  ChatsCircle,
  ClockCounterClockwise,
  HandHeart,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
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
  getAvaliacaoEspDaDupla,
  getDevolutivasDupla,
  getEspecialistas,
  getPropostas,
  getSlotsLivres,
  getSolicitacoesDaDupla,
} from "@/lib/queries-especialista";
import { getEncerramentoDaDupla, getAvaliacao360DaDupla } from "@/lib/queries-encerramento";
import { getDesfechoDaDupla } from "@/lib/queries-desfecho";
import {
  getAvaliacaoLinks,
  getAvaliacaoMediaDpp,
  getEspecialistaAvaliacoes,
} from "@/lib/queries-avaliacao";
import {
  getSupervisaoAlvos,
  getSupervisoesDaDupla,
} from "@/lib/queries-supervisao";
import { getFormularios, getInstrumentosDaDupla } from "@/lib/forms/queries";
import { getTerceirosDaDupla } from "@/lib/terceiros/queries";
import { getPdmDaDupla, getPdmResumo } from "@/lib/queries-pdm";
import { dadosResumoJornada } from "@/lib/encerramento";
import { getAnexosPorRegistros } from "@/lib/anexos";
import { getUltimasInteracoes } from "@/lib/interacoes";
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
  saudadeDaDupla,
  SITUACAO_MENTORADO_LABEL,
  toDateStr,
  TRILHA_LABEL,
  type PassoGuia,
} from "@/lib/ciclo";
import { msgsContato } from "@/lib/whatsapp-msgs";
import { guiaDoEncontro } from "@/lib/como-conduzir";
import { SemaforoBadge } from "@/components/semaforo";
import { EncaminhamentosList } from "@/components/encaminhamentos-list";
import { NudgeButton } from "@/components/nudge-button";
import { CopiarChamada } from "@/components/copiar-chamada";
import { WhatsAppRapido, type DestinoWA } from "@/components/whatsapp-rapido";
import { DuplaWaAcao } from "@/components/dupla-wa-acao";
import {
  VozDoJovemCard,
  VozDoJovemEspecialista,
} from "@/components/avaliacao-jovem";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { EditarDuplaDialog } from "@/components/editar-dupla-dialog";
import { RemanejoSugerido } from "@/components/remanejo-sugerido";
import { ArquivosDupla } from "@/components/arquivos-dupla";
import { PedirApoioDialog } from "@/components/pedir-apoio-dialog";
import { TrajetoriaAvaliacoes } from "@/components/trajetoria-avaliacoes";
import { SolicitacaoStatusChip } from "@/components/solicitacao-status-chip";
import { SolicitacaoNegociacao } from "@/components/solicitacao-negociacao";
import { DevolutivaComposer } from "@/components/devolutivas-card";
import { TrilhaJornada } from "@/components/trilha-jornada";
import { TrilhaPrazoBadge } from "@/components/trilha-prazo-badge";
import { TrilhaFechamento } from "@/components/trilha-fechamento";
import { EncerramentoDupla } from "@/components/encerramento-dupla";
import { ResumoJornadaSection } from "@/components/resumo-jornada";
import { DesfechoDuplaCard } from "@/components/desfecho-dupla";
import { PdmDupla } from "@/components/pdm-dupla";
import { InstrumentosDupla } from "./instrumentos-dupla";
import { TerceirosDupla } from "./terceiros-dupla";
import { DuplaMaisMenu } from "./mais-menu";
import { DevolutivaEspecialista } from "@/components/devolutiva-especialista";
import { SupervisaoDialog } from "@/components/supervisao-dialog";
import { SupervisoesSection } from "@/components/supervisoes-section";
import { MarcoNotifier } from "@/components/marco-notifier";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { temPapel } from "@/lib/types";
import type { Dupla, Encontro, Material } from "@/lib/types";
import { filaMentorados } from "@/lib/fila";
import {
  ladoDeMentor,
  ladoDeMentorado,
  ranquearMentorados,
  ranquearMentores,
} from "@/lib/remanejo";
import { cn } from "@/lib/utils";
import { turmaLonga } from "@/lib/turma";
import { parseAba } from "./ficha-abas";
import { FichaAbas } from "./ficha-abas-tabs";
import { AbaPorHash } from "./aba-por-hash";
import { EncontroRow } from "./encontro-row";
import { acaoWhatsAppDupla } from "@/lib/acao-lembrete";

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

/** Linha do "Próximo encontro" — o que falta, em linguagem do guia. */
function linhaDoProximo(
  estado: string,
  enc: Encontro | null,
  passo: PassoGuia
): string {
  switch (estado) {
    case "pendente_registro":
      return `Realizado em ${formatDate(enc?.realizado_em ?? enc?.data_hora)}. Falta o registro.`;
    case "limbo":
      return `Agendado para ${formatDateTime(enc?.data_hora)}, já passou: falta confirmar.`;
    case "agendado":
      return `Agendado para ${formatDateTime(enc?.data_hora)}.`;
    case "nao_aconteceu":
      return "Não aconteceu. Remarque quando puder.";
    default:
      return passo.data
        ? `Sugerido pelo guia: ${formatDate(passo.data)}.`
        : "Data a combinar.";
  }
}

export default async function DuplaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { id } = await params;
  const { aba: abaParam } = await searchParams;
  const aba = parseAba(abaParam);
  const [dupla, eventos, me, materiais, anexosPorRegistro, encerramento, supervisoes, instrumentos, terceiros, pdm, alvosSupervisao] =
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
      // avaliação por terceiros (0103, guia sem. 1→2) — só trilha DPP; no
      // paralelo do Promise.all via getDupla cacheado, sem +1 RTT serial
      getDupla(id).then((d) =>
        d?.trilha === "dpp" ? getTerceirosDaDupla(id) : null
      ),
      // o PDM vivo (0109) — uma RPC devolve o documento inteiro; só DPP
      getDupla(id).then((d) =>
        d?.trilha === "dpp" ? getPdmDaDupla(id) : null
      ),
      // alvos de supervisão (0125): diretas + turma dele — o botão "Registrar
      // supervisão" da ficha usa a mesma lista que alimenta o dialog e a
      // action; pra não-supervisor a query nem roda (getMe cacheado + [] )
      getSupervisaoAlvos(),
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
  // quem supervisiona registra a sessão daqui mesmo — alvo único, sem
  // query extra (o dialog ganha mentor+dupla já resolvidos). A lista de
  // alvos já é o escopo 0125 (supervisionada direta ou turma dele, só
  // ativas/pausadas) — estar nela é a permissão inteira
  const podeRegistrarSupervisao = alvosSupervisao.some(
    (a) => a.dupla_id === dupla.id
  );
  const ehEsp = dupla.trilha === "especialista";
  // forms ativos pra "Enviar formulário" da ficha e pro link de avaliação
  // 360º do encerramento — escopo coord (a query já devolve [] pros demais)
  const formulariosAtivos = souCoord
    ? (await getFormularios()).filter((f) => f.ativo)
    : [];
  // data da resposta 360º oficial (0042) — escopo coord: a proveniência do
  // check é detalhe operacional, e a policy de respostas já é coord-only
  const avaliacao360Em = souCoord ? await getAvaliacao360DaDupla(id) : null;
  // resposta individual do "Depois da mentoria" (0124) — escopo coord
  // idem: a policy de links/respostas já barra os demais papéis
  const desfechoEntregas = souCoord ? await getDesfechoDaDupla(id) : [];
  // passos do guia da trilha — ciclo_eventos (DPP, com datas) ou os 5 passos
  // do especialista (sem data: a dupla combina dentro dos 3 meses)
  const espEventos = ehEsp ? await getEspecialistaEventos() : [];
  // avaliação geral pós-fechamento (0104): a RPC entrega o token só pro
  // especialista da trilha e o estado pra coord — a ficha é o caminho de
  // volta quando a notificação se perde
  const avaliacaoEsp =
    ehEsp && dupla.encerrada_em ? await getAvaliacaoEspDaDupla(id) : null;
  // fluxo entre mentores do guia: a demanda de especialista nasce na dupla
  // DPP. O chip conta o estado a quem olha a ficha; o botão some enquanto uma
  // solicitação está aberta (re-pedir é pra quando a anterior se resolveu)
  const solicitacoes = !ehEsp ? await getSolicitacoesDaDupla(id) : [];
  const solicitacao = solicitacoes[0] ?? null;
  // o pedido que ocupa a vaga agora (0074 — "em aberto" inclui triagem e
  // negociação; o status_efetivo já desconta o slot vencido, então um
  // expirado NÃO bloqueia — bate com o dedup do criarSolicitacao).
  // 'sugerida' fica de fora de propósito: é o estágio anterior ao pedido
  // (aguarda o jovem confirmar na página de especialistas, fora dos tetos
  // e do mural, 0086) — não ocupa a vaga nem esconde o "Solicitar".
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
  const agora = new Date();
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

  // ação primária da coordenação e da supervisão: "Lembrar" ou "Chamar",
  // com a mesma regra da lista de duplas (cap de 48h, mensagem do caso).
  // Mentor não chama a si mesmo — o bloco só existe pra quem olha de fora
  const ultimoNudge = !souMentor
    ? ((await getUltimasInteracoes([dupla.id], "nudge"))[dupla.id] ?? null)
    : null;
  const origemLinks = !souMentor
    ? await (async () => {
        const h = await headers();
        return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
      })()
    : undefined;
  const acaoWA = !souMentor
    ? acaoWhatsAppDupla({
        dupla,
        saude,
        hoje: agora,
        ultimoNudge,
        meuNome: me.nome.split(" ")[0],
        tituloNudge: souCoord ? "Lembrete da coordenação" : "Lembrete da supervisão",
        origem: origemLinks,
      })
    : null;

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
  // recorte do PDM pro resumo — mesma RPC já cacheada, deriva sem +1 RTT
  const pdmResumo = !ehEsp ? await getPdmResumo(id) : null;
  const resumoJornada = dadosResumoJornada(
    dupla,
    passos,
    eventosDaDupla,
    encerramento?.created_at ?? dupla.encerrada_em ?? null,
    new Date(),
    pdmResumo
  );
  // bloco só vale a pena com história — dupla zerada mostra a trilha, não um
  // relatório vazio
  const mostrarResumo =
    resumoJornada.realizados > 0 ||
    !!encerramento?.tipo ||
    !!dupla.encerrada_em;

  // concluída pelo automático (0102) com o rito ainda pendente — o mentor
  // segue podendo mexer no registro do último encontro e nos anexos dele
  const ritoPendente =
    dupla.status === "concluida" && encerramento != null && !encerramento.tipo;

  // "reta final" e fechamento: a aba Agora carrega o encerramento só quando a
  // dupla chegou ao fim (penúltimo encontro feito ou já fechada). Fora disso
  // o bloco mora na aba Encontros, sem sumir
  const fechamentoEmFoco =
    dupla.status === "concluida" ||
    dupla.status === "encerrada" ||
    !!dupla.encerrada_em ||
    (!ehEsp && total > 0 && saude.feitos >= total - 1);

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
  // numeroSemana: a semana oficial do ciclo — encontros depois dela entram
  // na lista recolhida; a trilha especialista não tem semana oficial
  const numeroSemana = ehEsp
    ? null
    : (eventoDaSemana(eventosDaDupla, new Date())?.numero ?? null);
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
  const encontrosVisiveis = passosLista.filter(
    (ev) => numeroSemana == null || ev.numero <= numeroSemana
  );
  const encontrosColapsados = encontrosFuturos.filter(
    (ev) => !futurosComPendencia.includes(ev)
  );

  // o encontro atual (próximo passo da jornada) nasce com o registro
  // expandido; os demais viram linha-resumo sob disclosure. Pendências de
  // registro não têm corpo salvo: o form abre pelo CTA da própria linha
  const numeroAtual = jornada.proximoNumero;

  // ações do cabeçalho: UMA primária, conforme o papel e o estado. Mentor:
  // registra a pendência, senão agenda o que falta, senão entra na chamada
  // de hoje. Coordenação e supervisão: Lembrar/Chamar (acaoWA)
  const pendenteRegistro =
    dupla.encontros
      .filter(temPendencia)
      .sort((a, b) => a.numero - b.numero)[0] ?? null;
  // agendar pela ficha é só pra trilha DPP — a sessão de especialista nasce
  // de pedido aceito (0074); aqui o especialista só REMARCA a tentativa que
  // já existe (a action barra criar row nova por esse caminho)
  const podeAgendar =
    souMentor && !ehEsp && saude.feitos < total && dupla.status === "ativa";
  // o próximo encontro já tem data marcada no futuro: nada a agendar agora
  const proximoJaAgendado =
    !!encontroAlvo &&
    (encontroAlvo.status === "agendado" || encontroAlvo.status === "remarcado") &&
    !!encontroAlvo.data_hora &&
    new Date(encontroAlvo.data_hora) > agora;
  const precisaAgendar = podeAgendar && !proximoJaAgendado;
  // a chamada de hoje: encontro agendado com data no dia e link válido
  const chamadaHoje =
    dupla.encontros.find(
      (e) =>
        e.status === "agendado" &&
        !!e.data_hora &&
        toDateStr(new Date(e.data_hora)) === hojeStr &&
        !!linkSeguro(e.link)
    ) ?? null;
  // a tentativa já marcada na trilha esp — remarcável, nunca criável por aqui
  const tentativaAgendada = ehEsp
    ? (dupla.encontros
        .filter((e) => e.status === "agendado" || e.status === "remarcado")
        .sort((a, b) => a.numero - b.numero)[0] ?? null)
    : null;
  const rotuloPendente = ehEsp ? "Registrar sessão" : `Registrar ${pendenteRegistro?.numero}º encontro`;
  // a âncora do registro: na própria aba Encontros é âncora local (dispara
  // hashchange); fora dela leva o ?aba= junto
  const hrefRegistro = pendenteRegistro
    ? `#registrar-${pendenteRegistro.id}`
    : null;
  const hrefRegistroOutraAba = pendenteRegistro
    ? `?aba=encontros#registrar-${pendenteRegistro.id}`
    : null;

  // a primária do mentor (o único botão preenchido do cabeçalho)
  const primarioMentor = !souMentor || dupla.status !== "ativa"
    ? null
    : pendenteRegistro && hrefRegistro
      ? aba === "encontros"
        ? (
          <a href={hrefRegistro} className={buttonVariants({ size: "sm" })}>
            {rotuloPendente}
          </a>
        )
        : (
          <Link
            href={hrefRegistroOutraAba!}
            scroll={false}
            className={buttonVariants({ size: "sm" })}
          >
            {rotuloPendente}
          </Link>
        )
      : precisaAgendar && !ehEsp
        ? (
          <AgendarEncontroDialog
            duplaId={dupla.id}
            numero={proximoNumero}
            atual={encontroAlvo}
            sugerido={sugeridoProximo}
            piso={dupla.iniciada_em ?? undefined}
            jovemNome={primeiroNomeMentorado}
            trigger={
              <Button size="sm">Agendar {proximoNumero}º encontro</Button>
            }
          />
        )
        : chamadaHoje && linkSeguro(chamadaHoje.link)
          ? (
            <a
              href={linkSeguro(chamadaHoje.link)!}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm" })}
            >
              <VideoCamera aria-hidden />
              Entrar na chamada
            </a>
          )
          : null;

  // o encontro atual da jornada — a aba Agora mostra o que fazer nele
  const noAtual = numeroAtual != null
    ? (jornada.nos.find((n) => n.numero === numeroAtual) ?? null)
    : null;
  const passoAtual = numeroAtual != null
    ? (passosLista.find((p) => p.numero === numeroAtual) ?? null)
    : null;
  const encontroAtual: Encontro | null = passoAtual
    ? (ehEsp
        ? (encontroDoPassoEsp(dupla.encontros, passoAtual.numero) ?? null)
        : (dupla.encontros.find((e) => e.numero === passoAtual.numero) ?? null))
    : null;
  const materialAtual = passoAtual
    ? (materiaisPorNumero.get(passoAtual.numero) ?? []).find((m) => m.path || m.url) ?? null
    : null;
  const materialAtualHref = materialAtual
    ? materialAtual.path
      ? `/api/material/${materialAtual.id}`
      : linkSeguro(materialAtual.url)
    : null;
  const notaAtual = passoAtual
    ? (dupla.notas?.find((n) => n.numero === passoAtual.numero)?.texto ?? null)
    : null;
  const guiaAtual = passoAtual && !ehEsp ? guiaDoEncontro(passoAtual.numero) : null;
  // a chamada já aparece como primária no cabeçalho quando é de hoje: a
  // aba Agora não repete o mesmo botão
  const chamadaAtual = linkSeguro(encontroAtual?.link);
  const chamadaNoCabecalho =
    !!chamadaHoje && chamadaHoje.id === encontroAtual?.id && !pendenteRegistro;

  // pedidos em aberto — tudo que espera resposta de alguém nesta ficha
  const apoioAberto = souMentor ? saude.pediuApoio : saude.apoio.aberto;
  const pedidos: ReactNode[] = [];
  if (apoioAberto && dupla.status !== "encerrada" && dupla.status !== "concluida") {
    pedidos.push(
      <p key="apoio" className="flex items-start gap-2.5 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] px-3.5 py-3 text-sm">
        <HandHeart size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--info-text)]" />
        <span>
          <span className="font-medium text-[var(--info-text)]">Apoio aberto.</span>{" "}
          {souMentor
            ? "A coordenação já foi avisada e vai entrar em contato com você."
            : saude.apoio.origem === "mentorado"
              ? "Pedido feito pelo mentorado. Responda pelo WhatsApp da dupla."
              : saude.apoio.origem === "ambos"
                ? "Pedidos feitos pelos dois lados da dupla."
                : "Pedido feito pelo mentor."}
        </span>
      </p>
    );
  }
  if (!ehEsp && solEmAberto) {
    pedidos.push(
      (solEmAberto.status_efetivo ?? solEmAberto.status) === "aguardando_coord" ? (
        <p key="espera" className="rounded-lg bg-muted/50 px-3.5 py-3 text-sm text-muted-foreground">
          Pedido de especialista em triagem na coordenação.
        </p>
      ) : (
        // o pedido em andamento é assunto da ficha: quem abriu (ou a coord)
        // responde a proposta daqui; a thread mostra a mesa
        <div key="negociacao" className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
          <p className="mb-2 text-xs font-semibold text-foreground">Mentor especialista</p>
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
        </div>
      )
    );
  }
  if (!ehEsp && sugestaoPendente) {
    pedidos.push(
      <p key="sugestao" className="rounded-lg bg-muted/50 px-3.5 py-3 text-sm text-muted-foreground">
        Sugestão de especialista enviada ao jovem. Aguardando a resposta dele.
      </p>
    );
  }
  if (sugestaoRemanejo) {
    pedidos.push(
      // risco virou pergunta de trabalho pra coordenação (REALIZA-115):
      // quem pode assumir cada lado, por afinidade — um clique abre o
      // remanejo atômico de sempre com o par já escolhido
      <RemanejoSugerido
        key="remanejo"
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
    );
  }

  // botões do cabeçalho secundários: pedido de apoio do mentor; Editar
  // (coordenação) — o resto vai pro Mais
  const podeEditarDupla = souCoord;

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
        // registro/anexos do mentor seguem abertos na concluída-com-rito-
        // -pendente (0102): o fechamento automático pode nascer de um
        // retroativo sem follow-up, e o registro do 16º continua editável
        podeEditar={souMentor && (dupla.status === "ativa" || ritoPendente)}
        podeMarcar={(souMentor || souCoord) && dupla.status === "ativa"}
        ativa={dupla.status === "ativa"}
        jornadaViva={
          dupla.status === "ativa" || dupla.status === "pausada"
        }
        souCoord={souCoord}
        autorId={me.id}
        // evidência é do mentor — coord só remove (moderação), sup só lê
        podeAnexar={souMentor && (dupla.status === "ativa" || ritoPendente)}
        podeRemoverAnexos={souCoord || (souMentor && (dupla.status === "ativa" || ritoPendente))}
        anexos={(enc?.registro && anexosPorRegistro[enc.registro.id]) || []}
        materiais={materiaisPorNumero.get(passo.numero) ?? []}
        combinadosPendentes={combinadosPendentes}
        nota={dupla.notas?.find((n) => n.numero === passo.numero)?.texto ?? null}
        registroAberto={passo.numero === numeroAtual}
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

  // ---------- aba Agora ----------
  const proximoPassoTexto = noAtual && passoAtual
    ? linhaDoProximo(noAtual.estado, encontroAtual, passoAtual)
    : null;
  const vozVisivel = (souCoord || me.role === "supervisor" || souMentor) &&
    (ehEsp ? souMentor : true);
  const painelAgora = (
    <>
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <TrilhaJornada
          jornada={jornada}
          statusDupla={dupla.status}
          inicioDupla={dupla.iniciada_em}
          duplaId={dupla.id}
        />
      </section>
      {souMentor && <MarcoNotifier duplaId={dupla.id} feitos={jornada.feitos} total={jornada.total} />}

      {ehEsp && dupla.demanda && (
        <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <h2 className="text-base font-semibold">Contexto</h2>
          <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">
            {dupla.demanda}
          </p>
        </section>
      )}
      {ehEsp && !dupla.demanda && (
        <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <h2 className="text-base font-semibold">Contexto</h2>
          <p className="mt-2 text-sm italic text-muted-foreground">
            {souCoord
              ? "Sem contexto registrado. Edite a dupla pra adicionar."
              : "Sem contexto registrado."}
          </p>
        </section>
      )}

      <section
        aria-labelledby="proximo-encontro"
        className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
      >
        <h2 id="proximo-encontro" className="text-base font-semibold">
          Próximo encontro
        </h2>
        {passoAtual && noAtual ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums",
                  noAtual.estado === "agendado"
                    ? "bg-[var(--brand-lime)]/20 text-foreground ring-1 ring-[var(--brand-lime)]/60"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {passoAtual.numero}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{passoAtual.titulo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{proximoPassoTexto}</p>
              </div>
            </div>
            {guiaAtual && (
              <p className="text-sm">
                <span className="font-medium">
                  {souMentor ? "Como conduzir" : "O que cobre"}:
                </span>{" "}
                <span className="text-muted-foreground">
                  {souMentor ? guiaAtual.conduzir : guiaAtual.cobre}
                </span>
              </p>
            )}
            {notaAtual && (
              <div className="rounded-lg bg-muted/50 px-3.5 py-3 text-sm shadow-[var(--shadow-inset)]">
                <p className="text-xs font-semibold text-foreground">
                  Plano do encontro
                </p>
                <p className="mt-1 whitespace-pre-line break-words">{notaAtual}</p>
              </div>
            )}
            {(chamadaAtual && !chamadaNoCabecalho || materialAtualHref) && (
              <div className="flex flex-wrap items-center gap-2">
                {chamadaAtual && !chamadaNoCabecalho &&
                  (souMentor ? (
                    <a
                      href={chamadaAtual}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <VideoCamera aria-hidden />
                      Entrar na chamada
                    </a>
                  ) : (
                    <CopiarChamada url={chamadaAtual} />
                  ))}
                {materialAtualHref && (
                  <a
                    href={materialAtualHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <BookOpen aria-hidden />
                    Material de apoio
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {dupla.status === "ativa"
              ? "Todos os encontros desta jornada já foram realizados."
              : dupla.status === "pausada"
                ? "Jornada pausada. Nenhum encontro está pendente."
                : "Jornada encerrada. Nenhum encontro está pendente."}
          </p>
        )}
      </section>

      {pedidos.length > 0 && (
        <section aria-labelledby="pedidos-abertos" className="space-y-3">
          <h2 id="pedidos-abertos" className="text-base font-semibold">
            Pedidos em aberto
          </h2>
          {pedidos}
        </section>
      )}

      {(dupla.encaminhamentos?.length ?? 0) > 0 && (
        // combinados ficam na Agora: o que a dupla precisa cumprir antes do
        // próximo encontro. O link "ver todos" da home aponta pra cá
        <section
          id="combinados"
          className="scroll-mt-20 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Combinados</h2>
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
          <p className="mb-2 mt-1 text-xs text-muted-foreground">
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

      {fechamentoEmFoco && (
        <>
          {ehEsp && <TrilhaFechamento dupla={dupla} avaliacao={avaliacaoEsp} />}
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
          {mostrarResumo && (
            <ResumoJornadaSection resumo={resumoJornada} encerramento={encerramento} />
          )}
          {souCoord && desfechoEntregas.length > 0 && (
            <DesfechoDuplaCard entregas={desfechoEntregas} />
          )}
        </>
      )}
    </>
  );

  // ---------- aba Encontros ----------
  const painelEncontros = (
    <>
      <section aria-labelledby="lista-encontros" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="lista-encontros" className="text-base font-semibold">
              Encontros
            </h2>
            {/* as datas das linhas são as do guia do ciclo — a dupla confirma
                ou remarca (a real aparece como "agendado {data}" na linha) */}
            <p className="text-xs text-muted-foreground">
              {ehEsp
                ? "Datas combinadas pela dupla"
                : "Datas sugeridas pelo guia"}
            </p>
          </div>
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
          <p className="text-xs italic text-muted-foreground">
            Dupla sem cronograma vinculado: escolha um na edição da dupla.
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

      <ArquivosDupla arquivos={arquivosDaDupla} />

      {ehEsp && (devolutivasFeed.length > 0 || souMentor) && (
        <section aria-labelledby="devolutivas-trilha" className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] space-y-3">
          <h2 id="devolutivas-trilha" className="text-base font-semibold">
            Devolutivas da trilha
          </h2>
          {devolutivasFeed.length > 0 && (
            <ul className="space-y-3">
              {devolutivasFeed.map((v) => (
                <li key={v.id} className="space-y-1">
                  <blockquote className="rounded-lg border-l-2 border-[var(--brand-lime)] bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
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

      {/* fechamento e resumo que não estão na Agora (dupla ainda no meio do
          ciclo): ficam aqui, no fim da lista, sem sumir */}
      {!fechamentoEmFoco && !ehEsp && (
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
      {!fechamentoEmFoco && mostrarResumo && (
        <ResumoJornadaSection resumo={resumoJornada} encerramento={encerramento} />
      )}
      {souCoord && desfechoEntregas.length > 0 && (
        <DesfechoDuplaCard entregas={desfechoEntregas} />
      )}
    </>
  );

  // ---------- aba Instrumentos ----------
  const temInstrumentosDPP = !ehEsp && (instrumentos.length > 0 || !!pdm || !!terceiros);
  const painelInstrumentos = (
    <>
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
      {!ehEsp && pdm && (
        <PdmDupla
          duplaId={dupla.id}
          doc={pdm}
          mentoradoNome={dupla.mentorado.nome}
          podeEditar={
            souMentor &&
            (dupla.status === "ativa" || dupla.status === "pausada")
          }
        />
      )}
      {!ehEsp && terceiros && (
        <TerceirosDupla
          duplaId={dupla.id}
          contatos={terceiros.contatos}
          consolidacao={terceiros.consolidacao}
          mentoradoNome={dupla.mentorado.nome_social ?? dupla.mentorado.nome}
          podeGerenciar={souCoord || souMentor}
          jornadaViva={
            dupla.status === "ativa" || dupla.status === "pausada"
          }
        />
      )}
      {vozVisivel &&
        (ehEsp ? (
          <VozDoJovemEspecialista itens={espAvaliacoes} />
        ) : (
          <VozDoJovemCard
            avaliacoes={dupla.encontros.flatMap((e) =>
              e.avaliacao_jovem ? [e.avaliacao_jovem] : []
            )}
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
      {!temInstrumentosDPP && !vozVisivel && (
        <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Esta trilha não tem instrumentos da jornada DPP.
        </p>
      )}
    </>
  );

  // ---------- aba Pessoas ----------
  const painelPessoas = (
    <>
      <section aria-labelledby="pessoa-mentor" className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <h2 id="pessoa-mentor" className="text-base font-semibold">
          {ehEsp ? "Mentor especialista" : "Mentor"}
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/pessoas/${dupla.mentor.id}`}
            aria-label={`Abrir perfil de ${dupla.mentor.nome}`}
            className="group -my-1.5 flex min-w-0 items-center gap-2.5 rounded-lg py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar
              nome={dupla.mentor.nome}
              src={dupla.mentor.avatar_path ? avatarPublicUrl(dupla.mentor.avatar_path) : null}
              size={32}
            />
            <span className="min-w-0 text-sm font-semibold underline-offset-4 transition-colors group-hover:underline">
              {dupla.mentor.nome}
              {souMentor && <span className="font-normal text-muted-foreground"> · você</span>}
            </span>
          </Link>
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
              ]}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="pessoa-mentorado" className="space-y-2 rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
        <h2 id="pessoa-mentorado" className="text-base font-semibold">
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
              souMentor
                ? {
                    rotulo: "Falar com mentorado",
                    telefone: dupla.mentorado.whatsapp,
                    // o mentor fala como mentor, não como equipe — msg própria
                    mensagem: `Olá ${primeiroNomeMentorado}! Aqui é ${primeiroNomeMentor}, seu mentor no Programa de Mentoria Social.`,
                    t: "contato",
                  }
                : {
                    rotulo: "Chamar mentorado",
                    telefone: dupla.mentorado.whatsapp,
                    mensagem: msgsGenerico.mentorado ?? "",
                    t: "contato",
                  },
            ]}
          />
        )}
        {/* PDM vive no instrumento nativo (0080) — o link externo
            (pdm_url, 0044) foi removido na 0098; PDMs antigos entram
            por importação de materiais. */}
      </section>

      {dupla.supervisor && (
        <section aria-labelledby="pessoa-supervisor" className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
          <h2 id="pessoa-supervisor" className="text-base font-semibold">
            Auxiliar executivo
          </h2>
          <p className="mt-2">{dupla.supervisor.nome}</p>
        </section>
      )}

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

      {!ehEsp && <DevolutivaEspecialista solicitacoes={solicitacoes} />}
    </>
  );

  // a aba ativa decide o que entra na árvore: o servidor só monta o painel
  // escolhido, e o FichaAbas remonta esse painel a cada troca (animate-enter)
  const conteudo =
    aba === "encontros"
      ? painelEncontros
      : aba === "instrumentos"
        ? painelInstrumentos
        : aba === "pessoas"
          ? painelPessoas
          : painelAgora;

  return (
    <div className="space-y-5">
      <div>
        {/* Voltar contextual: link colado cai em /duplas (o mentor tem lista
            própria agora); vindo de dentro do app retorna à origem real */}
        <VoltarLink fallback="/duplas" />
      </div>

      {/* cabeçalho: identidade da dupla, estado com o motivo e uma ação */}
      <header className="relative overflow-hidden rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--brand-lime),var(--role-mentorado))]"
        />
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

        <p className="mt-1.5 text-sm text-muted-foreground">
          {[
            turmaLonga(dupla.turma),
            `Encontro ${jornada.proximoNumero ?? jornada.feitos} de ${total}`,
            dupla.supervisor && `sup. ${dupla.supervisor.nome}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <SemaforoBadge nivel={saude.semaforo} motivo={saude.motivo} />
          {/* pro mentor o próprio pedido de apoio é eixo separado (WP2):
              um chamado já recebido ao lado do semáforo real — o tom é
              "avisamos, relaxa", não alarme */}
          {souMentor && saude.pediuApoio && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--info-text)] sm:text-[11px]">
              <HandHeart size={12} aria-hidden />
              Apoio solicitado
              <span className="font-normal">· a coordenação entra em contato</span>
            </span>
          )}
          {/* apoio aberto é eixo separado do semáforo (WP2): pra equipe a
              jornada pode estar em dia E ter chamado — o pill azul mostra
              o trabalho sem fingir falha da dupla */}
          {!souMentor && saude.apoio.aberto && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--info-text)] sm:text-[11px]">
              <HandHeart size={12} aria-hidden />
              Apoio aberto
              {saude.apoio.origem === "mentorado"
                ? " · do mentorado"
                : saude.apoio.origem === "ambos"
                  ? " · dos dois"
                  : ""}
            </span>
          )}
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
        </div>

        {/* linhagem do remanejo — linha discreta, quieta: é navegação de
            contexto, não alerta (a sucessora carrega a nota de que o
            histórico ficou aqui) */}
        {(origem || sucessora) && (
          <p className="mt-2 text-xs text-muted-foreground">
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
                </Link>
                . Os encontros e registros desta dupla continuam aqui.
              </>
            )}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {souMentor && primarioMentor}
          {!souMentor && acaoWA && <DuplaWaAcao {...acaoWA} />}

          {/* secundárias em outline: o pedido de apoio do mentor; a
              coordenação edita a dupla. O resto mora no Mais */}
          {souMentor && (dupla.status === "ativa" || dupla.status === "pausada") && (
            <PedirApoioDialog
              duplaId={dupla.id}
              trigger={
                <Button variant="outline" size="sm">
                  <HandHeart aria-hidden /> Pedir apoio
                </Button>
              }
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
              trigger={
                <Button variant="outline" size="sm">
                  <CalendarBlank aria-hidden /> Remarcar sessão
                </Button>
              }
            />
          )}
          {podeEditarDupla && <EditarDuplaDialog dupla={dupla} />}

          {/* overflow de segunda ordem — cada prop-grupo presente vira um
              item; os dialogs moram dentro do componente, fora do popup
              (REALIZA-157). Some sozinho quando nenhuma ação se aplica */}
          <DuplaMaisMenu
            duplaId={dupla.id}
            agendar={
              pendenteRegistro && precisaAgendar
                ? {
                    numero: proximoNumero,
                    atual: encontroAlvo,
                    sugerido: sugeridoProximo,
                    piso: dupla.iniciada_em ?? undefined,
                    jovemNome: primeiroNomeMentorado,
                  }
                : null
            }
            formulario={
              souCoord &&
              (dupla.status === "ativa" || dupla.status === "pausada")
                ? {
                    formularios: formulariosAtivos,
                    mentor: {
                      id: dupla.mentor.id,
                      nome: dupla.mentor.nome,
                      whatsapp: dupla.mentor.whatsapp,
                    },
                    mentorado: {
                      id: dupla.mentorado.id,
                      nome: dupla.mentorado.nome,
                      whatsapp: dupla.mentorado.whatsapp,
                    },
                  }
                : null
            }
            solicitar={podeSolicitar ? { especialistas } : null}
            sugerir={
              podeSugerir
                ? {
                    mentoradoId: dupla.mentorado.id,
                    nomeJovem: dupla.mentorado.nome,
                    especialistas,
                  }
                : null
            }
            encerrar={podeEncerrarTrilha}
            remanejar={
              souCoord && (dupla.status === "ativa" || dupla.status === "pausada")
                ? dupla
                : null
            }
          />
        </div>
      </header>

      <AbaPorHash />

      <FichaAbas ativa={aba}>{conteudo}</FichaAbas>
    </div>
  );
}
