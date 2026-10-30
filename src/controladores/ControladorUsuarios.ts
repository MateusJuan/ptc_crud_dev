import { Request as Requisicao, Response as Resposta } from "express";
import * as repositorioUsuarios from "@repositorios/RepositorioUsuarios";

// O controlador recebe a requisição, valida os dados, chama o repositório
// e decide qual status HTTP e qual corpo devolver.

export const criarUsuario = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const { nome, conta, documento } = requisicao.body;

    // 400 Dados inválidos: o cliente mandou dados incompletos
    if (!nome || !conta || !documento) {
      return resposta.status(400).json({
        mensagem: "Preencha nome, conta e documento.",
      });
    }

    const usuario = await repositorioUsuarios.criarUsuario({
      nome: nome,
      conta: conta,
      documento: documento,
    });

    // 201 Criado: algo novo foi criado
    return resposta.status(201).json(usuario);
  } catch (erro) {
    console.error(erro);
    // 500 Erro interno: o problema foi nosso, não do cliente
    return resposta.status(500).json({ mensagem: "Erro ao criar usuário." });
  }
};

export const listarUsuarios = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const usuarios = await repositorioUsuarios.buscarTodosUsuarios();

    return resposta.status(200).json(usuarios);
  } catch (erro) {
    console.error(erro);
    return resposta.status(500).json({ mensagem: "Erro ao buscar usuários." });
  }
};

export const buscarUsuarioPorId = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    // O id chega da URL como texto, então convertemos para número
    const id = Number(requisicao.params.id);

    const usuario = await repositorioUsuarios.buscarUsuarioPorId(id);

    // 404 Não encontrado: o id não existe
    if (!usuario) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    return resposta.status(200).json(usuario);
  } catch (erro) {
    console.error(erro);
    return resposta.status(500).json({ mensagem: "Erro ao buscar usuário." });
  }
};

export const atualizarUsuario = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const id = Number(requisicao.params.id);
    const { nome, conta, documento } = requisicao.body;

    // Antes de editar, garantimos que o usuário existe
    const usuario = await repositorioUsuarios.buscarUsuarioPorId(id);

    if (!usuario) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    // PATCH = atualização parcial: campos não enviados (undefined) não são alterados
    const usuarioAtualizado = await repositorioUsuarios.atualizarUsuario(id, {
      nome: nome,
      conta: conta,
      documento: documento,
    });

    return resposta.status(200).json(usuarioAtualizado);
  } catch (erro) {
    console.error(erro);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar usuário." });
  }
};

export const excluirUsuario = async (requisicao: Requisicao, resposta: Resposta) => {
  try {
    const id = Number(requisicao.params.id);

    const usuario = await repositorioUsuarios.buscarUsuarioPorId(id);

    if (!usuario) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    await repositorioUsuarios.excluirUsuario(id);

    // 204 Sem conteúdo: deu certo e não há nada para devolver
    return resposta.status(204).send();
  } catch (erro) {
    console.error(erro);
    return resposta.status(500).json({ mensagem: "Erro ao deletar usuário." });
  }
};
