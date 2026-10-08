/** Importa a Turma 2 (Gov.BR): cronograma oficial T2 + as 26 duplas do
 *  relatório de pareamento.
 *
 *  Uso:
 *    SUPABASE_SERVICE_ROLE_KEY=... ./node_modules/.bin/jiti scripts/importar-turma2.ts
 *    SUPABASE_SERVICE_ROLE_KEY=... ./node_modules/.bin/jiti scripts/importar-turma2.ts --apply
 *
 *  Sem --apply é dry-run: resolve pessoas e mostra o plano, sem escrever.
 *  Idempotente: cronograma T2 já existente é reutilizado, eventos só
 *  entram se o cronograma estiver vazio, e dupla ativa do mentorado pula.
 *
 *  Split das turmas (confirmado com a coordenação): duplas 1–10 do
 *  relatório são T1 (cronograma '2026/2027', início 08/set); duplas
 *  11–26 são T2 (cronograma novo, início 06/out). `demanda` recebe o
 *  "Eixo da mentoria" do relatório.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normEmail, normNome, parseCsv } from "../src/lib/importar";

const APPLY = process.argv.includes("--apply");
const dirArg = process.argv.find((a) => a.startsWith("--dir="));
const DIR = dirArg?.slice(6) ?? "intake-out";

function envLocal(k: string): string {
  try {
    const m = new RegExp(`^${k}=(.+)$`, "m").exec(
      readFileSync(".env.local", "utf-8")
    );
    return m?.[1].trim() ?? "";
  } catch {
    return "";
  }
}

const URL = process.env.SUPABASE_URL || envLocal("NEXT_PUBLIC_SUPABASE_URL");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL) {
  console.error("SUPABASE_URL ausente (nem env nem .env.local).");
  process.exit(1);
}
if (APPLY && !KEY) {
  console.error("--apply precisa de SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
const supabase = createClient(
  URL,
  KEY || envLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY")
);

// ---------- as 26 duplas do relatório ----------
// mentorado/mentor são os nomes do CSV canônico (matching exato via normNome);
// o nome curto do PDF fica só no comentário.

type Par = { n: number; mentorado: string; mentor: string; eixo: string };

const PARES: Par[] = [
  // T1 — cronograma existente
  { n: 1,  mentorado: "Yaleh Marina de Souza França Nóbrega", mentor: "Stéphanie Maria Moraes dos Santos", eixo: "Transição para tecnologia" },
  { n: 2,  mentorado: "Adrielle Ferreira Souza Dos Santos",   mentor: "Priscila Stuani",                  eixo: "Psicologia social e projetos" },
  { n: 3,  mentorado: "Juliana Novaes de Oliveira",           mentor: "MEIRIANE ARCHANGELO FIUZA",        eixo: "Confiança e preparo para Medicina" },
  { n: 4,  mentorado: "Rafaela Alves dos Santos Pereira",     mentor: "Crislayne Andrade de Araújo",      eixo: "Rotina, vestibular e trabalho" },
  { n: 5,  mentorado: "Louise Macedo de Paula Rocha",         mentor: "Izabel Cristina Manzano Trindade", eixo: "Clareza estratégica e liderança" },
  { n: 6,  mentorado: "Nicolly Jesus Bento Rodrigues",        mentor: "Fernando Toledo Martins",          eixo: "Direcionamento em marketing" },
  { n: 7,  mentorado: "Assis Pires Neto",                     mentor: "Edivaldo Pereira Alves",           eixo: "Perfil profissional e busca de vagas" },
  { n: 8,  mentorado: "Daniel Vieira cordeiro",               mentor: "Kelyng Del Carlo da Silva Coelho", eixo: "Empregabilidade" },
  { n: 9,  mentorado: "Andressa Silva Oliveira",              mentor: "Gustavo Salamoni Gelli",           eixo: "Executar ideias e projeto de vida" },
  { n: 10, mentorado: "clara",                                mentor: "Amilcar Figueiroa Peres dos Santos", eixo: "Direcionamento de estudos" },
  // T2 — cronograma novo
  { n: 11, mentorado: "Tayná Oliveira Gomes",                 mentor: "Elisabeth de Souza Dias",          eixo: "Reorganizar e materializar projetos" },
  { n: 12, mentorado: "juliana yuria da Silva  Matsuda.",     mentor: "Bruna Caroline da Silva",          eixo: "Transição para tecnologia" },
  { n: 13, mentorado: "Cibely Geovane Costa Castro",          mentor: "Patricia Ribeiro de Andrade",      eixo: "Inglês: pronúncia e conversação" },
  { n: 14, mentorado: "Nicolly Albuquerque Ferreira",         mentor: "Isabella Moreira de Sousa Paulo",  eixo: "Inglês, intercâmbio e tecnologia" },
  { n: 15, mentorado: "Gabriela Matos Silva Pardinho",        mentor: "Tainara dos Passos e Silva",       eixo: "Inglês e repertório internacional" },
  { n: 16, mentorado: "Lilian Vicente da Silva",              mentor: "Evelyn Garcia de Paula",           eixo: "Compreensão em inglês, a confirmar" },
  { n: 17, mentorado: "Marcello Santana",                     mentor: "Kelvin Alexandre dos Santos Pedrozo", eixo: "Negócios e negociação internacional" },
  { n: 18, mentorado: "Lucas dos Santos Marques",             mentor: "Daniela Seber Abuhab",             eixo: "Marketing, mídia e criação" },
  { n: 19, mentorado: "Gustavo Cezar Silva Marciano",         mentor: "JULIO CESAR DE ANDRADE ALMEIDA JUNIOR", eixo: "Carreira, intercâmbio e vida adulta" },
  { n: 20, mentorado: "Erik Santos Souza",                    mentor: "João Francisco Lima Almeida Padua", eixo: "Construção de carreira" },
  { n: 21, mentorado: "Eduarda Alves",                        mentor: "Fernanda Armiliato Telles",        eixo: "Preparo para multinacional" },
  { n: 22, mentorado: "Regiane Reis da Leluia",               mentor: "Natalia Carcione",                 eixo: "Confiança e autoestima profissional" },
  { n: 23, mentorado: "Beatriz Santos de Oliveira",           mentor: "Vanessa Carvalho da Costa",        eixo: "Confiança para arriscar" },
  { n: 24, mentorado: "Ana Carolina Nascimento Vieira",       mentor: "Carolina Monteiro Brito",          eixo: "Comunicação e escolha de caminho" },
  { n: 25, mentorado: "Ruthe Victória de Aquino",             mentor: "Rafael Cristino Silva Lucena",     eixo: "Desenvolvimento pessoal" },
  { n: 26, mentorado: "Leila Gomes de Souza",                 mentor: "Bianca Honório de Almeida",        eixo: "Foco e aprendizado" },
];

const TURMA_T1 = "2026/2027";
const TURMA_T2 = "T2 · 2026/2027";
const INICIO_T1 = "2026-09-08"; // 1º encontro oficial da T1
const INICIO_T2 = "2026-10-06"; // 1º encontro oficial da T2

// ---------- cronograma oficial da T2 (fonte: "Mentoria Turma 2 —
//  Plataforma Juventude Solidária.pdf", 28/set/2026) ----------
//  Mesmas 6 fases e instrumentos do percurso T1; o que muda são as datas:
//  3 semanas com encontro duplo na quinta (06→05/11, 11→03/12, 13→10/12)
//  e sem a folga de 15 dias entre 8º e 9º.

type Ev = {
  tipo: string;
  numero?: number;
  data?: string;
  titulo: string;
  fase?: string;
  instrumentos?: string[];
  data_fim?: string;
  status?: string;
  observacao?: string;
  ordem: number;
};

const EVENTOS_T2: Ev[] = [
  // seção 1 — preparação
  { tipo: "etapa_preparacao", titulo: "Triagem e matching", status: "concluida", ordem: 1,
    observacao: "Realizados pela ONG Cidadão Pró-Mundo, com oferta exclusiva à sua base — os jovens chegam com as duplas já formadas" },
  { tipo: "etapa_preparacao", data: "2026-09-28", data_fim: "2026-09-30", titulo: "Confirmação das duplas", status: "concluida", ordem: 2,
    observacao: "Repasse do matching à coordenação, confirmação dos mentores e preparação dos materiais" },
  { tipo: "etapa_preparacao", data: "2026-10-01", data_fim: "2026-10-02", titulo: "Onboarding de mentores", status: "concluida", ordem: 3 },
  { tipo: "formacao", data: "2026-10-01", titulo: "Encontro inicial de formação de mentores", status: "concluida", ordem: 4,
    observacao: "Apresentação do programa, cronograma, guias, termo de voluntariado e cadastro na plataforma" },
  { tipo: "formacao", data: "2026-10-02", titulo: "Encontro final de formação de mentores", status: "concluida", ordem: 5,
    observacao: "Tira-dúvidas e considerações finais" },
  { tipo: "etapa_preparacao", data: "2026-10-01", data_fim: "2026-10-02", titulo: "Onboarding de mentorados", status: "concluida", ordem: 6,
    observacao: "Encontro de abertura com a coordenação em 02/10" },
  { tipo: "etapa_preparacao", data: "2026-10-06", titulo: "Início", status: "concluida", ordem: 7 },
  // seção 2 — mentoria ativa
  { tipo: "encontro", numero: 1,  data: "2026-10-06", titulo: "Boas-vindas, histórias de vida e abertura", fase: "Criar vínculo e construir o PDM",
    instrumentos: ["Perguntas Eficazes", "Escuta Ativa", "PDM", "Roda da Vida (leitura inicial)"], ordem: 8, observacao: "Reposição na mesma semana" },
  { tipo: "encontro", numero: 2,  data: "2026-10-13", titulo: "Avaliação por terceiros e visão de futuro", fase: "Criar vínculo e construir o PDM",
    instrumentos: ["PDM", "Construindo a sua Visão"], ordem: 9 },
  { tipo: "encontro", numero: 3,  data: "2026-10-20", titulo: "Declaração de Visão e metas SMART", fase: "Criar vínculo e construir o PDM",
    instrumentos: ["PDM", "Modelo SMART"], ordem: 10 },
  { tipo: "encontro", numero: 4,  data: "2026-10-27", titulo: "Fechamento da construção do PDM", fase: "Criar vínculo e construir o PDM",
    instrumentos: ["PDM", "Perguntas Eficazes"], ordem: 11 },
  { tipo: "encontro", numero: 5,  data: "2026-11-03", titulo: "Acompanhamento das primeiras submetas", fase: "Colocar o plano em prática",
    instrumentos: ["PDM", "Feedback Construtivo"], ordem: 12 },
  { tipo: "encontro", numero: 6,  data: "2026-11-05", titulo: "Superação de obstáculos", fase: "Colocar o plano em prática",
    instrumentos: ["PDM", "Feedback Construtivo"], ordem: 13, observacao: "Quinta — semana de encontro duplo" },
  { tipo: "encontro", numero: 7,  data: "2026-11-10", titulo: "Ajustes de prazos e desdobramentos", fase: "Colocar o plano em prática",
    instrumentos: ["PDM", "Feedback Construtivo"], ordem: 14 },
  { tipo: "encontro", numero: 8,  data: "2026-11-17", titulo: "Monitoramento e responsabilidade", fase: "Consolidar a autonomia",
    instrumentos: ["PDM", "Escuta Ativa"], ordem: 15 },
  { tipo: "encontro", numero: 9,  data: "2026-11-24", titulo: "Revisão de meio de percurso", fase: "Consolidar a autonomia",
    instrumentos: ["PDM", "Escuta Ativa"], ordem: 16 },
  { tipo: "encontro", numero: 10, data: "2026-12-01", titulo: "O mentor como espelho", fase: "Aprofundar o vínculo e o aprendizado",
    instrumentos: ["Papel de modelo", "Escuta Ativa"], ordem: 17 },
  { tipo: "encontro", numero: 11, data: "2026-12-03", titulo: "Rede de apoio e novos espaços", fase: "Aprofundar o vínculo e o aprendizado",
    instrumentos: ["Papel de modelo", "Escuta Ativa"], ordem: 18, observacao: "Quinta — semana de encontro duplo" },
  { tipo: "encontro", numero: 12, data: "2026-12-08", titulo: "Aplicação e leitura da Roda da Vida", fase: "Roda da Vida",
    instrumentos: ["Roda da Vida", "Modelo SMART"], ordem: 19, observacao: "Feriado municipal em algumas cidades — confirmar local" },
  { tipo: "encontro", numero: 13, data: "2026-12-10", titulo: "Metas das áreas prioritárias", fase: "Roda da Vida",
    instrumentos: ["Roda da Vida", "Modelo SMART"], ordem: 20, observacao: "Quinta — semana de encontro duplo" },
  { tipo: "encontro", numero: 14, data: "2026-12-15", titulo: "Desdobramento e plano de continuidade", fase: "Roda da Vida",
    instrumentos: ["Roda da Vida", "Modelo SMART"], ordem: 21 },
  { tipo: "recesso", data: "2026-12-16", data_fim: "2027-01-04", titulo: "Recesso de fim de ano", ordem: 22,
    observacao: "Sem encontros — retomada na 1ª terça de janeiro" },
  { tipo: "encontro", numero: 15, data: "2027-01-05", titulo: "Reflexão e reconhecimento", fase: "Encerrar e celebrar",
    instrumentos: ["PDM", "Roda da Vida"], ordem: 23 },
  { tipo: "encontro", numero: 16, data: "2027-01-12", titulo: "Encerramento e celebração", fase: "Encerrar e celebrar",
    instrumentos: ["Avaliação 360º", "Autoavaliação do mentor"], ordem: 24 },
  // seção 3 — encerramento
  { tipo: "evento_encerramento", data: "2027-01-15", titulo: "Evento de encerramento do programa", ordem: 25,
    observacao: "Evento único para as Turmas 1 e 2 — avaliação 360º e comunicação aos parceiros" },
];

// ---------- main ----------

const equipe = parseCsv(readFileSync(`${DIR}/equipe.csv`, "utf-8")).linhas;
const mentoradosCsv = parseCsv(
  readFileSync(`${DIR}/mentorados.csv`, "utf-8")
).linhas;
const emailMentor = new Map(equipe.map((l) => [normNome(l.nome), l.email]));
const emailMentorado = new Map(
  mentoradosCsv.map((l) => [normNome(l.nome), l.email])
);

// resolve ids por e-mail (forte) com fallback por nome normalizado
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, nome, email");
const { data: mentorados } = await supabase
  .from("mentorados")
  .select("id, nome, email");
const { data: duplasAtivas } = await supabase
  .from("duplas")
  .select("id, mentor_id, mentorado_id, turma, status, demanda")
  .in("status", ["ativa", "pausada"]);

const profPorEmail = new Map(
  (profiles ?? []).map((p) => [normEmail(p.email ?? ""), p])
);
const profPorNome = new Map(
  (profiles ?? []).map((p) => [normNome(p.nome), p])
);
const mdoPorEmail = new Map(
  (mentorados ?? []).map((m) => [normEmail(m.email ?? ""), m])
);
const mdoPorNome = new Map(
  (mentorados ?? []).map((m) => [normNome(m.nome), m])
);

type DuplaResolvida = {
  n: number;
  mentorId: string;
  mentoradoId: string;
  mentorNome: string;
  mentoradoNome: string;
  eixo: string;
  t2: boolean;
  jaExisteId?: string;
};

const resolvidas: DuplaResolvida[] = [];
const pendentes: string[] = [];

for (const p of PARES) {
  const emailM = emailMentor.get(normNome(p.mentor));
  const emailD = emailMentorado.get(normNome(p.mentorado));
  const prof =
    (emailM ? profPorEmail.get(normEmail(emailM)) : undefined) ??
    profPorNome.get(normNome(p.mentor));
  const mdo =
    (emailD ? mdoPorEmail.get(normEmail(emailD)) : undefined) ??
    mdoPorNome.get(normNome(p.mentorado));
  if (!prof) pendentes.push(`dupla ${p.n}: mentor não achado (${p.mentor})`);
  if (!mdo) pendentes.push(`dupla ${p.n}: mentorado não achado (${p.mentorado})`);
  if (!prof || !mdo) continue;
  const existente = (duplasAtivas ?? []).find(
    (d) => d.mentorado_id === mdo.id || d.mentor_id === prof.id
  );
  resolvidas.push({
    n: p.n,
    mentorId: prof.id,
    mentoradoId: mdo.id,
    mentorNome: prof.nome,
    mentoradoNome: mdo.nome,
    eixo: p.eixo,
    t2: p.n >= 11,
    jaExisteId: existente?.id,
  });
}

console.log(`\n== resolução: ${resolvidas.length} duplas resolvidas`);
for (const p of pendentes) console.log(`  !! ${p}`);

// cronogramas
const { data: cronT1 } = await supabase
  .from("cronogramas")
  .select("id, turma")
  .eq("turma", TURMA_T1)
  .maybeSingle();
const { data: cronT2Existente } = await supabase
  .from("cronogramas")
  .select("id, turma")
  .eq("turma", TURMA_T2)
  .maybeSingle();

if (!cronT1) {
  console.error(`!! cronograma T1 ('${TURMA_T1}') não encontrado`);
  process.exit(1);
}

let cronT2Id = cronT2Existente?.id;
if (!cronT2Id) {
  console.log(
    `\n== cronograma T2 ('${TURMA_T2}'): ${APPLY ? "criando" : "a criar"}`
  );
  if (APPLY) {
    const { data: novo, error } = await supabase
      .from("cronogramas")
      .insert({
        nome: "Calendário oficial — Turma 2",
        turma: TURMA_T2,
        inicio_em: "2026-09-28",
        fim_em: "2027-01-15",
        encontros_esperados: 16,
        status: "ativo",
      })
      .select("id")
      .single();
    if (error) {
      console.error("falha ao criar cronograma T2:", error.message);
      process.exit(1);
    }
    cronT2Id = novo.id;
  }
}
// eventos: idempotente — só insere se o cronograma ainda estiver vazio
if (!cronT2Id && !APPLY) {
  console.log(`== a inserir ${EVENTOS_T2.length} eventos no cronograma T2`);
} else if (cronT2Id) {
  const { count } = await supabase
    .from("ciclo_eventos")
    .select("id", { count: "exact", head: true })
    .eq("cronograma_id", cronT2Id);
  if ((count ?? 0) > 0) {
    console.log(`== cronograma T2 já tem ${count} eventos — não mexido`);
  } else {
    console.log(
      `== ${APPLY ? "inserindo" : "a inserir"} ${EVENTOS_T2.length} eventos no cronograma T2`
    );
    if (APPLY) {
      const { error: evErr } = await supabase.from("ciclo_eventos").insert(
        EVENTOS_T2.map((e) => ({
          numero: null,
          data: null,
          fase: null,
          instrumentos: [],
          data_fim: null,
          status: "pendente",
          observacao: null,
          ...e,
          cronograma_id: cronT2Id,
        }))
      );
      if (evErr) {
        console.error("falha ao inserir eventos T2:", evErr.message);
        process.exit(1);
      }
      console.log(`  ok ${EVENTOS_T2.length} eventos`);
    }
  }
}

// duplas
let criadas = 0;
for (const d of resolvidas) {
  if (d.jaExisteId) {
    console.log(`  >> dupla ${d.n} ${d.mentoradoNome} ↔ ${d.mentorNome}: já existe`);
    continue;
  }
  const row = {
    turma: d.t2 ? TURMA_T2 : TURMA_T1,
    mentor_id: d.mentorId,
    mentorado_id: d.mentoradoId,
    status: "ativa",
    trilha: "dpp",
    iniciada_em: d.t2 ? INICIO_T2 : INICIO_T1,
    cronograma_id: d.t2 ? cronT2Id : cronT1.id,
    demanda: d.eixo,
  };
  if (!APPLY) {
    console.log(
      `  + dupla ${d.n} [${row.turma}] ${d.mentoradoNome} ↔ ${d.mentorNome} — ${d.eixo}`
    );
    continue;
  }
  const { error } = await supabase.from("duplas").insert(row);
  if (error) {
    console.log(`  !! dupla ${d.n} falhou: ${error.message}`);
    continue;
  }
  criadas++;
}

console.log(
  `\n== fim (${APPLY ? "APLICADO" : "dry-run"}) — ${criadas} duplas criadas`
);
