import { Luminosidade, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const examples = [
    { nome: "Costela-de-adão", especie: "Monstera deliciosa", preco: 8990, estoque: 12, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: false, regaACadaDias: 7 },
    { nome: "Maranta", especie: "Maranta leuconeura", preco: 4590, estoque: 8, luminosidade: Luminosidade.SOMBRA, petFriendly: true, regaACadaDias: 3 },
    { nome: "Girassol", especie: "Helianthus annuus", preco: 2990, estoque: 0, luminosidade: Luminosidade.SOL_PLENO, petFriendly: true, regaACadaDias: 1 },
  ];
  await prisma.$transaction(async (transaction) => {
    for (const data of examples) {
      // Repetir o seed preserva o estoque e o preço dos exemplos existentes.
      if (!await transaction.planta.findFirst({ where: { nome: data.nome, especie: data.especie } })) {
        await transaction.planta.create({ data });
      }
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
