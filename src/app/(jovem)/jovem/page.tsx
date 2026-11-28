import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CaretDown,
  ClockCounterClockwise,
  FileArrowDown,
  Flag,
  FolderOpen,
  Handshake,
  HourglassMedium,
  ListChecks,
  Megaphone,
  ShareNetwork,
  Signature,
  Siren,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { JovemAvaliacoes } from "@/components/jovem-avaliacoes";
import { JovemChamados } from "@/components/jovem-chamados";
import { ContatoLinha } from "@/components/jovem-rede";
import { JovemCombinados } from "@/components/jovem-combinados";
import { JovemRetroativoDialog } from "@/components/jovem-retroativo-dialog";
import { JovemEspecialistas } from "@/components/jovem-especialistas";
import { JovemSecaoRecolhivel } from "@/components/encontro-disclosure";
import {
  JovemParaFazer,
  type EncontroCtx,
} from "@/components/jovem-para-fazer";
import { ProximoEncontro } from "@/components/jovem-proximo-encontro";
import { PedirAjudaLinha } from "@/components/jovem-pedir-ajuda";
import { LembreteDisponibilidade } from "@/components/lembrete-disponibilidade";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  avaliacoesPendentesPorSessao,
  disponibilidadeVazia,
  formatDate,
  formatDateTime,
  formatDiaMes,
  maxEncontros,
  passoEsp,
  progressoTrilha,
  rotuloEncontro as rotuloDoEncontro,
  toDateStr,
} from "@/lib/ciclo";
import { hrefMaterial } from "@/lib/materiais";
import { agrupaContatosPorPessoa } from "@/lib/jovem-contatos";
import {
  datasOficiaisDe,
  encCorrenteDe,
  materialLiberadoParaJovem,
} from "@/lib/jornada";
import {
  getJovemAssinaturas,
  getJovemContatos,
  getJovemDuplas,
  getJovemEncaminhamentos,
  getJovemEncontros,
  getJovemJornada,
  getJovemPedidosEspecialista,
  getJovemPerfil,
  getJovemPlano,
  type JovemEncontro,
} from "@/lib/queries-jovem";
import {
  ocupadosDoJovem,
  sugestoesEncontroDaDupla,
} from "@/lib/sugestoes-encontro-server";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import { getChamados, getChamadoDetalhe } from "@/lib/queries-chamados";
import { chamadoPendencia, derivarPendencias } from "@/lib/pendencias-jovem";
import {
  combinadoDoJovem,
  propostoEmDoPlano,
} from "@/lib/plano-combinado";
import { encontrosPrevistos } from "@/lib/proximo-encontro";
import { getRoteirosPlanos } from "@/lib/queries";
import { materiaisComRoteiroPlano } from "@/lib/plano-roteiros";
import { quemCombinou, suaSemana } from "@/lib/sua-semana";
import { materiaisDoNumero } from "@/lib/materiais";
import { PlanoContestarButton } from "@/components/plano-contestar";
import { SuaSemanaPlano } from "@/components/sua-semana-plano";
import { getComunicados, getMateriais, getMe } from "@/lib/queries";
import type { Disponibilidade, JovemContato } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

