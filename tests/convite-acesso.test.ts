// convidarAcesso — fronteiras mockadas na borda do módulo: createClient do
// servidor (me + alvos + log), createAdminClient (generateLink), Resend
// (enviarEmailsIndividuais) e o modo demo. O que se prova aqui é a
// orquestração: guardas de papel/estado, invite → fallback magiclink, a
// URL com o verification_type DA RESPOSTA e o log em emails_enviados.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { convidarAcesso } from "@/lib/actions-convite";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
  generateLink: vi.fn(),
  enviarEmailsIndividuais: vi.fn(),
  demoAtivo: vi.fn(),
  revalidatePath: vi.fn(),
  logInsert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: m.getClaims },
    from: m.from,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { generateLink: m.generateLink } },
  }),
}));
vi.mock("@/lib/demo/mode", () => ({ demoAtivo: m.demoAtivo }));
vi.mock("@/lib/email", () => ({
  enviarEmailsIndividuais: m.enviarEmailsIndividuais,
  SITE_URL: "https://app.test",
}));

const EU_COORD = { id: "eu-1", role: "coordenacao", ativo: true };
const PROFILE_ID = "11111111-2222-3333-4444-555555555555";
const MENTORADO_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

type Estado = {
  me?: unknown;
  profile?: unknown;
  contato?: unknown;
  mentorado?: unknown;
  conta?: unknown;
};

/** Fake do PostgREST orientado a tabela+select: .select/.eq acumulam e
 *  .single/.maybeSingle/.insert resolvem pelo estado acumulado. */
function supabaseDe(e: Estado) {
  m.from.mockImplementation((table: string) => {
    const q = { select: "", eqs: [] as [string, unknown][] };
    const resolve = () => {
      if (table === "profiles" && q.eqs[0]?.[0] === "user_id")
        return { data: e.me ?? null, error: null };
      if (table === "profiles" && q.select === "onboarded_em")
        return { data: e.conta ?? null, error: null };
      if (table === "profiles")
        return { data: e.profile ?? null, error: null };
      if (table === "profiles_contato")
        return { data: e.contato ?? null, error: null };
      if (table === "mentorados")
        return { data: e.mentorado ?? null, error: null };
      return { data: null, error: null };
    };
    const b: Record<string, unknown> = {};
    b.select = (cols: string) => {
      q.select = cols;
      return b;
    };
    b.eq = (col: string, val: unknown) => {
      q.eqs.push([col, val]);
      return b;
    };
    b.single = async () => resolve();
    b.maybeSingle = async () => resolve();
    b.insert = async (row: unknown) => {
      if (table === "emails_enviados") m.logInsert(row);
      return { error: null };
    };
    return b;
  });
}

function conviteOk(type = "invite") {
  m.generateLink.mockResolvedValue({
    data: {
      properties: { hashed_token: "hash-1", verification_type: type },
    },
    error: null,
  });
  m.enviarEmailsIndividuais.mockResolvedValue({
    enviados: 1,
    falhas: [],
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.getClaims.mockResolvedValue({ data: { claims: { sub: "user-eu" } } });
  m.demoAtivo.mockResolvedValue(false);
  supabaseDe({ me: EU_COORD });
});

describe("convidarAcesso — staff (profile)", () => {
  const profileNovo = {
    id: PROFILE_ID,
    nome: "Marina Duarte",
    nome_social: null,
    role: "mentor_dpp",
    ativo: true,
    user_id: null,
    onboarded_em: null,
  };

  it("coord convida: invite minta a conta, e-mail sai com o confirm + token", async () => {
    supabaseDe({
      me: EU_COORD,
      profile: profileNovo,
      contato: { id: PROFILE_ID, email: "marina@exemplo.org" },
    });
    conviteOk();

    const res = await convidarAcesso({ tipo: "profile", id: PROFILE_ID });

    expect(res).toEqual({ ok: true, email: "marina@exemplo.org" });
    expect(m.generateLink).toHaveBeenCalledWith({
      type: "invite",
      email: "marina@exemplo.org",
    });
    const msg = m.enviarEmailsIndividuais.mock.calls[0][0].mensagens[0];
    expect(msg.to).toBe("marina@exemplo.org");
    // o token_hash e o type da resposta viram o CTA do /auth/confirm
    // (esc() escapa o & da query)
    expect(msg.html).toContain(
      "/auth/confirm?token_hash=hash-1&amp;type=invite"
    );
    // REALIZA-35: the e-mail is the identity surface — display name +
    // role label + destination e-mail
    expect(msg.html).toContain("<strong>Marina Duarte</strong>, Mentor DPP");
    expect(msg.html).toContain("no e-mail marina@exemplo.org");
    expect(m.logInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "convite",
        ref_id: PROFILE_ID,
        audiencia: ["mentor_dpp"],
        destinatarios: 1,
        enviados: 1,
      })
    );
  });

  it("usuário já existe: cai no fallback magiclink e usa o type da resposta", async () => {
    // profile já vinculado ao auth (1º convite saiu) mas ainda não onboarded
    supabaseDe({
      me: EU_COORD,
      profile: { ...profileNovo, user_id: "u-1" },
      contato: { id: PROFILE_ID, email: "marina@exemplo.org" },
    });
    m.generateLink
      .mockResolvedValueOnce({
        data: { properties: null },
        error: { message: "A user with this email address has already been registered" },
      })
      .mockResolvedValue({
        data: {
          properties: { hashed_token: "hash-2", verification_type: "magiclink" },
        },
        error: null,
      });
    m.enviarEmailsIndividuais.mockResolvedValue({ enviados: 1, falhas: [] });

    const res = await convidarAcesso({ tipo: "profile", id: PROFILE_ID });

    expect(res).toEqual({ ok: true, email: "marina@exemplo.org" });
    expect(m.generateLink).toHaveBeenLastCalledWith({
      type: "magiclink",
      email: "marina@exemplo.org",
    });
    const msg = m.enviarEmailsIndividuais.mock.calls[0][0].mensagens[0];
    expect(msg.html).toContain("type=magiclink");
  });

  it("barra quem já entrou (conta + onboarding feitos)", async () => {
    supabaseDe({
      me: EU_COORD,
      profile: {
        ...profileNovo,
        user_id: "u-1",
        onboarded_em: "2026-01-01T00:00:00Z",
      },
      contato: { id: PROFILE_ID, email: "marina@exemplo.org" },
    });

    const res = await convidarAcesso({ tipo: "profile", id: PROFILE_ID });

    expect(res).toEqual({ error: "Essa pessoa já entrou na plataforma." });
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.enviarEmailsIndividuais).not.toHaveBeenCalled();
  });

  it("exige papel definido — o convite sem papel criaria conta sem acesso", async () => {
    supabaseDe({
      me: EU_COORD,
      profile: { ...profileNovo, role: null },
      contato: { id: PROFILE_ID, email: "marina@exemplo.org" },
    });

    const res = await convidarAcesso({ tipo: "profile", id: PROFILE_ID });

    expect(res).toEqual({ error: "Defina um papel antes de enviar o convite." });
    expect(m.generateLink).not.toHaveBeenCalled();
  });

  it("e-mail vem da view profiles_contato, não de profiles", async () => {
    supabaseDe({ me: EU_COORD, profile: profileNovo, contato: null });

    const res = await convidarAcesso({ tipo: "profile", id: PROFILE_ID });

    expect(res).toEqual({
      error: "Cadastre um e-mail pra enviar o convite.",
    });
    expect(m.generateLink).not.toHaveBeenCalled();
  });
});

