import expresso from "express";
import * as controladorUsuarios from "@controladores/ControladorUsuarios";
import * as controladorPlantas from "@controladores/ControladorPlantas";

const rotas = expresso.Router();

rotas.get("/", (requisicao, resposta) => {
  resposta.status(200).json({ mensagem: "API do treinamento de CRUD do CITi 🚀" });
});

// CRUD de usuários
rotas.post("/users", controladorUsuarios.criarUsuario);
rotas.get("/users", controladorUsuarios.listarUsuarios);
rotas.get("/users/:id", controladorUsuarios.buscarUsuarioPorId);
rotas.patch("/users/:id", controladorUsuarios.atualizarUsuario);
rotas.delete("/users/:id", controladorUsuarios.excluirUsuario);

rotas.post("/plantas", controladorPlantas.criarPlanta);
rotas.get("/plantas", controladorPlantas.listarPlantas);
// Rotas fixas precisam vir antes de /plantas/:id.
rotas.get("/plantas/estoque/valor-total", controladorPlantas.consultarValorEstoque);
rotas.get("/plantas/esgotadas", controladorPlantas.listarPlantasEsgotadas);
rotas.get("/plantas/:id", controladorPlantas.buscarPlantaPorId);
rotas.patch("/plantas/:id", controladorPlantas.atualizarPlanta);
rotas.delete("/plantas/:id", controladorPlantas.excluirPlanta);
rotas.post("/plantas/:id/venda", controladorPlantas.venderPlanta);

export default rotas;
