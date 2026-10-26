import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-192 — modo dark togglável. Preferência no cookie `tema`
// (auto/claro/escuro, default auto): o layout resolve "claro"/"escuro" no
// server e o script inline do <head> + o TemaSync cobrem o "auto" via
// matchMedia — sem flash e seguindo o SO em runtime. O toggle mora na
// linha "Aparência" do /perfil (staff) e /jovem/perfil (mentorado) e
// funciona em demo (cookie próprio, independente dos demo_*).
//
// Cobertura aqui: persistência do cookie, resolução dos três valores,
// toggle pela UI em sessão demo e smoke de contraste real (foreground ×
// background ≥ 4,5:1 computado, sem baseline de screenshot).

const html = (page: import("@playwright/test").Page) =>
  page.locator("html");

async function cookieTema(
  page: import("@playwright/test").Page,
  valor: "auto" | "claro" | "escuro"
) {
  await page.context().addCookies([
    { name: "tema", value: valor, url: page.url() },
  ]);
}

/** hsl(H S% L%) → luminância relativa WCAG (os tokens são declarados em
 *  hsl — o getPropertyValue devolve a string crua). */
function luminanciaHsl(hsl: string): number {
  const m = hsl.match(
    /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/[^)]*)?\)/
  );
  if (!m) throw new Error(`cor fora de hsl(): ${hsl}`);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const h = Number(m[1]) / 60;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const [r, g, b] =
    h < 1 ? [c, x, 0]
    : h < 2 ? [x, c, 0]
    : h < 3 ? [0, c, x]
    : h < 4 ? [0, x, c]
    : h < 5 ? [x, 0, c]
    : [c, 0, x];
  const lin = (v: number) => {
    const u = v + (l - c / 2);
    return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contraste(a: number, b: number) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

test.describe("tema — cookie e resolução (REALIZA-192)", () => {
  test("escuro explícito sai com .dark do server e persiste no reload", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await cookieTema(page, "escuro");
    await page.goto("/jovem");

    // classe SSR (sem depender do script): cookie → .dark no primeiro HTML
    await expect(html(page)).toHaveClass(/dark/);
    await expect(html(page)).toHaveAttribute("data-tema", "escuro");

    // o cookie segura a preferência entre carregamentos
    await page.reload();
    await expect(html(page)).toHaveClass(/dark/);
  });

  test("claro explícito ignora SO escuro; auto segue o matchMedia", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await entrarNaDemo(page, "mentorado");

    // "claro" vence o SO
    await cookieTema(page, "claro");
    await page.goto("/jovem");
    await expect(html(page)).not.toHaveClass(/dark/);

    // "auto" segue o SO: dark agora, light depois da troca em runtime
    await cookieTema(page, "auto");
    await page.goto("/jovem");
    await expect(html(page)).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).not.toHaveClass(/dark/);
  });

  test("toggle do perfil escreve o cookie e aplica na hora", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/perfil");

    const grupo = page.getByRole("radiogroup", { name: "Aparência" });
    await expect(grupo).toBeVisible();
    await expect(
      grupo.getByRole("radio", { name: "Sistema" })
    ).toHaveAttribute("aria-checked", "true");

    await grupo.getByRole("radio", { name: "Escuro" }).click();
    await expect(html(page)).toHaveClass(/dark/);
    await expect(
      grupo.getByRole("radio", { name: "Escuro" })
    ).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(async () =>
        (await page.context().cookies()).find((c) => c.name === "tema")
          ?.value
      )
      .toBe("escuro");

    // reload re-lê o cookie no server → .dark continua
    await page.reload();
    await expect(html(page)).toHaveClass(/dark/);
  });

  test("smoke de contraste: texto sobre fundo ≥ 4,5:1 nos dois temas", async ({
    page,
  }) => {
    for (const tema of ["claro", "escuro"] as const) {
      await entrarNaDemo(page, "mentorado");
      await cookieTema(page, tema);
      await page.goto("/jovem");
      const { background, foreground, mutedFg } = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          background: cs.getPropertyValue("--background"),
          foreground: cs.getPropertyValue("--foreground"),
          mutedFg: cs.getPropertyValue("--muted-foreground"),
        };
      });
      expect(contraste(luminanciaHsl(foreground), luminanciaHsl(background)))
        .toBeGreaterThanOrEqual(4.5);
      // metadado dominante também precisa passar (texto muted sobre card)
      expect(contraste(luminanciaHsl(mutedFg), luminanciaHsl(background)))
        .toBeGreaterThanOrEqual(4.5);
    }
  });
});