describe("convidarAcesso — jovem (mentorado)", () => {
  const mentoradoAtivo = {
    id: MENTORADO_ID,
    nome: "Ana Beatriz Silva",
    nome_social: "Bia",
    email: "bia@exemplo.org",
    situacao: "ativo",
    profile_id: null,
  };

  it("convida o jovem com a variante jovem do e-mail", async () => {
    supabaseDe({ me: EU_COORD, mentorado: mentoradoAtivo });
    conviteOk();

    const res = await convidarAcesso({ tipo: "mentorado", id: MENTORADO_ID });

    expect(res).toEqual({ ok: true, email: "bia@exemplo.org" });
    const msg = m.enviarEmailsIndividuais.mock.calls[0][0].mensagens[0];
    expect(msg.subject).toBe("Sua jornada de mentoria começou");
    expect(msg.html).toContain("Bia"); // sauda o nome social
    // nome_social wins on "whose account it is"; the youth role is
    // mentorado (papelLabel)
    expect(msg.html).toContain("<strong>Bia</strong>, Mentorado");
    expect(m.logInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "convite",
        ref_id: MENTORADO_ID,
        audiencia: ["mentorado"],
      })
    );
  });

  it("conta vinculada sem onboarding aceita reenvio; onboarded barra", async () => {
    // profile_id presente mas conta não onboarded → segue pro generateLink:
    // invite falha (o auth.users já existe) e o fallback magiclink reenvia
    supabaseDe({
      me: EU_COORD,
      mentorado: { ...mentoradoAtivo, profile_id: "prof-9" },
      conta: { onboarded_em: null },
    });
    m.generateLink
      .mockResolvedValueOnce({
        data: { properties: null },
        error: { message: "already registered" },
      })
      .mockResolvedValue({
        data: {
          properties: { hashed_token: "h", verification_type: "magiclink" },
        },
        error: null,
      });
    m.enviarEmailsIndividuais.mockResolvedValue({ enviados: 1, falhas: [] });
    const reenvio = await convidarAcesso({
      tipo: "mentorado",
      id: MENTORADO_ID,
    });
    expect(reenvio).toEqual({ ok: true, email: "bia@exemplo.org" });

    supabaseDe({
      me: EU_COORD,
      mentorado: { ...mentoradoAtivo, profile_id: "prof-9" },
      conta: { onboarded_em: "2026-01-01T00:00:00Z" },
    });
    const bloqueado = await convidarAcesso({
      tipo: "mentorado",
      id: MENTORADO_ID,
    });
    expect(bloqueado).toEqual({
      error: "Essa pessoa já entrou na plataforma.",
    });
  });

  it("sem e-mail cadastrado não emite link", async () => {
    supabaseDe({
      me: EU_COORD,
      mentorado: { ...mentoradoAtivo, email: null },
    });
    const res = await convidarAcesso({ tipo: "mentorado", id: MENTORADO_ID });
    expect(res).toEqual({
      error: "Cadastre um e-mail pra enviar o convite.",
    });
    expect(m.generateLink).not.toHaveBeenCalled();
  });
});

describe("convidarAcesso — guardas", () => {
  it("quem não é coordenação não convida", async () => {
    supabaseDe({ me: { id: "eu-2", role: "supervisor", ativo: true } });
    const res = await convidarAcesso({ tipo: "profile", id: PROFILE_ID });
    expect(res).toEqual({
      error: "Só a coordenação envia convites de acesso.",
    });
    expect(m.generateLink).not.toHaveBeenCalled();
  });

  it("no modo demo devolve ok sem tocar em nada", async () => {
    m.demoAtivo.mockResolvedValue(true);
    const res = await convidarAcesso({ tipo: "profile", id: PROFILE_ID });
    expect(res).toEqual({ ok: true, demo: true });
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.enviarEmailsIndividuais).not.toHaveBeenCalled();
  });
});
