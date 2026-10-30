import { Luminosidade, Prisma } from "@prisma/client";
import { Request, Response } from "express";
import * as repository from "@repositories/PlantaRepository";

const fields = ["nome", "especie", "preco", "estoque", "luminosidade", "petFriendly", "regaACadaDias"] as const;
const maxInt = 2147483647;

class InvalidInput extends Error {}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidInput("Envie um objeto JSON no corpo da requisição.");
  }
  return value as Record<string, unknown>;
}

function positiveId(req: Request): number {
  const raw = req.params.id;
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(id) || id < 1 || id > maxInt) {
    throw new InvalidInput("O id deve ser um inteiro positivo válido.");
  }
  return id;
}

function integer(value: unknown, minimum: number, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maxInt) {
    throw new InvalidInput(`${field} deve ser um inteiro entre ${minimum} e ${maxInt}.`);
  }
}

function plantData(body: unknown, partial: boolean): Partial<Prisma.PlantaCreateInput> {
  const input = objectBody(body);
  const data: Record<string, unknown> = {};
  const extra = Object.keys(input).find((key) => !fields.includes(key as typeof fields[number]));
  if (extra) throw new InvalidInput(`Campo não permitido: ${extra}.`);
  if (partial && Object.keys(input).length === 0) {
    throw new InvalidInput("Envie ao menos um campo da planta para editar.");
  }
  for (const field of fields) {
    const value = input[field];
    if (value === undefined) {
      if (!partial) throw new InvalidInput(`O campo ${field} é obrigatório.`);
      continue;
    }
    if (field === "nome" || field === "especie") {
      if (typeof value !== "string" || value.trim() === "") {
        throw new InvalidInput(`${field} deve ser um texto não vazio.`);
      }
      data[field] = value.trim();
    } else if (field === "petFriendly") {
      if (typeof value !== "boolean") throw new InvalidInput("petFriendly deve ser true ou false.");
      data[field] = value;
    } else if (field === "luminosidade") {
      if (!Object.values(Luminosidade).includes(value as Luminosidade)) {
        throw new InvalidInput("luminosidade deve ser SOMBRA, MEIA_SOMBRA ou SOL_PLENO.");
      }
      data[field] = value;
    } else {
      integer(value, field === "estoque" ? 0 : 1, field);
      data[field] = value;
    }
  }
  return data;
}

function failure(error: unknown, res: Response) {
  if (error instanceof InvalidInput) return res.status(400).json({ message: error.message });
  // A planta pode ser removida por outra requisição entre a leitura e a escrita.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return res.status(404).json({ message: "Planta não encontrada." });
  }
  console.error(error);
  return res.status(500).json({ message: "Erro interno ao processar plantas." });
}

export const createPlanta = async (req: Request, res: Response) => {
  try {
    const data = plantData(req.body, false) as Prisma.PlantaCreateInput;
    return res.status(201).json(await repository.createPlanta(data));
  } catch (error) { return failure(error, res); }
};

export const readAllPlantas = async (req: Request, res: Response) => {
  try {
    const allowed = ["luminosidade", "petFriendly", "nome", "ordem"];
    for (const [key, value] of Object.entries(req.query)) {
      if (!allowed.includes(key) || typeof value !== "string") {
        throw new InvalidInput(`Filtro inválido: ${key}. Envie um único valor textual.`);
      }
    }
    const { luminosidade, petFriendly, nome, ordem } = req.query;
    const where: Prisma.PlantaWhereInput = {};
    if (luminosidade !== undefined) {
      if (!Object.values(Luminosidade).includes(luminosidade as Luminosidade)) {
        throw new InvalidInput("Filtro luminosidade inválido: use SOMBRA, MEIA_SOMBRA ou SOL_PLENO.");
      }
      where.luminosidade = luminosidade as Luminosidade;
    }
    if (petFriendly !== undefined) {
      if (petFriendly !== "true" && petFriendly !== "false") {
        throw new InvalidInput("Filtro petFriendly deve ser true ou false.");
      }
      where.petFriendly = petFriendly === "true";
    }
    if (nome !== undefined) {
      if (!(nome as string).trim()) throw new InvalidInput("Filtro nome não pode ser vazio.");
      where.nome = { contains: (nome as string).trim(), mode: "insensitive" };
    }
    if (ordem !== undefined && ordem !== "nome" && ordem !== "preco") {
      throw new InvalidInput("ordem deve ser nome ou preco.");
    }
    const orderBy: Prisma.PlantaOrderByWithRelationInput = ordem === "nome"
      ? { nome: "asc" } : ordem === "preco" ? { preco: "asc" } : { id: "asc" };
    return res.status(200).json(await repository.findAllPlantas(where, orderBy));
  } catch (error) { return failure(error, res); }
};

export const readPlantaById = async (req: Request, res: Response) => {
  try {
    const planta = await repository.findPlantaById(positiveId(req));
    if (!planta) return res.status(404).json({ message: "Planta não encontrada." });
    return res.status(200).json(planta);
  } catch (error) { return failure(error, res); }
};

export const updatePlanta = async (req: Request, res: Response) => {
  try {
    const id = positiveId(req);
    const data = plantData(req.body, true);
    if (!await repository.findPlantaById(id)) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }
    return res.status(200).json(await repository.updatePlanta(id, data));
  } catch (error) { return failure(error, res); }
};

export const deletePlanta = async (req: Request, res: Response) => {
  try {
    const id = positiveId(req);
    if (!await repository.findPlantaById(id)) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }
    await repository.deletePlanta(id);
    return res.status(204).send();
  } catch (error) { return failure(error, res); }
};

export const sellPlanta = async (req: Request, res: Response) => {
  try {
    const id = positiveId(req);
    const body = objectBody(req.body);
    if (Object.keys(body).some((key) => key !== "quantidade")) {
      throw new InvalidInput("A venda aceita somente o campo quantidade.");
    }
    integer(body.quantidade, 1, "quantidade");
    const result = await repository.sellPlanta(id, body.quantidade as number);
    if (!result.planta) return res.status(404).json({ message: "Planta não encontrada." });
    if (!result.sold) {
      return res.status(400).json({ message: `Estoque insuficiente. Temos só ${result.planta.estoque} vasos.` });
    }
    return res.status(200).json(result.planta);
  } catch (error) { return failure(error, res); }
};

export const stockValue = async (_req: Request, res: Response) => {
  try { return res.status(200).json(await repository.getStockValue()); }
  catch (error) { return failure(error, res); }
};

export const readSoldOut = async (_req: Request, res: Response) => {
  try { return res.status(200).json(await repository.findAllPlantas({ estoque: 0 })); }
  catch (error) { return failure(error, res); }
};
