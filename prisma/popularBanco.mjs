import { Luminosidade, PrismaClient as ClientePrisma } from "@prisma/client";

const prisma = new ClientePrisma();

async function popularBanco() {
  const exemplos = [
    {
      nome: "Costela-de-adão",
      especie: "Monstera deliciosa",
      preco: 8990,
      estoque: 12,
      luminosidade: Luminosidade.MEIA_SOMBRA,
      petFriendly: false,
      regaACadaDias: 7,
    },
    {
      nome: "Maranta",
      especie: "Maranta leuconeura",
      preco: 4590,
      estoque: 8,
      luminosidade: Luminosidade.SOMBRA,
      petFriendly: true,
      regaACadaDias: 3,
    },
    {
      nome: "Girassol",
      especie: "Helianthus annuus",
      preco: 2990,
      estoque: 0,
      luminosidade: Luminosidade.SOL_PLENO,
      petFriendly: true,
      regaACadaDias: 1,
    },
  ];
  await prisma.$transaction(async (transacao) => {
    for (const dados of exemplos) {
      // Repetir o seed preserva o estoque e o preço dos exemplos existentes.
      if (
        !(await transacao.planta.findFirst({
          where: { nome: dados.nome, especie: dados.especie },
        }))
      ) {
        await transacao.planta.create({ data: dados });
      }
    }
  });
}

popularBanco()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
