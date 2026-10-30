import { PrismaClient as ClientePrisma } from "@prisma/client";

const prisma = new ClientePrisma();

prisma
  .$connect()
  .then(() => {
    console.log("📦 Conexão com o banco realizada");
  })
  .catch((erro) => {
    console.log("❌ Erro ao conectar ao banco", erro);
  });

export default prisma;
