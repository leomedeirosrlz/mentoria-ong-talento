#!/usr/bin/env python3
"""Transforma as respostas reais dos Google Forms de intake (matching
mentores/mentorados + cadastro Brasil Participativo) nos CSVs canônicos que
o importador da plataforma entende, mais o manifest de anexos.

Uso:
    python3 scripts/transformar-intake.py \
        --src /tmp/mentoria-docs \
        --anexos "/home/thiago/Downloads/Mentoria - Brasil Participativo" \
        --out intake-out

Saída (em --out):
    equipe.csv            — mentores + voluntários BP (papel "nenhum")
    mentorados.csv        — mentorandos
    manifest-anexos.json  — pessoa -> documentos locais p/ upload
    relatorio.txt         — auditoria: puladas, mescladas, avisos

O script só reorganiza e limpa — a validação de verdade (datas, whatsapp,
enums) é do importar.ts/actions.ts, que recebe os valores crus. Nada aqui
inventa dado: o que não mapeia pra coluna vai inteiro pro form_bruto.
"""

import argparse
import csv
import json
import re
import sys
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path

# ---------- constantes de domínio (espelho do importar.ts/ciclo.ts) ----------

UFS = {
    "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms",
    "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc",
    "sp", "se", "to",
}

ESTADO_PARA_UF = {
    "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM",
    "bahia": "BA", "ceara": "CE", "distrito federal": "DF",
    "espirito santo": "ES", "goias": "GO", "maranhao": "MA",
    "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG",
    "para": "PA", "paraiba": "PB", "parana": "PR", "pernambuco": "PE",
    "piaui": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN",
    "rio grande do sul": "RS", "rondonia": "RO", "roraima": "RR",
    "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE",
    "tocantins": "TO",
}

# cidade-capital sozinha ("Salvador") resolve a UF; ambígua ("São Paulo" pode
# ser a cidade ou o estado) também vira SP — no contexto do intake é a leitura
# certa e o cru fica no form_bruto
CAPITAIS = {
    "rio branco": "AC", "maceio": "AL", "macapa": "AP", "manaus": "AM",
    "salvador": "BA", "fortaleza": "CE", "brasilia": "DF", "vitoria": "ES",
    "goiania": "GO", "sao luis": "MA", "cuiaba": "MT",
    "campo grande": "MS", "belo horizonte": "MG", "belem": "PA",
    "joao pessoa": "PB", "curitiba": "PR", "recife": "PE", "teresina": "PI",
    "rio de janeiro": "RJ", "natal": "RN", "porto alegre": "RS",
    "porto velho": "RO", "boa vista": "RR", "florianopolis": "SC",
    "sao paulo": "SP", "aracaju": "SE", "palmas": "TO",
}

DIAS = {
    "segunda": "seg", "terca": "ter", "quarta": "qua", "quinta": "qui",
    "sexta": "sex", "sabado": "sab", "domingo": "dom",
}

# faixa horária -> período da grade (0038): manhã até 12h, tarde até 18h
def periodo_da_faixa(rotulo: str) -> str | None:
    m = re.search(r"(\d{1,2})h", rotulo)
    if not m:
        return None
    h = int(m.group(1))
    return "manha" if h < 12 else "tarde" if h < 18 else "noite"


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()


