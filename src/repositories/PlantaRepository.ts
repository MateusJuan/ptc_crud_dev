import { Prisma } from "@prisma/client";
import prisma from "@database";

export const createPlanta = (data: Prisma.PlantaCreateInput) =>
  prisma.planta.create({ data });

export const findAllPlantas = (
  where: Prisma.PlantaWhereInput = {},
  orderBy: Prisma.PlantaOrderByWithRelationInput = { id: "asc" },
) => prisma.planta.findMany({ where, orderBy });

export const findPlantaById = (id: number) =>
  prisma.planta.findUnique({ where: { id } });

export const updatePlanta = (id: number, data: Prisma.PlantaUpdateInput) =>
  prisma.planta.update({ where: { id }, data });

export const deletePlanta = (id: number) =>
  prisma.planta.delete({ where: { id } });

export const sellPlanta = (id: number, quantidade: number) =>
  prisma.$transaction(async (transaction) => {
    // A condição e o decremento acontecem juntos no banco: duas vendas
    // simultâneas não conseguem consumir o mesmo último vaso.
    const result = await transaction.planta.updateMany({
      where: { id, estoque: { gte: quantidade } },
      data: { estoque: { decrement: quantidade } },
    });
    const planta = await transaction.planta.findUnique({ where: { id } });
    return { sold: result.count === 1, planta };
  });

export const getStockValue = async () => {
  const plantas = await prisma.planta.findMany({
    select: { preco: true, estoque: true },
  });
  // BigInt evita arredondamento durante a soma de preços em centavos.
  let valor = 0n;
  let vasos = 0n;
  for (const planta of plantas) {
    valor += BigInt(planta.preco) * BigInt(planta.estoque);
    vasos += BigInt(planta.estoque);
  }
  if (valor > BigInt(Number.MAX_SAFE_INTEGER) || vasos > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Total do estoque excede o limite numérico seguro da API.");
  }
  return { valorTotalEmCentavos: Number(valor), totalDeVasos: Number(vasos) };
};
