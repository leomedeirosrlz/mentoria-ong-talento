import { chromium } from "@playwright/test";
const b = await chromium.launch({ args: ["--use-angle=vulkan","--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan"] });
const p = await b.newPage();
p.on("console", m => { if (m.type()==="error") console.log("[pageerr]", m.text().slice(0,200)); });
p.on("requestfailed", r => console.log("[reqfail]", r.url().slice(0,120), r.failure()?.errorText));
await p.goto("http://localhost:3100/login", { timeout: 20000 });
console.log("login page:", p.url(), await p.title());
await p.locator("label", { has: p.locator('input[name="modo-login"][value="senha"]') }).click();
await p.locator("#email").fill("jovem-e2e@realiza.test");
await p.locator("#senha").fill(process.env.PW);
await p.getByRole("button", { name: "Entrar" }).click();
try {
  await p.waitForURL(u => !u.pathname.startsWith("/login"), { timeout: 20000 });
  console.log("landed:", p.url());
} catch { console.log("stuck at:", p.url()); }
await p.screenshot({ path: "/tmp/dbg-login.png" });
await b.close();
