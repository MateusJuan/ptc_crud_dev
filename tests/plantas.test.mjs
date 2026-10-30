import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.TEST_API_URL || "http://localhost:3001";
const ids = new Set();
const prefix = `teste-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const valid = { nome: `${prefix}-Costela`, especie: "Monstera deliciosa", preco: 8990, estoque: 12, luminosidade: "MEIA_SOMBRA", petFriendly: false, regaACadaDias: 3 };

async function request(path, method = "GET", body, status = 200) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json();
  if (path === "/plantas" && method === "POST" && response.status === 201) ids.add(data.id);
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  if (status >= 400) assert.equal(typeof data.message, "string");
  return data;
}

test("API de plantas: regras, filtros, totais, concorrência e remoção", async () => {
  try {
    const before = await request("/plantas/estoque/valor-total");
    if (before.totalDeVasos === 0) assert.equal(before.valorTotalEmCentavos, 0);
    const planta = await request("/plantas", "POST", valid, 201);
    const empty = await request("/plantas", "POST", { ...valid, nome: `${prefix}-Maranta`, estoque: 0, petFriendly: true, luminosidade: "SOMBRA" }, 201);
    assert.equal(empty.estoque, 0);
    assert.equal(empty.petFriendly, true);
    const falseZero = await request("/plantas", "POST", { ...valid, estoque: 0 }, 201);
    assert.equal(falseZero.petFriendly, false);
    const total = await request("/plantas/estoque/valor-total");
    assert.equal(total.valorTotalEmCentavos, before.valorTotalEmCentavos + valid.preco * 12);
    assert.equal(total.totalDeVasos, before.totalDeVasos + 12);

    for (const field of Object.keys(valid)) {
      const missing = { ...valid };
      delete missing[field];
      await request("/plantas", "POST", missing, 400);
    }
    for (const invalid of [
      { preco: 0 }, { preco: "8990" }, { preco: 89.9 }, { preco: 2147483648 },
      { estoque: -1 }, { estoque: 1.5 }, { regaACadaDias: 0 },
      { luminosidade: "LUA" }, { petFriendly: "false" }, { petFriendly: null },
      { nome: "  " }, { especie: 12 }, { id: 100 },
    ]) {
      await request("/plantas", "POST", { ...valid, ...invalid }, 400);
      await request(`/plantas/${planta.id}`, "PATCH", invalid, 400);
    }
    for (const invalid of [null, [], "texto"]) await request("/plantas", "POST", invalid, 400);
    await request(`/plantas/${planta.id}`, "PATCH", {}, 400);
    assert.equal((await request(`/plantas/${planta.id}`)).especie, valid.especie);
    const updated = await request(`/plantas/${planta.id}`, "PATCH", { preco: 10000 });
    assert.equal(updated.nome, valid.nome);
    assert.equal(updated.estoque, 12);
    assert.equal(updated.preco, 10000);

    for (const id of ["abc", "0", "-1", "1.5", "2147483648", "1e0"]) {
      await request(`/plantas/${id}`, "GET", undefined, 400);
      await request(`/plantas/${id}`, "PATCH", { nome: "X" }, 400);
      await request(`/plantas/${id}`, "DELETE", undefined, 400);
      await request(`/plantas/${id}/venda`, "POST", { quantidade: 1 }, 400);
    }
    for (const query of ["luminosidade=LUA", "petFriendly=sim", "petFriendly=", "petFriendly=true&petFriendly=false", "ordem=id", "nome=", "nome[x]=a", "invalido=a"]) {
      await request(`/plantas?${query}`, "GET", undefined, 400);
    }
    for (const query of ["luminosidade=MEIA_SOMBRA", "petFriendly=false", "luminosidade=MEIA_SOMBRA&petFriendly=false"]) {
      const list = await request(`/plantas?${query}`);
      assert.ok(list.some((item) => item.id === planta.id));
      assert.ok(!list.some((item) => item.id === empty.id));
    }
    assert.ok((await request("/plantas?petFriendly=true")).some((item) => item.id === empty.id));
    assert.deepEqual(await request(`/plantas?nome=${prefix}-inexistente`), []);
    assert.ok((await request(`/plantas?nome=${prefix.toUpperCase()}`)).some((item) => item.id === planta.id));
    const ordered = await request(`/plantas?nome=${prefix}&ordem=preco`);
    assert.deepEqual(ordered.map((item) => item.preco), ordered.map((item) => item.preco).sort((a, b) => a - b));
    assert.equal((await request(`/plantas?nome=${prefix}&ordem=nome`)).length, 3);
    assert.ok((await request("/plantas/esgotadas")).some((item) => item.id === empty.id));

    for (const quantidade of [0, -1, 1.5, "2", null, 2147483648]) {
      await request(`/plantas/${planta.id}/venda`, "POST", { quantidade }, 400);
    }
    await request(`/plantas/${planta.id}/venda`, "POST", {}, 400);
    await request(`/plantas/${planta.id}/venda`, "POST", { quantidade: 13 }, 400);
    assert.equal((await request(`/plantas/${planta.id}`)).estoque, 12);
    assert.equal((await request(`/plantas/${planta.id}/venda`, "POST", { quantidade: 11 })).estoque, 1);
    const sales = await Promise.all(Array.from({ length: 8 }, () => fetch(`${base}/plantas/${planta.id}/venda`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"quantidade":1}',
    })));
    assert.equal(sales.filter((sale) => sale.status === 200).length, 1);
    assert.equal(sales.filter((sale) => sale.status === 400).length, 7);
    await Promise.all(sales.map((sale) => sale.json()));
    assert.equal((await request(`/plantas/${planta.id}`)).estoque, 0);
    assert.deepEqual(await request("/plantas/estoque/valor-total"), before);

    await request(`/plantas/${planta.id}`, "DELETE", undefined, 204);
    ids.delete(planta.id);
    await request(`/plantas/${planta.id}`, "GET", undefined, 404);
    await request(`/plantas/${planta.id}`, "DELETE", undefined, 404);
    await request(`/plantas/${planta.id}`, "PATCH", { nome: "X" }, 404);
    await request(`/plantas/${planta.id}/venda`, "POST", { quantidade: 1 }, 404);
    const malformed = await fetch(`${base}/plantas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400);
    assert.equal(typeof (await malformed.json()).message, "string");
  } finally {
    for (const id of ids) await request(`/plantas/${id}`, "DELETE", undefined, 204);
    ids.clear();
  }
});
