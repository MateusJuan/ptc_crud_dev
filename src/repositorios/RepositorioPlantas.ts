import { Prisma } from "@prisma/client";
import prisma from "@banco";

export const criarPlanta = (dados: Prisma.PlantaCreateInput) =>
  prisma.planta.create({ data: dados });

export const buscarTodasPlantas = (
  filtros: Prisma.PlantaWhereInput = {},
  ordenacao: Prisma.PlantaOrderByWithRelationInput = { id: "asc" },
) => prisma.planta.findMany({ where: filtros, orderBy: ordenacao });

export const buscarPlantaPorId = (id: number) =>
  prisma.planta.findUnique({ where: { id } });

export const atualizarPlanta = (id: number, dados: Prisma.PlantaUpdateInput) =>
  prisma.planta.update({ where: { id }, data: dados });

export const excluirPlanta = (id: number) => prisma.planta.delete({ where: { id } });

export const venderPlanta = (id: number, quantidade: number) =>
  prisma.$transaction(async (transacao) => {
    // A condição e o decremento acontecem juntos no banco: duas vendas
    // simultâneas não conseguem consumir o mesmo último vaso.
    const resultado = await transacao.planta.updateMany({
      where: { id, estoque: { gte: quantidade } },
      data: { estoque: { decrement: quantidade } },
    });
    const planta = await transacao.planta.findUnique({ where: { id } });
    return { vendaRealizada: resultado.count === 1, planta };
  });

export const calcularValorEstoque = async () => {
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
  if (
    valor > BigInt(Number.MAX_SAFE_INTEGER) ||
    vasos > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error("Total do estoque excede o limite numérico seguro da API.");
  }
  return { valorTotalEmCentavos: Number(valor), totalDeVasos: Number(vasos) };
};
