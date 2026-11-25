import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { JovemDiretorio } from "@/components/jovem-diretorio";
import { enriqueceDiretorio } from "@/lib/jovem-diretorio";
import {
  getJovemColegas,
  getJovemContatos,
  getJovemDiretorio,
  getJovemDuplas,
  getJovemPerfil,
} from "@/lib/queries-jovem";
import { getMe } from "@/lib/queries";

export const metadata: Metadata = { title: "Pessoas" };

/** /jovem/pessoas (023) — o diretório do programa inteiro: adultos com
 *  papel, TODOS os jovens com conta (menores com foto, decisão do lead) e
 *  o catálogo de especialistas. A rede do jovem é uma LENTE sobre a
 *  lista (marca "Sua rede" + faceta "Minha rede"), resolvida no client
 *  por jovem_contatos ∪ mentorados_turma — a view marca minha_rede, o
 *  merge repara o quirk do distinct on (id). REALIZA-525: o card da
 *  rede abre o WhatsApp quando a view já entrega o canal — o mesmo
 *  dado que a ficha expõe, o resto segue fechado atrás do vínculo. */
export default async function JovemPessoas() {
  const [me, perfil, entradas, contatos, colegas, duplas] =
    await Promise.all([
      getMe(),
      getJovemPerfil(),
      getJovemDiretorio(),
      getJovemContatos(),
      getJovemColegas(),
      getJovemDuplas(),
    ]);
  if (!me) return null; // o layout já barra — convenção das páginas
  const nomeTela = me.nome_social || me.nome;

  if (perfil == null) {
    // sem ficha de mentorado a view já vem vazia — a página diz por que
    // em vez de mostrar uma grade muda (mesma régua de /jovem/especialistas)
    return (
      <div className="grid gap-6">
        <header>
          <h1 className="text-xl font-semibold">Pessoas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo mundo do programa, com a sua rede marcada.
          </p>
        </header>
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground">
            Seu cadastro ainda não está completo. Quando a equipe vincular
            sua ficha, as pessoas do programa aparecem por aqui.
          </CardContent>
        </Card>
      </div>
    );
  }

  const pessoas = enriqueceDiretorio(entradas, contatos, colegas, duplas);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Pessoas</h1>
        <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Todo mundo do programa, com a sua rede marcada. Toca numa pessoa
          pra abrir o perfil dela.
        </p>
      </header>
      <JovemDiretorio pessoas={pessoas} nomeJovem={nomeTela} />
    </div>
  );
}