// prioridade do aviso — mesma gramática da home de staff (cor nunca sozinha)
const PRIORIDADE = {
  urgente: {
    tinte: "bg-[var(--danger)]/8",
    icone: Siren,
    texto: "Urgente",
    cls: "border-[var(--danger)]/50 text-[var(--danger)]",
  },
  importante: {
    tinte: "bg-[var(--warn)]/10",
    icone: Flag,
    texto: "Importante",
    cls: "border-[var(--warn)]/50 text-[var(--warn-text)]",
  },
  normal: null,
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ordem da home (onda de superfícies): o núcleo "agora" no topo — hero do
// encontro, o que fazer, a linha de ajuda ciente do pedido e a seção #apoio
// (os "Meus pedidos" migraram do perfil pra cá); depois jornada e mentoria
// compactas; e por fim o que é consulta recolhível (combinados, avaliações,
// documentos) — com avisos e o cartão-resumo de materiais fechando a página.
export default async function JovemHome({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  // ?c=<id> abre o detalhe do pedido na âncora #apoio — destino dos e-mails
  // (0084) e do redirect do /jovem/perfil?c= legado; lixo vira lista
  const cSel = c && UUID_RE.test(c) ? c : null;
  const [me, perfil, duplas, contatos, encaminhamentos, assinaturas, encontros, avisos, materiais, avaliacoes, pedidosEsp, planoJovem, jornada, meusChamados, detalheApoio] =
    await Promise.all([
      getMe(),
      getJovemPerfil(),
      getJovemDuplas(),
      getJovemContatos(),
      getJovemEncaminhamentos(),
      getJovemAssinaturas(),
      getJovemEncontros(),
      getComunicados(),
      getMateriais(),
      getJovemAvaliacoes(),
      getJovemPedidosEspecialista(),
      // o plano ancora a janela/o ritmo das sugestões de data (481)
      getJovemPlano().catch(() => null),
      // além do cronograma oficial (a régua do acervo embaixo), a RPC é a
      // auto-cura da jornada — chamar na visita da home já dispara a
      // emissão do que a data oficial abriu (0123)
      getJovemJornada().catch(() => null),
      // os chamados dele (489) — pro mentorado a RLS entrega só os próprios;
      // o detalhe reaproveita a linha da fila (React.cache) em vez de
      // esperar a lista terminar
      getChamados(),
      cSel ? getChamadoDetalhe(cSel) : Promise.resolve(null),
    ]);
  if (!me) return null; // o layout já barra — convenção das páginas

  const nomeTela = me.nome_social || me.nome;
  const primeiroNome = nomeTela.split(" ")[0];
  const agora = new Date();
  const hoje = toDateStr(agora);

  // a dupla "atual" é a DPP ativa/pausada — ela é o eixo da mentoria e o
  // mentor não pode sumir porque uma trilha esp (mais nova) entrou depois;
  // sem DPP viva cai na esp ativa (a mentoria dela é a que está em curso) e
  // por último na mais recente (concluída segue referência de contatos)
  const ativas = duplas.filter(
    (d) => d.status === "ativa" || d.status === "pausada"
  );
  const duplaAtual =
    ativas.find((d) => d.trilha !== "especialista") ??
    ativas[0] ??
    duplas[0] ??
    null;
  const duplaEmCurso = duplaAtual?.status === "ativa" || duplaAtual?.status === "pausada";

  // régua do acervo progressivo (REALIZA-160): a vitrine da home só mostra
  // o que já liberou — material marcado pra encontro futuro não vaza na
  // prévia. Só a dupla DPP ancora (trilha esp tem outra escala, 5 sessões);
  // sem DPP viva → null = acervo livre. A rede de segurança da data
  // oficial (0123) entra quando o cronograma da RPC é desta mesma dupla.
  const encCorrAcervo =
    duplaEmCurso &&
    duplaAtual?.id != null &&
    duplaAtual.trilha !== "especialista"
      ? encCorrenteDe(encontros.filter((e) => e.dupla_id === duplaAtual.id), {
          datasOficiais:
            jornada?.dupla_id === duplaAtual.id
              ? datasOficiaisDe(jornada.cronograma)
              : undefined,
          ativa: duplaAtual.status === "ativa",
          inicio: duplaAtual.iniciada_em,
        })
      : null;
  const materiaisVisiveis = materiais.filter((m) =>
    materialLiberadoParaJovem(m, encCorrAcervo)
  );

  // contatos de TODAS as duplas vivas + a coordenação (dupla_id null na
  // view) — o especialista da trilha esp é contato real, não some porque a
  // "dupla atual" é a DPP
  const idsVivas = new Set(ativas.map((d) => d.id));
  const contatosAtuais = contatos.filter(
    (c) =>
      c.dupla_id == null ||
      idsVivas.has(c.dupla_id) ||
      c.dupla_id === duplaAtual?.id
  );
  // a view repete a pessoa por dupla — dedupe por papel com a dupla mais
  // viva vencendo (mesma régua de /jovem/pessoas; mata a React key
  // duplicada e a linha do supervisor repetida)
  const porDupla = new Map(
    duplas.map((d) => [d.id, { status: d.status, trilha: d.trilha }])
  );
  const porPapel = (papel: string): JovemContato[] =>
    agrupaContatosPorPessoa(
      contatosAtuais.filter((c) => c.papel === papel),
      porDupla
    );
  const mentores = porPapel("mentor");
  // a dupla de especialista entrega papel 'especialista' (0076) — antes
  // caía como 'mentor' e a trilha esp ficava sem contato na home
  const especialistas = porPapel("especialista");
  const supervisores = porPapel("supervisor");
  const coordenacao = porPapel("coordenacao");

  // a régua única do "próximo encontro" (QA 25/11): por data, com fila
  // por dupla — a pendência do 5º da DPP não marca a sessão do
  // especialista; o adiantado sai marcado em vez de ler fora de ordem
  const futuros = encontrosPrevistos(encontros, agora, {
    fila: (e) => e.dupla_id,
    numerosOficiais: (fila) =>
      jornada?.dupla_id === fila
        ? datasOficiaisDe(jornada.cronograma).map((o) => o.numero)
        : [],
  });
  const proximo = futuros[0] ?? null;

  // trilha por dupla (a view jovem_duplas entrega — a tabela `duplas` não é
  // legível pro papel mentorado e o join acontece com o que ele já pode ver)
  const trilhaPorDupla = new Map(duplas.map((d) => [d.id, d.trilha ?? "dpp"]));
  const encPorId = new Map(encontros.map((e) => [e.id, e]));

  // "Sua semana" (520): o combinado "ficar em dia" entra como extensão
  // do hero — a jovem_plano é da mesma dupla DPP viva que ancora a home
  // e a derivação é a MESMA do card do mentor e da fila do staff.
  const realizadosDpp = encontros
    .filter((e) => e.dupla_id === duplaAtual?.id && e.status === "realizado")
    .map((e) => e.numero);
  const combinadoJovem = planoJovem ? combinadoDoJovem(planoJovem) : null;
  // a janela de contestação é a guarda da RPC: um passo do plano feito
  // depois da proposta fecha a contestação. Sem carimbo de proposta não
  // dá pra medir — nesse caso o botão não aparece (não prometer gesto)
  const propostoEm = propostoEmDoPlano(planoJovem);
  const realizadosAposProposta = propostoEm
    ? encontros
        .filter(
          (e) =>
            e.dupla_id === duplaAtual?.id &&
            e.status === "realizado" &&
            e.realizado_em != null &&
            e.realizado_em > propostoEm
        )
        .map((e) => e.numero)
    : realizadosDpp;
  const proximoNumeroDpp =
    proximo != null &&
    proximo.dupla_id === duplaAtual?.id &&
    trilhaPorDupla.get(proximo.dupla_id) !== "especialista"
      ? proximo.numero
      : null;
  const semanaJovem = combinadoJovem
    ? suaSemana({
        plano: combinadoJovem,
        meuLado: "mentorado",
        realizados: realizadosDpp,
        realizadosAposProposta,
        proximoNumero: proximoNumeroDpp,
      })
    : null;
  // "que Fulano combinou": proposto_por é uuid de profiles — resolve
  // pelos contatos que o jovem já enxerga; não achou = "a equipe"
  const nomesContato = new Map(
    contatosAtuais
      .filter((c): c is JovemContato & { id: string } => c.id != null)
      .map((c) => [
        c.id,
        (c.nome_social || c.nome || "").split(" ")[0],
      ])
  );
  const quemPlano = quemCombinou({
    propostoPor: planoJovem?.proposto_por,
    propostoVia: planoJovem?.proposto_via,
    euId: me.id,
    nomesPorId: nomesContato,
  });
  // disclosure do próximo passo: os materiais do número que vem agora,
  // na mesma régua do acervo da home (o que não liberou não aparece)
  const numeroDisclosureJovem =
    semanaJovem?.vinculo ?? semanaJovem?.resumo.proximo?.numero ?? null;
  // roteiro vigente da dupla troca o link do corpus (020) — leitura só,
  // o lazy nasce na agenda e na rota da semana
  const roteirosJovem = planoJovem
    ? await getRoteirosPlanos([planoJovem.id])
    : [];
  const roteiroVigenteJovem =
    numeroDisclosureJovem != null
      ? (roteirosJovem.find(
          (r) =>
            r.plano_id === planoJovem?.id &&
            r.numero === numeroDisclosureJovem &&
            r.status === "publicado" &&
            r.plano_versao === planoJovem?.versao
        ) ?? null)
      : null;
  const materiaisDoPasso = materiaisComRoteiroPlano(
    numeroDisclosureJovem != null
      ? materiaisDoNumero({
          materiais: materiaisVisiveis,
          trilha: "dpp",
          numero: numeroDisclosureJovem,
        })
          .map((m) => ({
            href: hrefMaterial(m, "/jovem/materiais/documento"),
            titulo: m.titulo,
          }))
          .filter((m): m is { href: string; titulo: string } => m.href != null)
      : [],
    roteiroVigenteJovem
      ? {
          numero: roteiroVigenteJovem.numero,
          href: `/jovem/roteiro/${roteiroVigenteJovem.numero}`,
        }
      : null
  );

  // quem aparece no rótulo do encontro: o mentor DPP ou o especialista da
  // trilha (contato com papel 'especialista'; 'mentor' é o legado da DPP)
  const nomeDaDupla = (duplaId: string, esp: boolean): string => {
    const contato = contatosAtuais.find(
      (c) =>
        c.dupla_id === duplaId &&
        (c.papel === "especialista" || c.papel === "mentor")
    );
    const dupla = duplas.find((d) => d.id === duplaId);
    const nome =
      contato?.nome_social ||
      contato?.nome ||
      dupla?.mentor_nome_social ||
      dupla?.mentor_nome ||
      "";
    return nome.split(" ")[0] || (esp ? "seu especialista" : "seu mentor");
  };

  // DPP: "5º encontro com Ricardo". Especialista: "Sessão 3 com Sofia" — o
  // número é o passo do guia (rank entre as tentativas), nunca e.numero.
  const rotuloEncontro = (e: JovemEncontro): string => {
    const esp = trilhaPorDupla.get(e.dupla_id) === "especialista";
    const nome = nomeDaDupla(e.dupla_id, esp);
    const base = rotuloDoEncontro(
      e,
      encontros.filter((x) => x.dupla_id === e.dupla_id),
      { esp }
    );
    return `${base} com ${nome}`;
  };

  // progresso da jornada: encontros realizados por trilha (a contagem não
  // soma mentor e especialista num número só)
  const realizados = encontros.filter((e) => e.status === "realizado");
  const feitosDpp = realizados.filter(
    (e) => trilhaPorDupla.get(e.dupla_id) !== "especialista"
  ).length;
  const feitosEsp = realizados.length - feitosDpp;
  const temDpp = duplas.some((d) => d.trilha !== "especialista");

  // avaliação estrela (0071/018): pendente = sessão realizado sem
  // resposta — o grupo inteiro é uma unidade (sessao_id) e a resposta
  // cai na âncora; `sessao` carrega os nºs pra UI dizer "cobre N passos"
  const avaliacoesPendentes = avaliacoesPendentesPorSessao(
    encontros,
    avaliacoes
  ).map(({ encontro: e, sessao }) => ({
    encontroId: e.id,
    numero: e.numero,
    realizado_em: e.realizado_em,
    trilha: trilhaPorDupla.get(e.dupla_id) ?? "dpp",
    duplaId: e.dupla_id,
    rotulo: rotuloEncontro(e),
    sessao: sessao.length > 1 ? sessao : undefined,
  }));
  // lote da média por dupla (≥3 respostas, FR-003): a copy de privacidade
  // promete média só quando ela existe de fato
  const contagemDpp = new Map<string, number>();
  for (const a of avaliacoes)
    if (trilhaPorDupla.get(a.dupla_id) !== "especialista")
      contagemDpp.set(a.dupla_id, (contagemDpp.get(a.dupla_id) ?? 0) + 1);
  const mediaPorDupla = new Map<string, boolean>(
    [...contagemDpp].map(([d, n]) => [d, n >= 3])
  );
  const avaliacoesFeitas = avaliacoes.map((a) => {
    const enc = encPorId.get(a.encontro_id);
    const trilha = trilhaPorDupla.get(a.dupla_id) ?? "dpp";
    return {
      ...a,
      trilha,
      rotulo: enc
        ? rotuloEncontro(enc)
        : trilha === "especialista"
          ? "Sessão de especialista"
          : a.encontro?.numero
            ? `${a.encontro.numero}º encontro`
            : undefined,
    };
  });

  // agendar: só a DPP ativa agenda (a RPC recusa a trilha esp). O nº é o
  // primeiro livre depois do último realizado — o mesmo critério da agenda.
  const duplaDppId =
    duplas.find((d) => d.status === "ativa" && d.trilha !== "especialista")?.id ??
    null;
  const ocupados = new Set(
    encontros.filter((e) => e.dupla_id === duplaDppId).map((e) => e.numero)
  );
  const livres = duplaDppId
    ? Array.from({ length: maxEncontros("dpp") }, (_, i) => i + 1).filter(
        (n) => !ocupados.has(n)
      )
    : [];
  const maxRealizado = Math.max(
    0,
    ...encontros
      .filter((e) => e.dupla_id === duplaDppId && e.status === "realizado")
      .map((e) => e.numero)
  );
  const numeroAgendar = livres.find((n) => n > maxRealizado) ?? livres[0] ?? null;
  // a sugestão da 481 nasce do mesmo motor da agenda: histórico da dupla +
  // janela do plano + tudo o que já ocupa o jovem nas outras duplas
  const sugestoesAgendar =
    duplaDppId != null
      ? await sugestoesEncontroDaDupla({
          encontros: encontros.filter((e) => e.dupla_id === duplaDppId),
          plano: planoJovem,
          duplaId: duplaDppId,
          agora,
          ocupados: ocupadosDoJovem(encontros, duplas),
        }).catch(() => null)
      : null;
  const agendar =
    duplaDppId != null && numeroAgendar != null
      ? {
          duplaId: duplaDppId,
          numero: numeroAgendar,
          numeros: livres,
          comQuem: nomeDaDupla(duplaDppId, false),
          sugestoes: sugestoesAgendar,
        }
      : null;
  // retroativo (0207+0208): nº sem row, menos o último do ciclo — e só
  // passo oficial JÁ VENCIDO (a RPC recusa os dois casos também). Mesma
  // cautela do acervo: o cronograma vale se é desta mesma dupla.
  const oficiaisRetro =
    jornada?.dupla_id === duplaDppId
      ? datasOficiaisDe(jornada.cronograma)
      : [];
  const vencidosRetro = new Set(
    oficiaisRetro.filter((e) => e.data <= hoje).map((e) => e.numero)
  );
  const numerosRetro = livres.filter(
    (n) => n < maxEncontros("dpp") && vencidosRetro.has(n)
  );

  // a lista única de pendências (REALIZA-493): o motor puro ordena e a
  // home só apresenta — a agenda lê da mesma régua. A entrada estrutural
  // vem das views que a página já buscou; o motor decide o que entra.
  const oficialPorNumero = new Map(
    oficiaisRetro.map((e) => [e.numero, e.data])
  );
  // chamados projetados uma vez: alimentam o motor (andamento da equipe)
  // e a linha "Pedir ajuda" (o vivo em curso)
  const chamadosMotor = meusChamados.itens.map(chamadoPendencia);
  const chamadosVivos = meusChamados.itens
    .filter((c) => c.status === "aberto" || c.status === "em_atendimento")
    .map(chamadoPendencia);
  const ctxPorEncontro: Record<string, EncontroCtx> = Object.fromEntries(
    encontros.map((e) => [
      e.id,
      {
        e,
        ativa: porDupla.get(e.dupla_id)?.status === "ativa",
        esp: trilhaPorDupla.get(e.dupla_id) === "especialista",
      },
    ])
  );
  const pendencias = derivarPendencias({
    hoje,
    agora: agora.toISOString(),
    encontros: encontros.map((e) => {
      const sessao = trilhaPorDupla.get(e.dupla_id) === "especialista";
      return {
        id: e.id,
        numero: sessao
          ? passoEsp(
              e,
              encontros.filter((x) => x.dupla_id === e.dupla_id)
            )
          : e.numero,
        status: e.status,
        dataHora: e.data_hora,
        sessao,
        comQuem: nomeDaDupla(e.dupla_id, sessao),
      };
    }),
    avaliacoes: avaliacoesPendentes.map((p) => ({
      id: p.encontroId,
      rotulo: p.rotulo,
      realizadoEm: p.realizado_em,
      sessao: p.trilha === "especialista",
      cobre: p.sessao?.length,
    })),
    documentos: assinaturas
      .filter((a): a is typeof a & { id: string } => a.id != null)
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        titulo: a.titulo,
        status: a.status,
        token: a.token,
        tokenExpiraEm: a.token_expira_em,
      })),
    combinados: encaminhamentos
      .filter((c): c is typeof c & { id: string } => c.id != null)
      .map((c) => ({
        id: c.id,
        descricao: c.descricao,
        prazo: c.prazo,
        status: c.status,
      })),
    sugestoes: pedidosEsp.solicitacoes
      .filter((s) => s.status === "sugerida")
      .map((s) => ({
        id: s.id,
        sugeridoPor: s.solicitante?.nome_social ?? s.solicitante?.nome,
        especialistaNome:
          s.desejado?.nome_social ?? s.desejado?.nome ?? s.especialista_nome,
        criadoEm: s.created_at,
      })),
    avisos: avisos.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      prioridade: a.prioridade,
      criadoEm: a.created_at,
    })),
    retro: numerosRetro.map((numero) => ({
      numero,
      duplaId: duplaDppId,
      dataOficial: oficialPorNumero.get(numero) ?? null,
    })),
    // a pendência de chamado nasce da trilha pública: "respondeu" só com
    // atualização da equipe; com dono sem resposta vira "cuidando"; aberto
    // sem dono e resolvido são espera/desfecho, não tarefa (régua no mapper)
    chamados: chamadosMotor,
  });

  // a linha "Pedir ajuda" é ciente do pedido em curso: o vivo mais
  // relevante pela mesma régua do motor (resposta > cuidando > espera em
  // aberto — o "aberto sem dono" devolve andamento null, então o vivo se
  // filtra pelo status antes de projetar)
  const pedidoApoio =
    chamadosVivos.find((c) => c.andamento === "resposta") ??
    chamadosVivos.find((c) => c.andamento === "cuidando") ??
    chamadosVivos[0] ??
    null;

  // o lápis "trocar link" do próximo encontro — mesmo recorte da agenda:
  // agendado de dupla ativa e DPP (a RPC do jovem não escreve na trilha esp)
  const linkEditavelProximo =
    proximo != null &&
    proximo.status === "agendado" &&
    duplas.find((d) => d.id === proximo.dupla_id)?.status === "ativa" &&
    (trilhaPorDupla.get(proximo.dupla_id) ?? "dpp") !== "especialista";

  // documentos: pendente com token vencido conta como expirado na UI (a
  // expiração é lazy no banco — quem abre o link carimba, a lista já avisa)
  const docsPendentes = assinaturas.filter(
    (a) =>
      a.status === "pendente" &&
      !(a.token_expira_em && new Date(a.token_expira_em) < agora)
  );
  const docsExpirados = assinaturas.filter(
    (a) =>
      (a.status === "pendente" &&
        a.token_expira_em != null &&
        new Date(a.token_expira_em) < agora) ||
      a.status === "expirado"
  );
  const docsAssinados = assinaturas.filter((a) => a.status === "assinado");
  const docsOutros = assinaturas.filter(
    (a) =>
      !docsPendentes.includes(a) &&
      !docsExpirados.includes(a) &&
      !docsAssinados.includes(a)
  ); // revogado e cia. — raro, mas não pode sumir

  // recolhidos da seção Documentos: tudo que não está pendente
  const docsRecolhidos = [...docsAssinados, ...docsExpirados, ...docsOutros];

  // avisos: urgente e importante à vista; o comum recolhe numa linha
  const avisosDestacados = avisos.filter((a) => a.prioridade !== "normal");
  const avisosComuns = avisos.filter((a) => a.prioridade === "normal");
  const renderAviso = (a: (typeof avisos)[number]) => {
    const prio = PRIORIDADE[a.prioridade];
    const Icone = prio?.icone;
    return (
      <article key={a.id} className={cn("px-4 py-3", prio?.tinte)}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {prio && Icone && (
            <Badge variant="outline" className={prio.cls}>
              <Icone data-icon="inline-start" aria-hidden />
              {prio.texto}
            </Badge>
          )}
          <p className="min-w-0 flex-1 basis-40 text-sm font-medium">
            {a.titulo}
          </p>
          <span className="ms-auto shrink-0 text-xs text-muted-foreground">
            {formatDiaMes(a.created_at)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {a.corpo}
        </p>
      </article>
    );
  };

  // lembrete permanente do "Preencher depois" (REALIZA-114): sem grade o
  // cruzamento da agenda não tem com o que cruzar — a faixa fica até a
  // pessoa preencher no Perfil (quem "pulou" no wizard cai no mesmo estado)
  const gradeVazia =
    perfil != null &&
    disponibilidadeVazia(perfil.disponibilidade as Disponibilidade | null);

  // card-CTA da home: a trilha de especialista mais "viva" — a que tem a
  // próxima sessão mais perto; sem sessão marcada, a mais nova (até 3
  // trilhas podem correr em paralelo, mas o card mostra uma — a página de
  // especialistas lista todas)
  const trilhaResumo = (() => {
    const ativasEsp = duplas.filter(
      (d) =>
        d.trilha === "especialista" &&
        (d.status === "ativa" || d.status === "pausada") &&
        d.id != null
    );
    const comProx = ativasEsp
      .map((d) => {
        const enc = encontros.filter((e) => e.dupla_id === d.id);
        // a próxima sessão marcada; sem ela, a tentativa que cobriria o
        // próximo passo (o passoEsp dá o rank entre realizados nos dois)
        const prox = futuros.find((e) => e.dupla_id === d.id) ?? null;
        const alvo = prox ?? {
          numero: enc.reduce((m, e) => Math.max(m, e.numero), 0) + 1,
          status: "agendado" as const,
        };
        return { d, prox, sessao: passoEsp(alvo, enc) };
      })
      .sort((a, b) => {
        if (a.prox && b.prox)
          return (
            new Date(a.prox.data_hora!).getTime() -
            new Date(b.prox.data_hora!).getTime()
          );
        if (a.prox) return -1;
        if (b.prox) return 1;
        return (b.d.iniciada_em ?? "").localeCompare(a.d.iniciada_em ?? "");
      })[0];
    if (!comProx) return null;
    return {
      tema: comProx.d.demanda ?? "Trilha de especialista",
      espNome:
        (
          comProx.d.mentor_nome_social ||
          comProx.d.mentor_nome ||
          ""
        ).split(" ")[0] || "seu especialista",
      sessao: comProx.sessao,
      proxima: comProx.prox?.data_hora ?? null,
      pausada: comProx.d.status === "pausada",
    };
  })();

  const jornadaTotal = maxEncontros("dpp");
  const jornadaTotalEsp = maxEncontros("especialista");
  const jornadaAtual = temDpp ? feitosDpp : feitosEsp;
  const jornadaMeta = temDpp ? jornadaTotal : jornadaTotalEsp;
  const jornadaPct = Math.min(100, Math.round((jornadaAtual / jornadaMeta) * 100));
  const jornadaTexto = [
    temDpp
      ? `${progressoTrilha({ esp: false, feitos: feitosDpp, total: jornadaTotal })} com seu mentor`
      : null,
    feitosEsp > 0
      ? `${progressoTrilha({ esp: true, feitos: feitosEsp, total: jornadaTotalEsp })} com especialista`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const concluida =
    duplaAtual?.status === "concluida" && duplaAtual.trilha !== "especialista";

  // "Minha mentoria" compacta: no máximo 3 adultos, o mentor da dupla
  // atual primeiro — a rede inteira segue em /jovem/pessoas?papel=rede
  const priorizaAtual = (lista: JovemContato[]) =>
    [...lista].sort(
      (a, b) =>
        Number(b.dupla_id === duplaAtual?.id) -
        Number(a.dupla_id === duplaAtual?.id)
    );
  const contatosResumo = [
    ...priorizaAtual(mentores),
    ...priorizaAtual(especialistas),
    ...priorizaAtual(supervisores),
    ...priorizaAtual(coordenacao),
  ].slice(0, 3);
  const contatosTotal =
    mentores.length +
    especialistas.length +
    supervisores.length +
    coordenacao.length;
  const rotuloContato = (papel: string | null | undefined) =>
    papel === "mentor"
      ? "Seu mentor"
      : papel === "especialista"
        ? "Seu especialista"
        : papel === "supervisor"
          ? "Auxiliar executivo(a) da dupla"
          : "Coordenação do programa";

  // resumo sempre à vista no header recolhível: o que pede gesto fica
  // legível com a seção fechada; sem pendência o caret basta
  const combinadosAbertos = encaminhamentos.filter(
    (c) => c.status !== "feito"
  ).length;
  const resumoCombinados =
    combinadosAbertos > 0
      ? combinadosAbertos === 1
        ? "1 em aberto"
        : `${combinadosAbertos} em aberto`
      : null;
  const resumoAvaliacoes =
    avaliacoesPendentes.length > 0
      ? avaliacoesPendentes.length === 1
        ? "1 esperando"
        : `${avaliacoesPendentes.length} esperando`
      : null;
  const resumoDocs =
    docsPendentes.length > 0
      ? docsPendentes.length === 1
        ? "1 pendente"
        : `${docsPendentes.length} pendentes`
      : null;

  return (
    <div className="grid grid-cols-1 gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Olá, {primeiroNome}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {duplaEmCurso
            ? duplaAtual.trilha === "especialista"
              ? "Seus encontros com o especialista, combinados e próximos passos."
              : "Seus encontros, combinados e próximos passos, num lugar só."
            : "Seus encontros, combinados e próximos passos."}
        </p>
      </header>

      {/* o próximo encontro é o motivo de abrir o app: vem logo depois da
          saudação, com uma única ação conforme o estado */}
      <ProximoEncontro
        proximo={proximo}
        adiantado={
          proximo != null &&
          proximo.adiantado &&
          trilhaPorDupla.get(proximo.dupla_id) !== "especialista"
        }
        rotulo={proximo ? rotuloEncontro(proximo) : null}
        sessao={
          proximo != null
            ? trilhaPorDupla.get(proximo.dupla_id) === "especialista"
            : !temDpp
        }
        hoje={hoje}
        agendar={agendar}
        linkEditavel={linkEditavelProximo}
        emCurso={duplaEmCurso}
        concluida={concluida}
        primeiroNome={primeiroNome}
        plano={
          // "Sua semana" (520): o combinado no MESMO cartão do próximo
          // encontro — nunca um segundo hero
          semanaJovem && duplaAtual ? (
            <SuaSemanaPlano
              semana={semanaJovem}
              perspectiva="jovem"
              outro={
                (duplaAtual.mentor_nome_social ?? duplaAtual.mentor_nome ?? "")
                  .split(" ")[0] || "seu mentor"
              }
              quem={quemPlano}
              combinadoHref="/jovem/combinado"
              responderHref="/jovem/agenda#plano"
              contestar={
                semanaJovem.contestavel && planoJovem ? (
                  <PlanoContestarButton
                    planoId={planoJovem.id}
                    duplaId={duplaAtual.id}
                  />
                ) : null
              }
              materiais={materiaisDoPasso}
            />
          ) : undefined
        }
      />

      {/* pendência da grade — some quando a pessoa preenche (sem ficha não
          tem onde gravar: a faixa nem promete o gesto) */}
      {gradeVazia && <LembreteDisponibilidade />}

      <JovemParaFazer
        pendencias={pendencias}
        encontros={ctxPorEncontro}
        pendentes={avaliacoesPendentes}
        retro={{ duplaId: duplaDppId, numeros: numerosRetro }}
        primeiroNome={primeiroNome}
        mediaPorDupla={mediaPorDupla}
      />

      {/* canal de segurança sempre à mão, sem competir com o encontro: a
          linha é ciente do pedido em curso e leva pra conversa em #apoio */}
      <PedirAjudaLinha
        equipe={coordenacao}
        nomeJovem={primeiroNome}
        pedido={pedidoApoio}
      />

      {/* "Meus pedidos" (0084): a trilha pública dos chamados dele mora na
          home, na âncora #apoio — sem pedidos a seção nem ocupa a tela */}
      <JovemChamados
        itens={meusChamados.itens}
        meuId={me.id}
        meuNome={nomeTela}
        cSel={cSel}
        detalhe={
          detalheApoio?.chamado
            ? {
                chamado: detalheApoio.chamado,
                timeline: detalheApoio.timeline,
                equipe: detalheApoio.equipe,
              }
            : null
        }
      />

      {(temDpp || feitosEsp > 0) && (
        <section
          aria-labelledby="jornada-titulo"
          className="animate-enter"
          style={{ "--i": 2 } as CSSProperties}
        >
          {/* jornada compacta: o progresso inteiro num card de uma linha —
              contexto bom, mas nunca o assunto da visita */}
          <Card>
            <CardContent className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="jornada-titulo" className="text-sm font-semibold">
                  Sua jornada
                </h2>
                <Link
                  href="/jovem/materiais"
                  className="group inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Ver materiais
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
              <div
                role="progressbar"
                aria-label={jornadaTexto}
                aria-valuemin={0}
                aria-valuemax={jornadaMeta}
                aria-valuenow={jornadaAtual}
                className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="fill-grow h-full rounded-full bg-[var(--destaque)]"
                  style={{ width: `${jornadaPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-sm">{jornadaTexto}</p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Minha mentoria compacta — os 3 adultos mais pertinentes (mentor da
          dupla atual primeiro); a rede inteira segue em /jovem/pessoas. */}
      <section aria-labelledby="dupla-titulo">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 id="dupla-titulo" className="flex items-center gap-2 font-semibold">
            <Handshake size={18} className="text-muted-foreground" aria-hidden />
            Minha mentoria
          </h2>
          <Link
            href="/jovem/minha-dupla"
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver minha dupla
          </Link>
        </div>
        {!duplaAtual ? (
          <Card>
            <CardContent className="py-8 text-center">
              <span aria-hidden className="mx-auto inline-flex">
                <span className="size-8 rounded-full bg-[var(--brand-lime)] ring-2 ring-card" />
                <span className="-ml-2.5 size-8 rounded-full bg-[var(--role-mentorado)] ring-2 ring-card" />
              </span>
              <p className="mt-3 font-medium text-foreground">
                Você ainda não tem uma dupla.
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                A coordenação está formando as duplas. Quando a sua estiver
                pronta, seu mentor aparece aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-enter">
            <CardContent className="space-y-3 px-4 py-2">
              {duplaAtual.status === "pausada" && (
                <p className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm">
                  <span className="font-medium">Mentoria pausada.</span> A
                  coordenação retoma quando for a hora. Seus contatos seguem
                  aqui.
                </p>
              )}
              {duplaAtual.status === "concluida" && (
                <p className="rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/8 px-4 py-3 text-sm">
                  <span className="font-medium">Jornada concluída.</span>{" "}
                  Parabéns por chegar até o fim do ciclo!
                </p>
              )}
              <ul className="divide-y divide-border/60">
                {contatosResumo.map((c) => (
                  <ContatoLinha
                    key={`${c.papel}-${c.id ?? c.nome}`}
                    c={c}
                    vinculo={rotuloContato(c.papel)}
                    nomeJovem={nomeTela}
                    compacto
                  />
                ))}
                {!contatosResumo.length && (
                  <li className="py-3 text-sm text-muted-foreground">
                    A equipe aparece aqui quando a coordenação conectar seu
                    cadastro à plataforma.
                  </li>
                )}
              </ul>
              {contatosTotal > contatosResumo.length && (
                <Link
                  href="/jovem/pessoas?papel=rede"
                  className="group inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Ver toda a rede
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Especialistas: só quando pede ação dos casos que o motor não cobre
          (contraproposta ou sessão sem horário) — a sugestão do mentor já
          virou pendência "Ver especialista" no Para fazer, e a home não
          repete a mesma linha duas vezes */}
      <JovemEspecialistas
        disponivel={perfil != null}
        solicitacoes={pedidosEsp.solicitacoes.filter(
          (s) => s.status !== "sugerida"
        )}
        trilha={trilhaResumo}
      />

      {/* Combinados — a lista que o jovem controla, agora recolhida: a
          pendência que pede gesto já está no Para fazer; o contador fica
          no header e a âncora #combinados-titulo abre a seção sozinha */}
      <JovemSecaoRecolhivel
        ancora="combinados-titulo"
        titulo="Meus combinados"
        icone={<ListChecks size={18} className="text-muted-foreground" aria-hidden />}
        resumo={resumoCombinados}
      >
        <Card>
          <CardContent className="px-4 py-0 sm:px-5">
            <JovemCombinados
              itens={encaminhamentos}
              hoje={hoje}
              duplaId={duplaEmCurso ? (duplaAtual?.id ?? null) : null}
            />
          </CardContent>
        </Card>
      </JovemSecaoRecolhivel>

      {/* Suas avaliações (0071) — as pendentes e as duas últimas respondidas;
          o resto recolhe em "Ver todas as avaliações" dentro do componente.
          Com dupla viva a seção entra mesmo vazia: o rodapé explica por que
          um encontro já acontecido pode não aparecer aqui (REALIZA-428) */}
      {(avaliacoesPendentes.length > 0 || avaliacoesFeitas.length > 0 || duplaEmCurso) && (
        <JovemSecaoRecolhivel
          ancora="avaliacoes-titulo"
          titulo="Suas avaliações"
          icone={<Star size={18} className="text-muted-foreground" aria-hidden />}
          resumo={resumoAvaliacoes}
        >
          <Card>
            <CardContent className="p-0">
              <JovemAvaliacoes
                pendentes={avaliacoesPendentes}
                feitas={avaliacoesFeitas}
              />
              {/* retroativo só quando há passo elegível (QW1): o parágrafo
                  que prometia "registre você aqui" sem candidato ensinava
                  um gesto que a RPC recusaria */}
              {duplaEmCurso && duplaDppId && numerosRetro.length > 0 && (
                <div className="border-t border-border/60 px-4 py-1.5 sm:px-6">
                  <JovemRetroativoDialog
                    duplaId={duplaDppId}
                    numeros={numerosRetro}
                    trigger={
                      <Button variant="ghost" size="sm" className="-ml-2.5">
                        <ClockCounterClockwise size={15} aria-hidden />
                        Encontro que não aparece aqui?
                      </Button>
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </JovemSecaoRecolhivel>
      )}

      {/* Documentos pra assinar — o termo é do jovem; a autorização vai pro
          responsável (link tokenizado funciona logado ou não, 0070). A seção
          nasce recolhida: a pendência já está no Para fazer e o contador
          fica no header; pendente à vista, o resto recolhe numa linha. */}
      <JovemSecaoRecolhivel
        ancora="docs-titulo"
        titulo="Documentos"
        icone={<Signature size={18} className="text-muted-foreground" aria-hidden />}
        resumo={resumoDocs}
      >
        <Card>
          <CardContent className="p-0">
            {assinaturas.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Nenhum documento por enquanto. Quando a coordenação emitir o
                seu termo ou a autorização do responsável, eles chegam aqui.
              </p>
            ) : (
              <>
                {docsPendentes.length > 0 && (
                  <div className="divide-y divide-border/60">
                    {docsPendentes.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                        <div className="min-w-0 flex-1 basis-48">
                          <p className="text-sm font-medium">{a.titulo}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {a.slug === "autorizacao-responsavel"
                              ? "Quem assina é seu responsável. Encaminhe o link."
                              : "A assinatura é sua e leva poucos minutos."}
                            {a.token_expira_em && (
                              <> · vale até {formatDate(a.token_expira_em)}</>
                            )}
                          </p>
                        </div>
                        {/* token vem da view (0070: "o token é dele"); sem ele o
                            link não existe — o estado honesto é o do expirado */}
                        {a.token ? (
                          <Link
                            href={`/assinar/${a.token}`}
                            className={cn(
                              buttonVariants({ size: "sm" }),
                              a.slug === "autorizacao-responsavel" &&
                                "border border-border bg-transparent text-foreground shadow-none hover:bg-muted"
                            )}
                          >
                            {a.slug === "autorizacao-responsavel" ? (
                              <ShareNetwork size={15} aria-hidden />
                            ) : (
                              <Signature size={15} aria-hidden />
                            )}
                            {a.slug === "autorizacao-responsavel"
                              ? "Encaminhar para o responsável"
                              : "Assinar"}
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Peça um novo link à coordenação
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {docsRecolhidos.length > 0 && (
                  <details className={cn("group", docsPendentes.length > 0 && "border-t border-border/60")}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                      {docsPendentes.length > 0
                        ? `Ver outros documentos (${docsRecolhidos.length})`
                        : `Ver documentos (${docsRecolhidos.length})`}
                      <CaretDown
                        size={16}
                        aria-hidden
                        className="shrink-0 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="divide-y divide-border/60 border-t border-border/60">
                      {docsAssinados.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                          <div className="min-w-0 flex-1 basis-48">
                            <p className="text-sm font-medium">{a.titulo}</p>
                            <p className="mt-0.5 text-xs text-[var(--ok-text)]">
                              Assinado{a.assinado_em ? ` em ${formatDateTime(a.assinado_em)}` : ""}
                            </p>
                          </div>
                          {/* a via do jovem é a pública por token — a RLS de
                              assinaturas (self+coord) não tem ramo mentorado; a
                              0070 expõe o token na view justamente pra isto */}
                          {a.token && (
                            <a
                              href={`/api/assinar-token/${a.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              <FileArrowDown size={15} aria-hidden />
                              Ver PDF assinado
                              <span className="sr-only"> (abre em nova aba)</span>
                            </a>
                          )}
                        </div>
                      ))}
                      {[...docsExpirados, ...docsOutros].map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                          <div className="min-w-0 flex-1 basis-48">
                            <p className="text-sm font-medium">{a.titulo}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {a.status === "revogado"
                                ? "Este documento foi revogado pela coordenação."
                                : "O prazo deste link terminou. Peça um novo à coordenação."}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-muted-foreground">
                            <HourglassMedium size={13} data-icon="inline-start" aria-hidden />
                            {a.status === "revogado" ? "Revogado" : "Expirado"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </JovemSecaoRecolhivel>

      {/* Avisos da coordenação (audiência 'todos' — a RLS já entrega só o
          que o jovem pode ler). Urgente e importante ficam à vista; os
          comuns recolhem numa linha. */}
      {avisos.length > 0 && (
        // id="avisos": a notificação do aviso aponta pra "/#avisos" — o
        // redirect do (app) devolve pra cá e o fragmento ancora na seção
        <section id="avisos" aria-labelledby="avisos-titulo">
          <h2 id="avisos-titulo" className="mb-2.5 flex items-center gap-2 font-semibold">
            <Megaphone size={18} className="text-muted-foreground" aria-hidden />
            Avisos
          </h2>
          <Card className="animate-enter">
            <CardContent className="p-0">
              {avisosDestacados.map(renderAviso)}
              {avisosComuns.length > 0 && (
                <details
                  className={cn(
                    "group",
                    avisosDestacados.length > 0 && "border-t border-border/60"
                  )}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                    {avisosDestacados.length > 0
                      ? `Ver outros avisos (${avisosComuns.length})`
                      : avisosComuns.length === 1
                        ? "1 aviso da coordenação"
                        : `${avisosComuns.length} avisos da coordenação`}
                    <CaretDown
                      size={16}
                      aria-hidden
                      className="shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="divide-y divide-border/60 border-t border-border/60">
                    {avisosComuns.map(renderAviso)}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Materiais viram um cartão-resumo: a home só diz quantos existem e
          manda pra estante — ler material é consulta, não o "agora". O gate
          progressivo (REALIZA-160) segue na contagem (não anuncia o que o
          acervo ainda não liberou). */}
      {materiaisVisiveis.length > 0 && (
        <Card className="animate-enter">
          <CardContent className="p-0">
            <Link
              href="/jovem/materiais"
              className="group flex min-h-11 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
                <FolderOpen size={15} aria-hidden />
              </span>
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-medium">Materiais de apoio</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {materiaisVisiveis.length}{" "}
                  {materiaisVisiveis.length === 1
                    ? "material liberado"
                    : "materiais liberados"}
                </span>
              </p>
              <ArrowRight
                size={14}
                aria-hidden
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* vazio honesto: sem dupla, sem nada — a home segue útil pelo pedido
          de ajuda e pelos contatos; perfil nulo = vínculo ainda não feito */}
      {!perfil && (
        <p className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm">
          <span className="font-medium">Seu cadastro está sendo conectado.</span>{" "}
          A coordenação ainda não vinculou sua conta à ficha de mentorado. Se
          isso não se resolver em alguns dias, use o “Precisa de ajuda?” acima.
        </p>
      )}
    </div>
  );
}
