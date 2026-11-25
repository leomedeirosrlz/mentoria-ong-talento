import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-243 — a bolha em modo demo (sdd §8): transcript enlatado, chips
// com respostas fixas e NENHUM fetch à API — honesto, sem fingir LLM.

test("demo: bolha abre e chips respondem enlatado sem chamar a API", async ({
  page,
}) => {
  let chamadasApi = 0;
  await page.route("**/api/ia/chat", (route) => {
    chamadasApi++;
    return route.abort();
  });
  await entrarNaDemo(page, "coordenacao");
  // o lote de pills sorteia do que ainda não foi visto (026): semeando o
  // baralho com as outras seis, "Resumo da semana" sobra como pill certa —
  // o teste deixa de depender do sorteio
  await page.addInitScript(() => {
    localStorage.setItem(
      "liza:pills:coordenacao",
      JSON.stringify({
        vistos: [
          "Quem está aguardando par?",
          "Quem tem vaga pra parear?",
          "Encontros desta semana",
          "Quantos chamados abertos?",
          "Como foi o último mês de encontros?",
          "O que diz o guia sobre a Roda da Vida?",
        ],
        clicados: [],
      })
    );
  });
  // entrarNaDemo só planta os cookies no /demo (wizard, sem shell) — a
  // bolha mora no AppShell, então precisa de uma tela do app
  await page.goto("/");

  // seletor estável entre os rótulos Abrir/Fechar (o nome muda no clique)
  const fab = page.locator('[aria-controls="painel-assistente"]');
  // REALIZA-382: na demo a bolha sempre aparece (vitrine do assistente),
  // IA_BOLHA ou não — sem flag nem sessão ela responde com dados de exemplo
  await expect(fab).toBeVisible();
  await fab.click();

  const painel = page.locator("#painel-assistente");
  await expect(painel).toBeVisible();
  await expect(painel.getByText(/responde com dados de exemplo/)).toBeVisible();

  await painel.getByRole("button", { name: "Resumo da semana" }).click();
  await expect(painel.getByText(/números são de exemplo/)).toBeVisible();
  expect(chamadasApi).toBe(0);

  // input livre → a resposta fixa de demonstração
  await painel
    .getByRole("textbox", { name: "Mensagem pra Liza" })
    .fill("e os relatórios?");
  await painel.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(painel.getByText(/respostas de exemplo/)).toBeVisible();
  expect(chamadasApi).toBe(0);
});

test("demo: CTA do template abre a bolha, escolhe a dupla e sai o rascunho", async ({
  page,
}) => {
  // REALIZA-388: o documento segue verbatim; o botão "Pedir pra Liza
  // personalizar" dispara o evento que a bolha escuta — mesma conversa
  // local da demo (nada de API), escolha da dupla, rascunho editável
  let chamadasApi = 0;
  await page.route("**/api/ia/chat", (route) => {
    chamadasApi++;
    return route.abort();
  });
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/materiais/documento/mensagem-preparacao");

  // o template continua com os colchetes do guia — nada interpolado na página
  await expect(page.getByText(/\[Nome\], seja muito bem-vindo/)).toBeVisible();
  // clique pré-hidratação é no-op silencioso (a página chega por stream e
  // o handler liga depois) — repete até o painel abrir, mesmo padrão do
  // pularOnboarding
  const painel = page.locator("#painel-assistente");
  await expect(async () => {
    await page
      .getByRole("button", { name: "Pedir pra Liza personalizar" })
      .click();
    await expect(painel).toBeVisible({ timeout: 1500 });
  }).toPass();
  // Ricardo tem mais de uma dupla: a escolha vem antes do texto pronto
  await expect(
    painel.getByText("Pra qual dupla eu monto a mensagem de preparação?")
  ).toBeVisible();
  // 026/FR-008: a segunda linha (detalhe) desambigua pelo contexto — aqui
  // é a turma de cada dupla
  await expect(
    painel.getByRole("button", { name: /Bia · / }).getByText(/T\d · /)
  ).toBeVisible();
  await painel.getByRole("button", { name: /^Bia · / }).click();

  // o rascunho sai com os dados de exemplo da dupla — editável + canais
  await expect(painel.getByText(/Bia, seja muito bem-vindo/)).toBeVisible();
  await expect(
    painel.getByRole("button", { name: "Copiar mensagem" })
  ).toBeVisible();
  await expect(
    painel.getByRole("link", { name: "Abrir no WhatsApp" })
  ).toBeVisible();
  expect(chamadasApi).toBe(0);
});

