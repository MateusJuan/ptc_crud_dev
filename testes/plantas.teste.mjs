import testar from "node:test";
import verificar from "node:assert/strict";

const enderecoBase = process.env.TEST_API_URL || "http://localhost:3001";
const ids = new Set();
const prefixo = `teste-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dadosValidos = { nome: `${prefixo}-Costela`, especie: "Monstera deliciosa", preco: 8990, estoque: 12, luminosidade: "MEIA_SOMBRA", petFriendly: false, regaACadaDias: 3 };

async function requisitar(caminho, metodo = "GET", corpo, estadoEsperado = 200) {
  const resposta = await fetch(`${enderecoBase}${caminho}`, {
    method: metodo,
    headers: corpo === undefined ? {} : { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados = resposta.status === 204 ? null : await resposta.json();
  if (caminho === "/plantas" && metodo === "POST" && resposta.status === 201) ids.add(dados.id);
  verificar.equal(resposta.status, estadoEsperado, `${metodo} ${caminho}: ${JSON.stringify(dados)}`);
  if (estadoEsperado >= 400) verificar.equal(typeof dados.mensagem, "string");
  return dados;
}

testar("API de plantas: regras, filtros, totais, concorrência e remoção", async () => {
  try {
    const totalAntes = await requisitar("/plantas/estoque/valor-total");
    if (totalAntes.totalDeVasos === 0) verificar.equal(totalAntes.valorTotalEmCentavos, 0);
    const planta = await requisitar("/plantas", "POST", dadosValidos, 201);
    const plantaEsgotada = await requisitar("/plantas", "POST", { ...dadosValidos, nome: `${prefixo}-Maranta`, estoque: 0, petFriendly: true, luminosidade: "SOMBRA" }, 201);
    verificar.equal(plantaEsgotada.estoque, 0);
    verificar.equal(plantaEsgotada.petFriendly, true);
    const plantaSemEstoqueNaoSegura = await requisitar("/plantas", "POST", { ...dadosValidos, estoque: 0 }, 201);
    verificar.equal(plantaSemEstoqueNaoSegura.petFriendly, false);
    const total = await requisitar("/plantas/estoque/valor-total");
    verificar.equal(total.valorTotalEmCentavos, totalAntes.valorTotalEmCentavos + dadosValidos.preco * 12);
    verificar.equal(total.totalDeVasos, totalAntes.totalDeVasos + 12);

    for (const campo of Object.keys(dadosValidos)) {
      const dadosIncompletos = { ...dadosValidos };
      delete dadosIncompletos[campo];
      await requisitar("/plantas", "POST", dadosIncompletos, 400);
    }
    for (const dadosInvalidos of [
      { preco: 0 }, { preco: "8990" }, { preco: 89.9 }, { preco: 2147483648 },
      { estoque: -1 }, { estoque: 1.5 }, { regaACadaDias: 0 },
      { luminosidade: "LUA" }, { petFriendly: "false" }, { petFriendly: null },
      { nome: "  " }, { especie: 12 }, { id: 100 },
    ]) {
      await requisitar("/plantas", "POST", { ...dadosValidos, ...dadosInvalidos }, 400);
      await requisitar(`/plantas/${planta.id}`, "PATCH", dadosInvalidos, 400);
    }
    for (const dadosInvalidos of [null, [], "texto"]) await requisitar("/plantas", "POST", dadosInvalidos, 400);
    await requisitar(`/plantas/${planta.id}`, "PATCH", {}, 400);
    verificar.equal((await requisitar(`/plantas/${planta.id}`)).especie, dadosValidos.especie);
    const plantaAtualizada = await requisitar(`/plantas/${planta.id}`, "PATCH", { preco: 10000 });
    verificar.equal(plantaAtualizada.nome, dadosValidos.nome);
    verificar.equal(plantaAtualizada.estoque, 12);
    verificar.equal(plantaAtualizada.preco, 10000);

    for (const id of ["abc", "0", "-1", "1.5", "2147483648", "1e0"]) {
      await requisitar(`/plantas/${id}`, "GET", undefined, 400);
      await requisitar(`/plantas/${id}`, "PATCH", { nome: "X" }, 400);
      await requisitar(`/plantas/${id}`, "DELETE", undefined, 400);
      await requisitar(`/plantas/${id}/venda`, "POST", { quantidade: 1 }, 400);
    }
    for (const consulta of ["luminosidade=LUA", "petFriendly=sim", "petFriendly=", "petFriendly=true&petFriendly=false", "ordem=id", "nome=", "nome[x]=a", "invalido=a"]) {
      await requisitar(`/plantas?${consulta}`, "GET", undefined, 400);
    }
    for (const consulta of ["luminosidade=MEIA_SOMBRA", "petFriendly=false", "luminosidade=MEIA_SOMBRA&petFriendly=false"]) {
      const lista = await requisitar(`/plantas?${consulta}`);
      verificar.ok(lista.some((plantaEncontrada) => plantaEncontrada.id === planta.id));
      verificar.ok(!lista.some((plantaEncontrada) => plantaEncontrada.id === plantaEsgotada.id));
    }
    verificar.ok((await requisitar("/plantas?petFriendly=true")).some((plantaEncontrada) => plantaEncontrada.id === plantaEsgotada.id));
    verificar.deepEqual(await requisitar(`/plantas?nome=${prefixo}-inexistente`), []);
    verificar.ok((await requisitar(`/plantas?nome=${prefixo.toUpperCase()}`)).some((plantaEncontrada) => plantaEncontrada.id === planta.id));
    const plantasOrdenadas = await requisitar(`/plantas?nome=${prefixo}&ordem=preco`);
    verificar.deepEqual(plantasOrdenadas.map((plantaEncontrada) => plantaEncontrada.preco), plantasOrdenadas.map((plantaEncontrada) => plantaEncontrada.preco).sort((primeiro, segundo) => primeiro - segundo));
    verificar.equal((await requisitar(`/plantas?nome=${prefixo}&ordem=nome`)).length, 3);
    verificar.ok((await requisitar("/plantas/esgotadas")).some((plantaEncontrada) => plantaEncontrada.id === plantaEsgotada.id));

    for (const quantidade of [0, -1, 1.5, "2", null, 2147483648]) {
      await requisitar(`/plantas/${planta.id}/venda`, "POST", { quantidade }, 400);
    }
    await requisitar(`/plantas/${planta.id}/venda`, "POST", {}, 400);
    await requisitar(`/plantas/${planta.id}/venda`, "POST", { quantidade: 13 }, 400);
    verificar.equal((await requisitar(`/plantas/${planta.id}`)).estoque, 12);
    verificar.equal((await requisitar(`/plantas/${planta.id}/venda`, "POST", { quantidade: 11 })).estoque, 1);
    const vendas = await Promise.all(Array.from({ length: 8 }, () => fetch(`${enderecoBase}/plantas/${planta.id}/venda`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"quantidade":1}',
    })));
    verificar.equal(vendas.filter((venda) => venda.status === 200).length, 1);
    verificar.equal(vendas.filter((venda) => venda.status === 400).length, 7);
    await Promise.all(vendas.map((venda) => venda.json()));
    verificar.equal((await requisitar(`/plantas/${planta.id}`)).estoque, 0);
    verificar.deepEqual(await requisitar("/plantas/estoque/valor-total"), totalAntes);

    await requisitar(`/plantas/${planta.id}`, "DELETE", undefined, 204);
    ids.delete(planta.id);
    await requisitar(`/plantas/${planta.id}`, "GET", undefined, 404);
    await requisitar(`/plantas/${planta.id}`, "DELETE", undefined, 404);
    await requisitar(`/plantas/${planta.id}`, "PATCH", { nome: "X" }, 404);
    await requisitar(`/plantas/${planta.id}/venda`, "POST", { quantidade: 1 }, 404);
    const respostaJsonInvalido = await fetch(`${enderecoBase}/plantas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    verificar.equal(respostaJsonInvalido.status, 400);
    verificar.equal(typeof (await respostaJsonInvalido.json()).mensagem, "string");
  } finally {
    for (const id of ids) await requisitar(`/plantas/${id}`, "DELETE", undefined, 204);
    ids.clear();
  }
});
