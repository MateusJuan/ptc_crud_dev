import { Luminosidade, Prisma } from "@prisma/client";
import { Request as Requisicao, Response as Resposta } from "express";
import * as repositorioPlantas from "@repositorios/RepositorioPlantas";

const campos = [
  "nome",
  "especie",
  "preco",
  "estoque",
  "luminosidade",
  "petFriendly",
  "regaACadaDias",
] as const;

const maiorInteiro = 2147483647;

class DadosInvalidos extends Error {}

function validarCorpo(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw new DadosInvalidos("Envie um objeto JSON no corpo da requisição.");
  }

  return valor as Record<string, unknown>;
}

function validarId(requisicao: Requisicao): number {
  const idRecebido = requisicao.params.id;
  const id = Number(idRecebido);
  if (!/^\d+$/.test(idRecebido) || !Number.isInteger(id) || id < 1 || id > maiorInteiro) {
    throw new DadosInvalidos("O id deve ser um inteiro positivo válido.");
  }

  return id;
}

function validarInteiro(valor: unknown, minimo: number, campo: string): void {
  if (
    typeof valor !== "number" ||
    !Number.isInteger(valor) ||
    valor < minimo ||
    valor > maiorInteiro
  ) {
    throw new DadosInvalidos(
      `${campo} deve ser um inteiro entre ${minimo} e ${maiorInteiro}.`,
    );
  }
}

function validarDadosPlanta(
  corpo: unknown,
  parcial: boolean,
): Partial<Prisma.PlantaCreateInput> {
  const dadosRecebidos = validarCorpo(corpo);
  const dados: Record<string, unknown> = {};
  const campoDesconhecido = Object.keys(dadosRecebidos).find(
    (chave) => !campos.includes(chave as (typeof campos)[number]),
  );
  if (campoDesconhecido) {
    throw new DadosInvalidos(`Campo não permitido: ${campoDesconhecido}.`);
  }
  if (parcial && Object.keys(dadosRecebidos).length === 0) {
    throw new DadosInvalidos("Envie ao menos um campo da planta para editar.");
  }
  for (const campo of campos) {
    const valor = dadosRecebidos[campo];
    if (valor === undefined) {
      if (!parcial) {
        throw new DadosInvalidos(`O campo ${campo} é obrigatório.`);
      }
      continue;
    }
    if (campo === "nome" || campo === "especie") {
      if (typeof valor !== "string" || valor.trim() === "") {
        throw new DadosInvalidos(`${campo} deve ser um texto não vazio.`);
      }
      dados[campo] = valor.trim();
    } else if (campo === "petFriendly") {
      if (typeof valor !== "boolean") {
        throw new DadosInvalidos("petFriendly deve ser true ou false.");
      }
      dados[campo] = valor;
    } else if (campo === "luminosidade") {
      if (!Object.values(Luminosidade).includes(valor as Luminosidade)) {
        throw new DadosInvalidos(
          "luminosidade deve ser SOMBRA, MEIA_SOMBRA ou SOL_PLENO.",
        );
      }
      dados[campo] = valor;
    } else {
      validarInteiro(valor, campo === "estoque" ? 0 : 1, campo);
      dados[campo] = valor;
    }
  }

  return dados;
}

function tratarErro(erro: unknown, resposta: Resposta) {
  if (erro instanceof DadosInvalidos) {
    return resposta.status(400).json({ mensagem: erro.message });
  }
  // A planta pode ser removida por outra requisição entre a leitura e a escrita.
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
    return resposta.status(404).json({ mensagem: "Planta não encontrada." });
  }
  console.error(erro);

  return resposta.status(500).json({ mensagem: "Erro interno ao processar plantas." });
}

export const criarPlanta = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const dados = validarDadosPlanta(requisicao.body, false) as Prisma.PlantaCreateInput;
    return resposta.status(201).json(await repositorioPlantas.criarPlanta(dados));
  } catch (erro) {
    return tratarErro(erro, resposta);
  }
};

