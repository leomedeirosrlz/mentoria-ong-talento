import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { builtinRules } from "eslint/use-at-your-own-risk";

// REALIZA-218 — guard do kit de UI: a rodada out/2026 trocou ~36 botões/campos
// crus por Button/Input/Select/Textarea/FilterChip e isso não pode regredir.
// Erro e warn na mesma regra exigem duas instâncias — flat config não mescla
// opções da mesma regra, a última vence. "realiza/" é o próprio builtin
// realiado; os 4 guards continuam sendo no-restricted-syntax com seletor JSX.
const restrictedSyntax = builtinRules.get("no-restricted-syntax");

const MSG = {
  select: "Use o Select de @/components/ui/select.",
  input: "Use o Input de @/components/ui/input.",
  textarea: "Use o Textarea de @/components/ui/textarea.",
};

// <input> sem type renderiza como text — conta como campo de texto cru. O
// seletor de type cobre "literal" e {"expressão"}; radio/checkbox/file/hidden
// ficam liberados porque não têm equivalente no kit.
const SEL = {
  select: 'JSXOpeningElement[name.name="select"]',
  inputSemTipo:
    'JSXOpeningElement[name.name="input"]:not(:has(> JSXAttribute[name.name="type"]))',
  inputTexto:
    'JSXOpeningElement[name.name="input"]:has(' +
    '> JSXAttribute[name.name="type"][value.value=/^(text|email|search|number|date|time|datetime-local|tel|url)$/],' +
    '> JSXAttribute[name.name="type"][value.expression.value=/^(text|email|search|number|date|time|datetime-local|tel|url)$/])',
  textarea: 'JSXOpeningElement[name.name="textarea"]',
  buttonClassName:
    'JSXOpeningElement[name.name="button"]:has(> JSXAttribute[name.name="className"])',
};

// honeypot anti-spam: <input name="website"> fora da viewport com tabIndex -1 —
// invisível por definição, a casca do kit só adicionaria classe a um campo que
// ninguém vê. Cada arquivo que tem um ganha override próprio abaixo.
const EXCETO_HONEYPOT =
  ':not(:has(> JSXAttribute[name.name="name"][value.value="website"]))';

// Monta as opções do guard afrouxando apenas o que a exceção do arquivo cobre —
// o resto continua barrando (override de flat config substitui as opções
// inteiras da regra, não mescla).
function guardKit({
  honeypot = false,
  selectLivre = false,
  inputSemTipoLivre = false,
} = {}) {
  const hp = honeypot ? EXCETO_HONEYPOT : "";
  return [
    ...(selectLivre ? [] : [{ selector: SEL.select, message: MSG.select }]),
    ...(inputSemTipoLivre
      ? []
      : [{ selector: SEL.inputSemTipo + hp, message: MSG.input }]),
    { selector: SEL.inputTexto + hp, message: MSG.input },
    { selector: SEL.textarea, message: MSG.textarea },
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    plugins: {
      realiza: {
        rules: { "no-restricted-syntax": restrictedSyntax },
      },
    },
    rules: {
      "no-restricted-syntax": ["error", ...guardKit()],
      "realiza/no-restricted-syntax": [
        "warn",
        {
          selector: SEL.buttonClassName,
          message: "Prefira Button/buttonVariants do kit.",
        },
      ],
    },
  },
  // Exceções legítimas — um bloco por arquivo, com o motivo no comentário.
  {
    // honeypot anti-spam do form público do terceiro (/t/[token])
    files: ["src/app/t/\\[token\\]/terceiro-publico.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...guardKit({ honeypot: true })],
    },
  },
  {
    // form público (/f/[token]): honeypot + <select> nativo de propósito —
    // picker do SO no celular (o público chega pelo WhatsApp) e required/
    // FormData de graça; decisão documentada junto do CampoSelect
    files: ["src/app/f/\\[token\\]/formulario-publico.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...guardKit({ honeypot: true, selectLivre: true }),
      ],
    },
  },
  {
    // honeypot anti-spam da avaliação do encontro (form do jovem)
    files: ["src/components/avaliacao-encontro-form.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...guardKit({ honeypot: true })],
    },
  },
  {
    // honeypot anti-spam do fluxo público de instrumentos
    files: ["src/components/instrumentos/flow.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...guardKit({ honeypot: true })],
    },
  },
  {
    // EntradaSelect: <select> nativo de propósito — mesmo motivo do form
    // público (picker do SO + required/FormData no submit da página)
    files: ["src/components/instrumentos/campos.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...guardKit({ selectLivre: true })],
    },
  },
  {
    // edição inline de célula do relatório canvas: <input> sem type dentro de
    // <td> — o Input do kit (padding/altura próprios) quebraria a célula
    files: ["src/components/relatorio-canvas.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...guardKit({ inputSemTipoLivre: true }),
      ],
    },
  },
]);

export default eslintConfig;
