// Conteúdo canônico dos documentos de assinatura — a MESMA fonte alimenta o
// preview na tela e o PDF final (src/lib/documentos/pdf.ts), então o texto
// nunca diverge entre o que a pessoa leu e o que ela assinou.
//
// O texto do termo é fiel ao docx oficial (docs/fontes/termo-adesao-voluntario.txt)
// — a única mudança é trocar os dados civis por placeholders preenchidos no
// ato da assinatura. Se o jurídico alterar o termo, muda aqui e sobe a
// `versao` do template em documento_templates.

import type { Assinatura, DadosAutorizacao, DadosCivis, Endereco } from "../types";

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
    "2.3. Na hipótese de o desempenho das atividades voluntárias acarretarem danos à INSTITUIÇÃO e/ou terceiros, decorrentes de dolo ou culpa do(a) VOLUNTÁRIO(A) se sujeitará a arcar com os consequentes prejuízos.",
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
  "Art. 1º Considera-se serviço voluntário, para fins desta Lei, a atividade não remunerada, prestada por pessoa física a entidade pública de qualquer natureza, ou a instituição privada de fins não lucrativos, que tenha objetivos cívicos, culturais, educacionais, científicos, recreativos ou de assistência social, inclusive mutualidade.",
  "Parágrafo único. O serviço voluntário não gera vínculo empregatício, nem obrigação de natureza trabalhista previdenciária ou afim.",
  "Art. 2º O serviço voluntário será exercido mediante a celebração de termo de adesão entre a entidade, pública ou privada, e o prestador do serviço voluntário, dele devendo constar o objeto e as condições de seu exercício.",
  "Art. 3º O prestador do serviço voluntário poderá ser ressarcido pelas despesas que comprovadamente realizar no desempenho das atividades voluntárias.",
  "Parágrafo único. As despesas a serem ressarcidas deverão estar expressamente autorizadas pela entidade a que for prestado o serviço voluntário.",
  "Art. 4º Esta Lei entra em vigor na data de sua publicação.",
  "Art. 5º Revogam-se as disposições em contrário.",
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

// ---------- helpers de tipo ----------

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