def norm_nome(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def bruto(header: list[str], row: list[str]) -> str:
    """Payload integral da linha — cabeçalho original -> valor cru."""
    return json.dumps(
        {h: row[i] for i, h in enumerate(header) if i < len(row)},
        ensure_ascii=False,
    )


def split_cidade_uf(v: str) -> tuple[str, str]:
    """"Estado/município de residência" é um campo só nos forms de matching e
    vem em tudo que é formato ("São Paulo - SP", "SP/Diadema", "Maraú - BA",
    "Espanha, Andalucía, Huelva"). Separa o que dá; o que não dá fica inteiro
    em cidade — melhor exibir cru do que adivinhar errado."""
    v = norm_nome(v)
    if not v:
        return "", ""
    # sigla grudada no fim sem separador: "São Paulo SP", "Timon Ma"
    m = re.match(r"^(.*?)[\s]+([A-Za-z]{2})$", v)
    partes = (
        [p.strip() for p in re.split(r"[/,;\-]", v) if p.strip()]
        if re.search(r"[/,;\-]", v)
        else ([m.group(1), m.group(2)] if m and sem_acento(m.group(2)) in UFS else [v])
    )
    uf = ""
    resto = list(partes)
    if len(partes) > 1:
        # a UF é quase sempre o último pedaço ("Maraú - BA", "Palmares,
        # Alagoas"); quando não é, é o primeiro ("SP/Diadema",
        # "CEARÁ/FORTALEZA"). Estado-name no fim também vale — "São Paulo -
        # SP" não pode virar cidade "SP".
        ultimo, primeiro = sem_acento(partes[-1]), sem_acento(partes[0])
        if ultimo in UFS or ultimo in ESTADO_PARA_UF:
            uf = partes[-1].upper() if ultimo in UFS else ESTADO_PARA_UF[ultimo]
            resto = partes[:-1]
        elif primeiro in UFS or primeiro in ESTADO_PARA_UF:
            uf = partes[0].upper() if primeiro in UFS else ESTADO_PARA_UF[primeiro]
            resto = partes[1:]
    # resto: tira só siglas residuais — nome de estado também é cidade
    # ("São Paulo - SP" -> cidade "São Paulo", não vazio)
    cidade = ", ".join(p for p in resto if sem_acento(p) not in UFS)
    if not uf and len(partes) == 1:
        n = sem_acento(partes[0])
        if n in UFS:
            return "", n.upper()
        # capital antes de estado: "São Paulo"/"Rio de Janeiro" sozinhos são
        # quase sempre a cidade homônima — guarda os dois em vez de só a UF
        if n in CAPITAIS:
            return partes[0], CAPITAIS[n]
        if n in ESTADO_PARA_UF:
            return "", ESTADO_PARA_UF[n]
    return cidade, uf


def disponibilidade(header: list[str], row: list[str]) -> str:
    """Colunas "…disponibilidade… [NNh às NNh]" com dias marcados na célula
    -> JSON {"dias":[], "periodos":[]} no shape de Disponibilidade (0038)."""
    dias: list[str] = []
    periodos: list[str] = []
    for i, h in enumerate(header):
        if not re.search(r"disponibilidade.*\d{1,2}h", sem_acento(h)) or i >= len(row):
            continue
        per = periodo_da_faixa(h)
        for d in re.split(r"[,;]", row[i]):
            dia = DIAS.get(sem_acento(d).replace("-feira", "").strip())
            if not dia:
                continue
            if dia not in dias:
                dias.append(dia)
            # período conta por coluna marcada, não por dia novo — Terça 09h
            # e Terça 19h precisam render manha E noite
            if per and per not in periodos:
                periodos.append(per)
    if not dias:
        return ""
    ordem_d = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
    ordem_p = ["manha", "tarde", "noite"]
    return json.dumps(
        {
            "dias": sorted(dias, key=ordem_d.index),
            "periodos": sorted(periodos, key=ordem_p.index),
        },
        ensure_ascii=False,
    )


def carimbo_iso(v: str) -> str:
    """Carimbo do Google Forms -> ISO (consent_lgpd_em). A planilha exporta
    como serial Excel com fração de dia ("46254.75818"); texto "dd/mm/aaaa
    hh:mm[:ss]" também vale."""
    v = v.strip()
    if re.match(r"^\d{5}(\.\d+)?$", v):
        return (datetime(1899, 12, 30) + timedelta(days=float(v))).isoformat()
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(v, fmt).isoformat()
        except ValueError:
            pass
    return ""


# ---------- leitura ----------

def ler_csv(path: Path) -> tuple[list[str], list[list[str]]]:
    # docconv.py exporta utf-8; fallback 1252 por segurança
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    rows = list(csv.reader(text.splitlines()))
    return rows[0], [r for r in rows[1:] if any(c.strip() for c in r)]


def idx(header: list[str], *trechos: str) -> int:
    """1ª coluna cujo header normalizado contém todos os trechos."""
    for i, h in enumerate(header):
        n = sem_acento(h)
        if all(t in n for t in trechos):
            return i
    return -1


def cel(row: list[str], i: int) -> str:
    return row[i].strip() if 0 <= i < len(row) else ""


# ---------- transformação por formulário ----------

CAB_EQUIPE = (
    "nome;email;whatsapp;papel;nome_social;data_nascimento;genero;cor_raca;"
    "cidade;uf;cargo;empresa;bio;linkedin;interesses;motivacao;"
    "pref_genero_par;origem;experiencia_previa;formacao_externa;"
    "disponibilidade;consent_lgpd_em;form_bruto;rg;cpf;cep;logradouro;"
    "numero;complemento;bairro"
).split(";")

CAB_MENTORADOS = (
    "nome;whatsapp;email;ong;notas;nome_social;data_nascimento;genero;"
    "cor_raca;cidade;uf;escolaridade;interesses;objetivos;motivacao;"
    "pref_genero_par;origem;disponibilidade;form_bruto;rg;cpf;cep;"
    "logradouro;numero;complemento;bairro;resp_nome;resp_parentesco;resp_rg;"
    "resp_cpf;resp_nascimento;resp_cidade;resp_uf;resp_cep;resp_logradouro;"
    "resp_numero;resp_complemento;resp_bairro"
).split(";")


SCI = re.compile(r"^\d+(\.\d+)?[eE]\+?\d+$")


def linha(**kw: str) -> dict[str, str]:
    # planilha corrompe números longos em notação científica (whatsapp, cpf,
    # rg) — expande de volta pra inteiro; o importador também se protege no
    # whatsapp, mas cpf/rg passam direto pro jsonb civil
    return {
        k: norm_nome(f"{float(v):.0f}" if SCI.match(str(v).strip()) else str(v))
        for k, v in kw.items()
    }


def monta_interesses(celulas: list[str], avisos: list[str], quem: str) -> str:
    """interesses é lista de tags (≤20 itens, ≤60 chars cada — mesmos CHECKs
    do fichaLinha). Hobbies/esportes são listáveis; inspirações, valores e
    realizações são prosa — ficam só no form_bruto. O que passar do teto é
    cortado aqui com aviso (o cru não se perde: está no form_bruto)."""
    itens = [
        re.sub(r"\s+", " ", x).strip()
        for c in celulas
        for x in re.split(r"[;|,]", c)
        if x.strip()
    ]
    curtos = [x for x in itens if len(x) <= 60]
    drop = len(itens) - len(curtos)
    if drop:
        avisos.append(f"{quem}: {drop} interesse(s) longos ficaram só no form_bruto")
    if len(curtos) > 20:
        avisos.append(f"{quem}: interesses cortados em 20 (tinha {len(curtos)})")
    return "; ".join(curtos[:20])


def transformar_mentores(header, rows, avisos):
    linhas = []
    for r in rows:
        nome = norm_nome(cel(r, idx(header, "documento de identidade oficial")))
        if not nome:
            avisos.append("mentor: linha sem nome pulada")
            continue
        cidade, uf = split_cidade_uf(cel(r, idx(header, "residencia")))
        interesses = monta_interesses(
            [cel(r, idx(header, "hobbies")), cel(r, idx(header, "esportes"))],
            avisos, nome,
        )
        exp_sn = cel(r, idx(header, "experiencia previa no trabalho"))
        exp_desc = cel(r, idx(header, "descreva-a"))
        linhas.append(linha(
            nome=nome,
            email=cel(r, idx(header, "e-mail")),
            whatsapp=cel(r, idx(header, "telefone")),
            papel="mentor dpp",
            nome_social=cel(r, idx(header, "nome social")),
            data_nascimento=cel(r, idx(header, "nascimento")),
            genero=cel(r, idx(header, "genero")),
            cor_raca=cel(r, idx(header, "cor/raca")),
            cidade=cidade,
            uf=uf,
            cargo=cel(r, idx(header, "cargo")),
            empresa=cel(r, idx(header, "empresa")),
            bio=cel(r, idx(header, "descricao de voce mesmo")),
            linkedin=cel(r, idx(header, "linkedin")),
            interesses=interesses,
            motivacao=cel(r, idx(header, "objetivos")),
            pref_genero_par=cel(r, idx(header, "preferencia")),
            origem="Formulário de matching",
            experiencia_previa=exp_desc or (exp_sn if sem_acento(exp_sn) == "sim" else ""),
            formacao_externa=cel(r, idx(header, "mentoring autentico")),
            disponibilidade=disponibilidade(header, r),
            form_bruto=bruto(header, r),
        ))
    return linhas


def transformar_mentorados(header, rows, avisos):
    linhas, vistos = [], {}
    for r in rows:
        nome = norm_nome(cel(r, idx(header, "documento de identidade oficial")))
        if not nome:
            avisos.append("mentorado: linha sem nome pulada")
            continue
        chave = sem_acento(cel(r, idx(header, "e-mail"))) or sem_acento(nome)
        preenchidos = sum(1 for c in r if c.strip())
        if chave in vistos:
            # mesma pessoa 2x (Louise): fica a linha mais completa
            if preenchidos <= vistos[chave][0]:
                avisos.append(f"mentorado: duplicata de {nome} pulada (linha menos completa)")
                continue
            avisos.append(f"mentorado: duplicata de {nome} — trocada pela linha mais completa")
            linhas.remove(vistos[chave][1])
        cidade, uf = split_cidade_uf(cel(r, idx(header, "residencia")))
        interesses = monta_interesses(
            [
                cel(r, idx(header, "hobbies")),
                cel(r, idx(header, "coisas que voce mais gosta")),
                cel(r, idx(header, "esportes")),
            ],
            avisos, nome,
        )
        nova = linha(
            nome=nome,
            whatsapp=cel(r, idx(header, "telefone")),
            email=cel(r, idx(header, "e-mail")),
            origem="Formulário de matching",
            nome_social=cel(r, idx(header, "nome social")),
            data_nascimento=cel(r, idx(header, "nascimento")),
            genero=cel(r, idx(header, "genero")),
            cor_raca=cel(r, idx(header, "cor/raca")),
            cidade=cidade,
            uf=uf,
            interesses=interesses,
            bio=cel(r, idx(header, "descricao de voce mesmo")),
            objetivos=cel(r, idx(header, "objetivos")),
            pref_genero_par=cel(r, idx(header, "preferencia")),
            form_bruto=bruto(header, r),
        )
        vistos[chave] = (preenchidos, nova)
        linhas.append(nova)
    return linhas


def transformar_bp(header, rows, mentores_por_nome, avisos):
    """Voluntários do cadastro federal. Quem já está no form de matching vira
    enriquecimento da linha de mentor (civis + payload BP dentro do
    form_bruto); os demais entram como cadastro sem papel."""
    linhas = []
    for r in rows:
        nome = norm_nome(cel(r, idx(header, "nome completo")))
        if not nome:
            avisos.append("BP: linha sem nome pulada")
            continue
        lgpd = cel(r, idx(header, "lgpd"))
        consent = (
            carimbo_iso(cel(r, 0))
            if sem_acento(lgpd).startswith("concordo")
            else ""
        )
        civis = dict(
            cpf=cel(r, idx(header, "cpf")),
            rg=cel(r, idx(header, "orgao expedidor")),
            cep=cel(r, idx(header, "cep")),
            logradouro=cel(r, idx(header, "logradouro")),
            numero=cel(r, idx(header, "numero")),
            complemento=cel(r, idx(header, "complemento")),
            bairro=cel(r, idx(header, "bairro")),
            cidade=cel(r, idx(header, "cidade")),
            # "UF (estado)" — sem o 2º trecho pegava "RG / Órgão exp. / UF"
            uf=cel(r, idx(header, "uf", "estado")),
        )
        chave = sem_acento(nome)
        if chave in mentores_por_nome:
            m = mentores_por_nome[chave]
            for k, v in civis.items():
                if v and not m.get(k):
                    # mesmo anti-notação-científica do linha() — o merge
                    # injeta direto, sem passar por ela
                    m[k] = f"{float(v):.0f}" if SCI.match(v) else norm_nome(v)
            if consent and not m.get("consent_lgpd_em"):
                m["consent_lgpd_em"] = consent
            fb = json.loads(m["form_bruto"])
            fb["_brasil_participativo"] = {
                h: r[i] for i, h in enumerate(header) if i < len(r)
            }
            m["form_bruto"] = json.dumps(fb, ensure_ascii=False)
            avisos.append(f"BP: {nome} já é mentor no matching — dados civis do BP mesclados")
            continue
        linhas.append(linha(
            nome=nome,
            email=cel(r, idx(header, "e-mail")),
            whatsapp=cel(r, idx(header, "whatsapp")),
            papel="nenhum",
            nome_social=cel(r, idx(header, "nome social")),
            data_nascimento=cel(r, idx(header, "nascimento")),
            genero=cel(r, idx(header, "sexo")),
            cor_raca=cel(r, idx(header, "autodeclaracao")),
            origem="Cadastro Brasil Participativo",
            consent_lgpd_em=consent,
            form_bruto=bruto(header, r),
            **civis,
        ))
    return linhas


# ---------- manifest de anexos ----------

TIPO_PASTA = [
    (("rg", "cnh", "identidade"), "rg"),
    (("cpf",), "cpf"),
    (("comprovante bancario", "bancario"), "comprovante_bancario"),
    (("comprovante de residencia", "residencia"), "comprovante_residencia"),
    (("curriculo",), "curriculo"),
    (("foto de perfil", "foto"), "avatar"),
]


def tipo_da_pasta(nome_pasta: str) -> str:
    n = sem_acento(nome_pasta)
    for chaves, tipo in TIPO_PASTA:
        if any(k in n for k in chaves):
            return tipo
    return "outro"


def nome_do_arquivo(arq: str) -> str:
    """"CV Fulano - Nome Sobrenome.pdf" — o sufixo após o último " - " é o
    respondente (padrão do download de File responses do Forms)."""
    stem = Path(arq).stem
    return norm_nome(stem.rsplit(" - ", 1)[-1]) if " - " in stem else ""


def tokens_cobrem(sufixo: str, nome: str) -> bool:
    """O sufixo do arquivo é o nome de exibição, muitas vezes curto ou
    apelido ("Juliana Novaes" ⊂ "Juliana Novaes de Oliveira", "Meire Fiuza"
    ~ "Meiriane Archangelo Fiuza", "Dan vieira" ~ "Daniel Vieira cordeiro").
    Token casa quando é exato, prefixo ≥3 de um token do nome, ou quase igual
    (mesmas 3 iniciais, diferença de tamanho ≤3). Iniciais soltas ("P.") e
    sufixo de cópia ("(1)") não contam."""
    alvo = set(nome.split())
    tokens = [re.sub(r"[^a-z]", "", t) for t in sufixo.split()]
    tokens = [t for t in tokens if len(t) >= 2]
    if not tokens:
        return False
    for t in tokens:
        if t in alvo:
            continue
        if any(a.startswith(t) or (t[:3] == a[:3] and abs(len(t) - len(a)) <= 3)
               for a in alvo if len(t) >= 3):
            continue
        return False
    return True


def montar_manifest(dir_anexos: Path, pessoas: dict[str, dict], avisos):
    """pessoas: chave=sem_acento(nome) -> {nome, email, tipo_pessoa, fonte}.
    A pasta de cima diz de qual form o anexo veio — restringe o pool e evita
    cruzar mentor com mentorado de nome parecido."""
    fonte_da_pasta = {"mentores": "mentor", "mentorados": "mentorado", "brasil": "equipe"}
    orfaos = []
    for top in sorted(dir_anexos.iterdir()):
        if not top.is_dir() or "file responses" not in sem_acento(top.name):
            continue
        n_top = sem_acento(top.name)
        fonte = next((v for k, v in fonte_da_pasta.items() if k in n_top), "equipe")
        pool = {
            k: p for k, p in pessoas.items()
            if (p["fonte"] == fonte) or (fonte == "equipe" and p["tipo_pessoa"] == "profile")
        }
        for pergunta in sorted(top.iterdir()):
            tipo = tipo_da_pasta(pergunta.name)
            for arq in sorted(pergunta.rglob("*")):
                if not arq.is_file():
                    continue
                quem = sem_acento(nome_do_arquivo(arq.name))
                alvo = pool.get(quem)
                if not alvo:
                    cand = [p for k, p in pool.items() if tokens_cobrem(quem, k)]
                    if len(cand) == 1:
                        alvo = cand[0]
                    elif cand:
                        avisos.append(f"anexo ambíguo ({len(cand)} donos possíveis): {arq.name}")
                if not alvo:
                    orfaos.append(f"{tipo}: {arq.name}")
                    continue
                alvo.setdefault("documentos", []).append(
                    {"tipo": tipo, "arquivo": str(arq), "nome_original": arq.name}
                )
    manifest = [p for p in pessoas.values() if p.get("documentos")]
    for o in orfaos:
        avisos.append(f"anexo sem dono: {o}")
    return manifest


# ---------- main ----------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=Path("/tmp/mentoria-docs"))
    ap.add_argument("--anexos", type=Path,
                    default=Path("/home/thiago/Downloads/Mentoria - Brasil Participativo"))
    ap.add_argument("--out", type=Path, default=Path("intake-out"))
    a = ap.parse_args()

    avisos: list[str] = []
    cab_m, rows_m = ler_csv(a.src / "Modelo Mentores_ dados para o matching (respostas)__Respostas_ao_formulário_1.csv")
    cab_j, rows_j = ler_csv(a.src / "Modelo Mentorados_ dados para o matching (respostas)__Respostas_ao_formulário_1.csv")
    cab_b, rows_b = ler_csv(a.src / "Cadastro de Voluntários(as) - Brasil Participativo (respostas)__Respostas_ao_formulário_1.csv")
    # "Cópia de Modelo Mentores" é a mesma planilha (e-mails idênticos) — ignora

    mentores = transformar_mentores(cab_m, rows_m, avisos)
    mentorados = transformar_mentorados(cab_j, rows_j, avisos)
    mentores_por_nome = {sem_acento(m["nome"]): m for m in mentores}
    bp = transformar_bp(cab_b, rows_b, mentores_por_nome, avisos)
    equipe = mentores + bp

    # cruzamento tardio: e-mail de mentorado que já é profile vira aviso
    emails_eq = {sem_acento(m["email"]) for m in equipe if m["email"]}
    for j in mentorados:
        if sem_acento(j["email"]) in emails_eq:
            avisos.append(f"mentorado {j['nome']}: e-mail também está na equipe")

    a.out.mkdir(parents=True, exist_ok=True)
    for nome_arq, cab, linhas in (
        ("equipe.csv", CAB_EQUIPE, equipe),
        ("mentorados.csv", CAB_MENTORADOS, mentorados),
    ):
        with open(a.out / nome_arq, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cab, delimiter=";",
                               extrasaction="ignore", quoting=csv.QUOTE_MINIMAL)
            w.writeheader()
            for l in linhas:
                w.writerow({k: l.get(k, "") for k in cab})

    pessoas = {
        sem_acento(m["nome"]): {
            "nome": m["nome"], "email": m["email"].lower(),
            "tipo_pessoa": "profile",
            "fonte": "mentor" if m["papel"] != "nenhum" else "equipe",
        }
        for m in equipe
    }
    pessoas.update({
        sem_acento(j["nome"]): {
            "nome": j["nome"], "email": j["email"].lower(),
            "tipo_pessoa": "mentorado", "fonte": "mentorado",
        }
        for j in mentorados
    })
    manifest = montar_manifest(a.anexos, pessoas, avisos)
    (a.out / "manifest-anexos.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    rel = [
        f"equipe.csv: {len(equipe)} linhas ({len(mentores)} mentores + {len(bp)} só-BP)",
        f"mentorados.csv: {len(mentorados)} linhas",
        f"manifest-anexos.json: {len(manifest)} pessoas, "
        f"{sum(len(p['documentos']) for p in manifest)} arquivos",
        "",
        f"avisos ({len(avisos)}):",
        *[f"  - {w}" for w in avisos],
    ]
    (a.out / "relatorio.txt").write_text("\n".join(rel) + "\n", encoding="utf-8")
    print("\n".join(rel[:4]))
    print(f"-> {a.out}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
