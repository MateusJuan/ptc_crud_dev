import {
  readdir as lerDiretorio,
  readFile as lerArquivo,
  writeFile as escreverArquivo,
} from "node:fs/promises";
import { join as juntarCaminho } from "node:path";
import { fileURLToPath as converterUrlParaCaminho } from "node:url";
import { format as formatar, resolveConfig as resolverConfiguracao } from "prettier";

async function formatarPasta(pasta) {
  const entradas = await lerDiretorio(pasta, { withFileTypes: true });

  for (const entrada of entradas) {
    const caminho = juntarCaminho(pasta, entrada.name);

    if (entrada.isDirectory()) {
      await formatarPasta(caminho);
    } else if (entrada.isFile() && entrada.name.endsWith(".js")) {
      const configuracao = await resolverConfiguracao(caminho);
      const conteudo = await lerArquivo(caminho, "utf8");
      const conteudoFormatado = await formatar(conteudo, {
        ...configuracao,
        filepath: caminho,
      });

      await escreverArquivo(caminho, conteudoFormatado);
    }
  }
}

await formatarPasta(converterUrlParaCaminho(new URL("../dist/", import.meta.url)));