test("demo: pills giram entre duas visitas e o clique envia a pergunta", async ({
  page,
}) => {
  // 026/FR-014: o lote sorteia do que ainda não foi visto — num catálogo
  // de 7 com lote de 3, a segunda visita nunca repete texto
  let chamadasApi = 0;
  await page.route("**/api/ia/chat", (route) => {
    chamadasApi++;
    return route.abort();
  });
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/");

  const fab = page.locator('[aria-controls="painel-assistente"]');
  const painel = page.locator("#painel-assistente");
  const grupo = painel.getByRole("group", { name: "Perguntas sugeridas" });

  await fab.click();
  const lote1 = (
    await grupo.getByRole("button").allTextContents()
  ).map((t) => t.trim());
  expect(lote1.length).toBe(3);

  // fecha e reabre: o grupo remonta e sorteia um lote novo do baralho
  await fab.click();
  await fab.click();
  const lote2 = (
    await grupo.getByRole("button").allTextContents()
  ).map((t) => t.trim());
  expect(lote2.length).toBe(3);
  expect(lote2.filter((t) => lote1.includes(t))).toEqual([]);

  // o clique envia a pergunta como mensagem própria — o empty state sai e
  // o texto da pill vira a bolha do usuário
  const alvo = lote2[0];
  await grupo.getByRole("button", { name: alvo }).click();
  await expect(painel.getByText(alvo)).toBeVisible();
  await expect(grupo).toHaveCount(0);
  expect(chamadasApi).toBe(0);
});

test("demo: 'e a dupla do Caio?' mostra o card da dupla nomeada", async ({
  page,
}) => {
  // 026/FR-016 + falso negativo do planner: a pergunta nomeada resolve a
  // dupla dela — o card "Para ficar em dia" é Carlos e Caio, não a
  // primeira atrasada do índice (Ricardo e Bia)
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/");

  const fab = page.locator('[aria-controls="painel-assistente"]');
  await fab.click();
  const painel = page.locator("#painel-assistente");
  await painel
    .getByRole("textbox", { name: "Mensagem pra Liza" })
    .fill("e a dupla do Caio, como vai ficar em dia?");
  await painel.getByRole("button", { name: "Enviar mensagem" }).click();

  const card = painel.locator("section", {
    has: page.getByText("Para ficar em dia"),
  });
  await expect(card.getByText(/Carlos/)).toBeVisible();
  await expect(card.getByText(/Caio/)).toBeVisible();
  await expect(card.getByText(/Ricardo|Bia/)).toHaveCount(0);
});

test("demo: aba de ajustes abre com config de exemplo e nada persiste", async ({
  page,
}) => {
  // REALIZA-382: o gear da bolha é coord-only — na demo abre o painel com
  // dataset local (modelos/tier/esforço/health prontos), sem Supabase e
  // sem o probe de /api/ia/modelos
  let chamadasModelos = 0;
  await page.route("**/api/ia/modelos**", (route) => {
    chamadasModelos++;
    return route.abort();
  });
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/");

  const fab = page.locator('[aria-controls="painel-assistente"]');
  await expect(fab).toBeVisible();
  await fab.click();
  const painel = page.locator("#painel-assistente");

  await painel
    .getByRole("button", { name: "Ajustes do assistente" })
    .click();

  await expect(
    painel.getByText(/ajustes são de exemplo e nada é gravado/)
  ).toBeVisible();
  // selects dos três tiers abrem com os slugs do dataset demo
  await expect(painel.getByLabel("Modelo Rápido")).toContainText(
    "glm-5.3-flash"
  );
  await expect(painel.getByLabel("Modelo Balanceado")).toContainText(
    "deepseek-v4.1-flash"
  );
  await expect(painel.getByLabel("Modelo Forte")).toContainText(
    "deepseek-v4-pro"
  );
  // o interruptor do roteador responde localmente (estado muda, nada grava)
  const roteamento = painel.getByLabel("Roteamento automático");
  await expect(roteamento).toBeChecked();
  await roteamento.click();
  await expect(roteamento).not.toBeChecked();
  expect(chamadasModelos).toBe(0);
});
