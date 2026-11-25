import {
  appEnvOk,
  expect,
  jwtDoUsuario,
  restComoUsuario,
  test,
} from "../helpers";

// REST por papel das views do diretório (migration 0239, spec 023) —
// chamadas diretas ao PostgREST com o JWT de cada papel, sem passar pela
// UI. O que se prova aqui mora no banco: o gate `my_role()` das views e a
// projeção que nunca carrega contato direto (email/whatsapp/linkedin não
// existem como coluna — o recorte é estrutural, não é filtro da tela).
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const JOVEM = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const MENTOR = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const COORD = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";

type Linha = Record<string, unknown>;

// colunas exatas das duas views — qualquer coluna a mais (contato,
// motivacao, notas) quebra o teste antes de vazar pra tela
const COLS_DIRETORIO = [
  "areas",
  "avatar_path",
  "bio",
  "cargo",
  "cidade",
  "empresa",
  "experiencia_previa",
  "formacao_externa",
  "grade_resumo",
  "id",
  "interesses",
  "minha_rede",
  "minha_turma",
  "nome",
  "nome_social",
  "papel",
  "tipo",
  "uf",
  "vagas",
  "voluntariado",
];
const COLS_CATALOGO = COLS_DIRETORIO.filter(
  (c) => !["interesses", "minha_rede", "minha_turma", "papel", "tipo"].includes(c)
);

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test("jovem lê jovem_diretorio — programa inteiro sem contato direto", async () => {
  const jwt = await jwtDoUsuario(JOVEM, SENHA);
  const res = await restComoUsuario("jovem_diretorio?select=*", jwt);
  expect(res.status).toBe(200);
  const linhas = (await res.json()) as Linha[];
  expect(linhas.length).toBeGreaterThan(0);
  for (const l of linhas) {
    expect(Object.keys(l).sort()).toEqual(COLS_DIRETORIO);
  }
  // o programa todo aparece — não só a rede; a marca vem em minha_rede
  const tipos = new Set(linhas.map((l) => l.tipo));
  expect(tipos.has("adulto")).toBe(true);
  for (const t of tipos) {
    expect(["adulto", "especialista", "jovem"]).toContain(t);
  }
  expect(linhas.some((l) => l.minha_rede === false)).toBe(true);
});

test("jovem não lê especialistas_catalogo — gate staff da view", async () => {
  const jwt = await jwtDoUsuario(JOVEM, SENHA);
  const res = await restComoUsuario("especialistas_catalogo?select=*", jwt);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([]);
});

test("staff lê especialistas_catalogo com a projeção rica", async () => {
  for (const email of [MENTOR, COORD]) {
    const jwt = await jwtDoUsuario(email, SENHA);
    const res = await restComoUsuario("especialistas_catalogo?select=*", jwt);
    expect(res.status).toBe(200);
    const linhas = (await res.json()) as Linha[];
    expect(linhas.length).toBeGreaterThan(0);
    for (const l of linhas) {
      expect(Object.keys(l).sort()).toEqual(COLS_CATALOGO);
    }
  }
});

test("staff não lê jovem_diretorio — o diretório é do jovem", async () => {
  for (const email of [MENTOR, COORD]) {
    const jwt = await jwtDoUsuario(email, SENHA);
    const res = await restComoUsuario("jovem_diretorio?select=*", jwt);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  }
});
