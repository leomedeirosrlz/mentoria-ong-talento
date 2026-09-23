// Conteúdo canônico dos documentos de assinatura — a MESMA fonte alimenta o
// preview na tela e o PDF final (src/lib/documentos/pdf.ts), então o texto
// nunca diverge entre o que a pessoa leu e o que ela assinou.
//
// O texto do termo é fiel ao docx oficial (docs/fontes/termo-adesao-voluntario.txt)
// — a única mudança é trocar os dados civis por placeholders preenchidos no
// ato da assinatura. Se o jurídico alterar o termo, muda aqui e sobe a
// `versao` do template em documento_templates.

import type { Assinatura, DadosAutorizacao, DadosCivis, Endereco } from "../types";
import { normaliza } from "../utils";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "São Paulo, 7 de agosto de 2024" — cidade fixa do instituto (decisão:
 *  não usar a cidade do signatário). */
export function dataPorExtenso(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `São Paulo, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const caixaAlta = (s: string) => s.toUpperCase();

const cpfFmt = (cpf: string) =>
  cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

export function enderecoLinha(e: Endereco): string {
  const comp = e.complemento ? ` ${e.complemento}` : "";
  const cep = e.cep.replace(/(\d{5})(\d{3})/, "$1-$2");
  return `${e.logradouro} ${e.numero}${comp} - ${e.bairro} - ${e.cidade} - ${e.uf} - CEP ${cep}`;
}

// ---------- Termo de Adesão ao Trabalho Voluntário ----------

export const TERMO_TITULO = "TERMO DE ADESÃO AO TRABALHO VOLUNTÁRIO";

/** Parágrafo de qualificação com os dados civis do signatário — em caixa
 *  alta como no docx oficial. */
export function preambuloTermo(d: DadosCivis): string[] {
  return [
    "Pelo presente instrumento particular e na melhor forma de direito, de um lado, o Instituto Realiza Você, estabelecido na Rua dos Pinheiros n. 706 Casa 6 andar 2, inscrita no CNPJ/ME sob o nº 53.034.217/0001-89, denominado simplesmente Realiza.vc.",
    `E, de outro lado, ${caixaAlta(d.nome_civil)}, portador(a) da Cédula de Identidade RG nº ${d.rg} e inscrito(a) no CPF/ME sob o nº ${cpfFmt(d.cpf)}, domiciliado(a) na ${enderecoLinha(d.endereco)}, doravante denominada simplesmente “VOLUNTÁRIO(A)”; RESOLVEM FIRMAR entre si o presente Termo de Adesão ao Trabalho Voluntário (“Termo”), que se regerá pelas cláusulas seguintes e pelas condições a seguir descritas.`,
  ];
}

/** Cláusulas numeradas — [título, parágrafos]. Fiel ao docx oficial. */
export const CLAUSULAS_TERMO: readonly (readonly [string, string[]])[] = [
  ["1. OBJETO", [
    "1.1. O trabalho voluntário previsto no presente TERMO será desempenhado segundo a Lei nº 9.608 de 18/02/98 (Anexo I), cujo inteiro teor o(a) VOLUNTÁRIO(A) está ciente e de acordo.",
    "1.2. Pela adesão ao presente Trabalho Voluntário, o(a) VOLUNTÁRIO(A) desempenhará as seguintes atividades e nas seguintes condições: atuar como mentor de jovens de baixa renda e/ou em situação de vulnerabilidade social, em consonância com a metodologia de mentoria do programa Mentoria Social do Realiza.vc, por meio de ferramentas de reunião on-line, contando com suporte das equipes do Realiza.vc para o bom desempenho de sua função.",
  ]],
  ["2. CONDIÇÕES DA PRESTAÇÃO DO TRABALHO VOLUNTÁRIO", [
    "2.1. O Trabalho a ser prestado pelo(a) VOLUNTÁRIO(A) previsto no presente TERMO ocorrerá de forma gratuita (sem remuneração), para finalidades sociais, sendo de livre e espontânea vontade a sua prestação.",
    "2.2. O Trabalho Voluntário ora ajustado não cria vínculo de emprego entre as partes e tampouco gera obrigações trabalhistas, previdenciárias, tributárias e/ou afins, incluindo, sem se limitar, a eventuais horas extras a seu empregador, caso o serviço de voluntariado seja prestado durante o seu horário de trabalho.",
    "2.3. Na hipótese de o desempenho das atividades voluntárias acarretarem danos à INSTITUIÇÃO e/ou terceiros, decorrentes de dolo ou culpa do(a) VOLUNTÁRIO(A), o(a) VOLUNTÁRIO(A) se sujeitará a arcar com os consequentes prejuízos.",
  ]],
  ["3. MATERIAIS NECESSÁRIOS E REEMBOLSO DE DESPESAS", [
    "3.2. Eventuais despesas com alimentação, deslocamento, equipamentos/recursos de tecnologia e outros são de inteira responsabilidade do(a) VOLUNTÁRIO(A).",
  ]],
  ["4. PRAZO E RESCISÃO", [
    "4.1. O presente Termo de Adesão entra em vigor na data de sua assinatura e vigora por tempo indeterminado, podendo ser rescindido a qualquer tempo, mediante simples comunicação escrita de uma parte a outra, não acarretando qualquer ônus para ambas.",
  ]],
  ["5. SIGILO, CONFIDENCIALIDADE E PROTEÇÃO DE DADOS PESSOAIS", [
    "5.1. O(A) VOLUNTÁRIO(A) obriga-se a manter sigilo e confidencialidade, comprometendo-se a não utilizar as informações confidenciais a que tiver acesso, para gerar benefício próprio exclusivo e/ou unilateral, presente ou futuro, ou para o uso de terceiros, sob pena de pagar indenização por perdas e danos a favor do Realiza.vc e/ou do jovem mentorado.",
    "5.2. Desde já, o VOLUNTÁRIO se compromete, sempre que aplicável, a atuar em conformidade com a legislação vigente sobre Proteção de Dados Pessoais e as determinações de órgãos reguladores/fiscalizadores sobre a matéria, em especial a Lei n° 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (“LGPD”), bem como a Lei n° 12.965/2014 — Marco Civil da Internet (“MCI”) e a Lei n° 10.406/2020 - Código Civil (“CC”).",
  ]],
];

export const FECHO_TERMO =
  "E, assim, por estarem justas e acertadas, formalizam as partes o presente TERMO DE ADESÃO AO SERVIÇO VOLUNTÁRIO, assinado em 2 (duas) vias de igual teor.";

export const ANEXO_I_TITULO = "Anexo I — LEI Nº 9.608, DE 18 DE FEVEREIRO DE 1998";

export const ANEXO_I_PARAGRAFOS: readonly string[] = [
  "Dispõe sobre o serviço voluntário e dá outras providências.",
  "O PRESIDENTE DA REPÚBLICA Faço saber que o Congresso Nacional decreta e eu sanciono a seguinte Lei:",
  "Art. 1º Considera-se serviço voluntário, para fins desta Lei, a atividade não remunerada, prestada por pessoa física a entidade pública de qualquer natureza, ou a instituição privada de fins não lucrativos, que tenha objetivos cívicos, culturais, educacionais, científicos, recreativos ou de assistência social, inclusive mutualidade.",
  "Parágrafo único. O serviço voluntário não gera vínculo empregatício, nem obrigação de natureza trabalhista previdenciária ou afim.",
  "Art. 2º O serviço voluntário será exercido mediante a celebração de termo de adesão entre a entidade, pública ou privada, e o prestador do serviço voluntário, dele devendo constar o objeto e as condições de seu exercício.",
  "Art. 3º O prestador do serviço voluntário poderá ser ressarcido pelas despesas que comprovadamente realizar no desempenho das atividades voluntárias.",
  "Parágrafo único. As despesas a serem ressarcidas deverão estar expressamente autorizadas pela entidade a que for prestado o serviço voluntário.",
  "Art. 4º Esta Lei entra em vigor na data de sua publicação.",
  "Art. 5º Revogam-se as disposições em contrário.",
  "Brasília, 18 de fevereiro de 1998; 177º da Independência e 110º da República.",
  "FERNANDO HENRIQUE CARDOSO",
  "Paulo Paiva",
];

export const CONTRA_SIGNATARIO = {
  nome: "Leandro Rito Bastos",
  cargo: "Presidente",
  instituicao: "Instituto Realiza.vc",
} as const;

// ---------- Autorização do Responsável (mentorado) ----------
// RASCUNHO — não existe fonte oficial em docs/fontes. Texto mínimo para
// revisão jurídica antes de produção.

export const AUTORIZACAO_TITULO = "AUTORIZAÇÃO DO RESPONSÁVEL LEGAL";

export function preambuloAutorizacao(d: DadosAutorizacao): string[] {
  const r = d.responsavel;
  return [
    `Eu, ${caixaAlta(r.nome_civil)}, portador(a) da Cédula de Identidade RG nº ${r.rg} e inscrito(a) no CPF/ME sob o nº ${cpfFmt(r.cpf)}, domiciliado(a) na ${enderecoLinha(r.endereco)}, na qualidade de ${r.parentesco} do(a) jovem ${caixaAlta(d.mentorado_nome)}, doravante denominado(a) RESPONSÁVEL,`,
    "AUTORIZO, por meio do presente instrumento, a participação do(a) jovem acima identificado(a) no programa de mentoria social do Instituto Realiza Você (Realiza.vc), nas condições seguintes:",
  ];
}

export const CLAUSULAS_AUTORIZACAO: readonly (readonly [string, string[]])[] = [
  ["1. DO PROGRAMA", [
    "1.1. O(a) jovem participará de encontros individuais de mentoria realizados por meio de ferramentas on-line, conduzidos por voluntário(a) cadastrado(a) e acompanhado(a) pela equipe do Realiza.vc.",
    "1.2. A participação é gratuita e voluntária, podendo ser interrompida a qualquer tempo por solicitação do(a) RESPONSÁVEL ou do(a) próprio(a) jovem, sem qualquer ônus.",
  ]],
  ["2. DOS DADOS PESSOAIS", [
    "2.1. O(a) RESPONSÁVEL autoriza o tratamento dos dados pessoais do(a) jovem estritamente para as finalidades do programa (seleção de mentor, acompanhamento pedagógico e segurança), nos termos da Lei nº 13.709/2018 (LGPD).",
    "2.2. O Realiza.vc compromete-se a não compartilhar os dados com terceiros para fins alheios ao programa e a adotar medidas de segurança para sua proteção.",
  ]],
  ["3. DA VIGÊNCIA", [
    "3.1. Esta autorização vigora enquanto durar a participação do(a) jovem no programa e pode ser revogada a qualquer momento mediante comunicação escrita ao Realiza.vc.",
  ]],
];

export const FECHO_AUTORIZACAO =
  "E, por estar de acordo, o(a) RESPONSÁVEL firma o presente instrumento por meio eletrônico.";

// ---------- Termo de Adesão e Participação (mentorado) ----------
// Fiel ao PDF oficial "Termo de Adesão e Participação — Programa de
// Mentoria Social" (2 páginas, set/2026). Sem anexo de lei — as cláusulas
// já fecham o documento. Quem assina é o(a) próprio(a) jovem; pra menor de
// idade a coordenação emite a autorização do responsável no lugar.

export const MENTORANDO_TITULO =
  "TERMO DE ADESÃO E PARTICIPAÇÃO NO PROGRAMA DE MENTORIA SOCIAL";

/** Mesma qualificação do termo do voluntário, mas o outro lado é o jovem. */
export function preambuloMentorando(d: DadosCivis): string[] {
  return [
    "Pelo presente instrumento, de um lado, o Instituto Realiza Você, estabelecido na Rua dos Pinheiros n. 706, Casa 6, andar 2, inscrito no CNPJ/ME sob o nº 53.034.217/0001-89, denominado simplesmente “Realiza.vc”.",
    `E, de outro lado, ${caixaAlta(d.nome_civil)}, portador(a) do RG nº ${d.rg} e inscrito(a) no CPF/ME sob o nº ${cpfFmt(d.cpf)}, domiciliado(a) em ${enderecoLinha(d.endereco)}, doravante denominado(a) simplesmente “MENTORANDO(A)”,`,
    "RESOLVEM formalizar a participação no Programa de Mentoria Social do Realiza.vc, mediante as cláusulas e condições a seguir descritas.",
  ];
}

export const CLAUSULAS_MENTORANDO: readonly (readonly [string, string[]])[] = [
  ["1. OBJETO", [
    "1.1. O presente Termo tem por objeto formalizar a adesão e a participação do(a) MENTORANDO(A) no Programa de Mentoria Social do Realiza.vc, iniciativa de caráter social, educacional e de desenvolvimento pessoal e profissional.",
    "1.2. A participação compreenderá encontros de mentoria, atividades de desenvolvimento, orientações, trocas de experiências e demais ações relacionadas à metodologia do programa, realizadas presencialmente e/ou por meio de ferramentas de reunião on-line.",
    "1.3. O(A) MENTORANDO(A) declara estar ciente de que a mentoria possui finalidade educativa e de desenvolvimento, não constituindo relação de emprego, estágio, prestação de serviços ou qualquer outra relação trabalhista com o Realiza.vc ou com o(a) mentor(a).",
  ]],
  ["2. CONDIÇÕES DE PARTICIPAÇÃO", [
    "2.1. A participação no Programa é voluntária, gratuita e destinada ao desenvolvimento do(a) MENTORANDO(A), não havendo cobrança de valores pela participação.",
    "2.2. O(A) MENTORANDO(A) compromete-se a participar dos encontros e atividades com respeito, responsabilidade, pontualidade e disposição para o processo de aprendizagem.",
    "2.3. O(A) MENTORANDO(A) deverá comunicar, sempre que possível, eventual impossibilidade de comparecimento aos encontros previamente agendados.",
    "2.4. O(A) MENTORANDO(A) reconhece que o programa depende da participação ativa, do diálogo e da construção conjunta entre mentor(a) e mentorando(a), respeitando os limites e objetivos estabelecidos pela metodologia do programa.",
    "2.5. O(A) MENTORANDO(A) poderá interromper sua participação no programa a qualquer momento, mediante comunicação à equipe responsável, sem cobrança de qualquer ônus.",
  ]],
  ["3. RESPONSABILIDADES DO(A) MENTORANDO(A)", [
    "3.1. São responsabilidades do(a) MENTORANDO(A):",
    "a) participar dos encontros e atividades acordados;",
    "b) tratar mentores, equipe e demais participantes com respeito;",
    "c) manter comunicação adequada com o(a) mentor(a) e com a equipe do Realiza.vc;",
    "d) preservar o caráter confidencial de informações pessoais ou profissionais compartilhadas durante o processo de mentoria;",
    "e) utilizar de forma responsável os materiais, links e recursos disponibilizados pelo programa.",
    "3.2. O(A) MENTORANDO(A) compromete-se a não utilizar os encontros, contatos ou informações obtidas no programa para fins ilícitos, ofensivos, discriminatórios ou que possam causar prejuízo a terceiros.",
  ]],
  ["4. MATERIAIS, EQUIPAMENTOS E DESPESAS", [
    "4.1. Quando os encontros forem realizados de forma on-line, o(a) MENTORANDO(A) deverá, sempre que possível, utilizar equipamento e conexão adequados à sua participação.",
    "4.2. Eventuais despesas pessoais relacionadas a deslocamento, alimentação, equipamentos ou conexão serão de responsabilidade do(a) MENTORANDO(A), salvo quando houver orientação ou apoio específico previamente informado pelo Realiza.vc.",
  ]],
  ["5. SIGILO, CONFIDENCIALIDADE E PROTEÇÃO DE DADOS PESSOAIS", [
    "5.1. O(A) MENTORANDO(A) compromete-se a preservar a confidencialidade das informações pessoais, familiares, profissionais ou de qualquer outra natureza que sejam compartilhadas por mentores, outros participantes ou pela equipe do Realiza.vc no contexto do programa.",
    "5.2. O tratamento de dados pessoais relacionados à participação no programa deverá observar a legislação aplicável, em especial a Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD), bem como as demais normas pertinentes.",
    "5.3. O(A) MENTORANDO(A) compromete-se a não divulgar, publicar ou compartilhar, sem autorização, mensagens, documentos, imagens, dados pessoais ou outros conteúdos privados aos quais tenha acesso em razão da participação no programa.",
  ]],
  ["6. PRAZO E ENCERRAMENTO DA PARTICIPAÇÃO", [
    "6.1. O presente Termo entra em vigor na data de sua assinatura e permanecerá válido durante o período de participação do(a) MENTORANDO(A) no Programa de Mentoria Social.",
    "6.2. A participação poderá ser encerrada a qualquer momento pelo(a) MENTORANDO(A) ou pelo Realiza.vc, mediante comunicação, observadas as orientações da equipe responsável pelo programa.",
  ]],
  ["7. DISPOSIÇÕES FINAIS", [
    "7.1. O(A) MENTORANDO(A) declara que leu e compreendeu as condições deste Termo e que participa do programa de forma livre e consciente.",
    "7.2. Este Termo formaliza a participação no Programa de Mentoria Social e não estabelece vínculo empregatício, societário, de estágio ou de prestação de serviços entre o(a) MENTORANDO(A) e o Realiza.vc.",
  ]],
];

export const FECHO_MENTORANDO =
  "E, assim, por estarem de acordo, as partes formalizam o presente Termo de Adesão e Participação.";

/** Blanks do preview — o que falta aparece como linha, como no papel. */
export const CIVIS_EM_BRANCO: DadosCivis = {
  nome_civil: "______________________________________________",
  rg: "__________________",
  cpf: "___.___.___-__",
  data_nascimento: null,
  endereco: {
    logradouro: "________________________",
    numero: "______",
    complemento: null,
    bairro: "________________",
    cidade: "________________",
    uf: "____",
    cep: "_____-___",
  },
};

/** Sobrepõe o que já está na ficha (parcial ok) sobre os blanks — o preview
 *  do documento mostra exatamente o que será emitido (prefill de 0046). */
export function civisPreview(c: Partial<DadosCivis> | null | undefined): DadosCivis {
  if (!c) return CIVIS_EM_BRANCO;
  const e = c.endereco;
  const ou = (v: string | null | undefined, blank: string) =>
    v && v.trim() ? v : blank;
  return {
    nome_civil: ou(c.nome_civil, CIVIS_EM_BRANCO.nome_civil),
    rg: ou(c.rg, CIVIS_EM_BRANCO.rg),
    cpf: ou(c.cpf, CIVIS_EM_BRANCO.cpf),
    data_nascimento: c.data_nascimento ?? null,
    endereco: {
      logradouro: ou(e?.logradouro, CIVIS_EM_BRANCO.endereco.logradouro),
      numero: ou(e?.numero, CIVIS_EM_BRANCO.endereco.numero),
      complemento: e?.complemento ?? null,
      bairro: ou(e?.bairro, CIVIS_EM_BRANCO.endereco.bairro),
      cidade: ou(e?.cidade, CIVIS_EM_BRANCO.endereco.cidade),
      uf: ou(e?.uf, CIVIS_EM_BRANCO.endereco.uf),
      cep: ou(e?.cep, CIVIS_EM_BRANCO.endereco.cep),
    },
  };
}

// ---------- helpers de tipo ----------

/** Templates que a coordenação emite pro mentorado pela ficha (0046 — o
 *  termo de participação veio junto com a autorização). Vive aqui porque o
 *  arquivo de actions é "use server" e só exporta funções async. */
export const TEMPLATES_MENTORADO = [
  { slug: "termo-mentorando", rotulo: "Termo de participação (o(a) jovem assina)" },
  { slug: "autorizacao-responsavel", rotulo: "Autorização do responsável" },
] as const;

export function dadosCivisDe(a: Assinatura): DadosCivis | null {
  const s = a.dados_snapshot;
  if (!s || typeof s !== "object" || !("nome_civil" in s)) return null;
  return s as DadosCivis;
}

export function dadosAutorizacaoDe(a: Assinatura): DadosAutorizacao | null {
  const s = a.dados_snapshot;
  if (!s || typeof s !== "object" || !("responsavel" in s)) return null;
  return s as DadosAutorizacao;
}

/** Nome do arquivo da via assinada: `termo-adesao-marina.pdf` /
 *  `autorizacao-cleusa.pdf` — primeiro nome do signatário em ASCII (header
 *  HTTP não gosta de acento). Única fonte pras duas rotas de download. */
export function nomeArquivoVia(a: Assinatura): string {
  const base =
    a.template?.slug === "autorizacao-responsavel" ? "autorizacao" : "termo-adesao";
  const nome =
    dadosCivisDe(a)?.nome_civil ??
    dadosAutorizacaoDe(a)?.responsavel.nome_civil ??
    a.assinatura_texto ??
    "";
  const primeiro = normaliza(nome.trim().split(/\s+/)[0]).replace(
    /[^a-z0-9]+/g,
    ""
  );
  return primeiro ? `${base}-${primeiro}.pdf` : `${base}.pdf`;
}
