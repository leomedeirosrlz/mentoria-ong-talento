// REALIZA-243: o assistente saiu da nav e virou a bolha do AppShell —
// a rota fica como stub pra bookmarks/links antigos não caírem em 404.
import { redirect } from "next/navigation";

export default function AssistentePage() {
  redirect("/");
}