export const listarPlantas = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const filtrosPermitidos = ["luminosidade", "petFriendly", "nome", "ordem"];
    for (const [chave, valor] of Object.entries(requisicao.query)) {
      if (!filtrosPermitidos.includes(chave) || typeof valor !== "string") {
        throw new DadosInvalidos(
          `Filtro inválido: ${chave}. Envie um único valor textual.`,
        );
      }
    }
    const { luminosidade, petFriendly, nome, ordem } = requisicao.query;
    const filtros: Prisma.PlantaWhereInput = {};
    if (luminosidade !== undefined) {
      if (!Object.values(Luminosidade).includes(luminosidade as Luminosidade)) {
        throw new DadosInvalidos(
          "Filtro luminosidade inválido: use SOMBRA, MEIA_SOMBRA ou SOL_PLENO.",
        );
      }
      filtros.luminosidade = luminosidade as Luminosidade;
    }
    if (petFriendly !== undefined) {
      if (petFriendly !== "true" && petFriendly !== "false") {
        throw new DadosInvalidos("Filtro petFriendly deve ser true ou false.");
      }
      filtros.petFriendly = petFriendly === "true";
    }
    if (nome !== undefined) {
      if (!(nome as string).trim()) {
        throw new DadosInvalidos("Filtro nome não pode ser vazio.");
      }
      filtros.nome = { contains: (nome as string).trim(), mode: "insensitive" };
    }
    if (ordem !== undefined && ordem !== "nome" && ordem !== "preco") {
      throw new DadosInvalidos("ordem deve ser nome ou preco.");
    }
    const ordenacao: Prisma.PlantaOrderByWithRelationInput =
      ordem === "nome"
        ? { nome: "asc" }
        : ordem === "preco"
          ? { preco: "asc" }
          : { id: "asc" };
    return resposta
      .status(200)
      .json(await repositorioPlantas.buscarTodasPlantas(filtros, ordenacao));
  } catch (erro) {
    return tratarErro(erro, resposta);
  }
};

export const buscarPlantaPorId = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const planta = await repositorioPlantas.buscarPlantaPorId(validarId(requisicao));
    if (!planta) {
      return resposta.status(404).json({ mensagem: "Planta não encontrada." });
    }
    return resposta.status(200).json(planta);
  } catch (erro) {
    return tratarErro(erro, resposta);
  }
};

export const atualizarPlanta = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const id = validarId(requisicao);
    const dados = validarDadosPlanta(requisicao.body, true);
    if (!(await repositorioPlantas.buscarPlantaPorId(id))) {
      return resposta.status(404).json({ mensagem: "Planta não encontrada." });
    }
    return resposta.status(200).json(await repositorioPlantas.atualizarPlanta(id, dados));
  } catch (erro) {
    return tratarErro(erro, resposta);
  }
};

export const excluirPlanta = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const id = validarId(requisicao);
    if (!(await repositorioPlantas.buscarPlantaPorId(id))) {
      return resposta.status(404).json({ mensagem: "Planta não encontrada." });
    }
    await repositorioPlantas.excluirPlanta(id);
    return resposta.status(204).send();
  } catch (erro) {
    return tratarErro(erro, resposta);
  }
};

export const venderPlanta = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const id = validarId(requisicao);
    const corpo = validarCorpo(requisicao.body);
    if (Object.keys(corpo).some((chave) => chave !== "quantidade")) {
      throw new DadosInvalidos("A venda aceita somente o campo quantidade.");
    }
    validarInteiro(corpo.quantidade, 1, "quantidade");
    const resultado = await repositorioPlantas.venderPlanta(
      id,
      corpo.quantidade as number,
    );
    if (!resultado.planta) {
      return resposta.status(404).json({ mensagem: "Planta não encontrada." });
    }
    if (!resultado.vendaRealizada) {
      return resposta.status(400).json({
        mensagem: `Estoque insuficiente. Temos só ${resultado.planta.estoque} vasos.`,
      });
    }
    return resposta.status(200).json(resultado.planta);
  } catch (erro) {
    return tratarErro(erro, resposta);
  }
};

export const consultarValorEstoque = async (
  _requisicao: Requisicao,
  resposta: Resposta,
) => {
  try {
    return resposta.status(200).json(await repositorioPlantas.calcularValorEstoque());
  } catch (erro) {
    return tratarErro(erro, resposta);
  }
};

export const listarPlantasEsgotadas = async (
  _requisicao: Requisicao,
  resposta: Resposta,
) => {
  try {
    return resposta
      .status(200)
      .json(await repositorioPlantas.buscarTodasPlantas({ estoque: 0 }));
  } catch (erro) {
    return tratarErro(erro, resposta);
  }
};
