import { Prisma } from "@prisma/client";
import prisma from "@banco";

export const criarUsuario = async (dados: Prisma.UsuarioCreateInput) => {
  return await prisma.usuario.create({
    data: dados,
  });
};

export const buscarTodosUsuarios = async () => {
  return await prisma.usuario.findMany();
};

export const buscarUsuarioPorId = async (id: number) => {
  return await prisma.usuario.findUnique({
    where: { id: id },
  });
};

export const atualizarUsuario = async (id: number, dados: Prisma.UsuarioUpdateInput) => {
  return await prisma.usuario.update({
    where: { id: id },
    data: dados,
  });
};

export const excluirUsuario = async (id: number) => {
  return await prisma.usuario.delete({
    where: { id: id },
  });
};
