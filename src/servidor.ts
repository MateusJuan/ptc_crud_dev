import "dotenv/config";
import expresso, { ErrorRequestHandler as TratadorErro } from "express";
import rotas from "./rotas";

const aplicacao = expresso();

aplicacao.use(expresso.json());
aplicacao.use(rotas);

const tratarErro: TratadorErro = (erro, _requisicao, resposta, _proximo) => {
  if (erro.type === "entity.parse.failed") {
    resposta.status(400).json({ mensagem: "JSON inválido no corpo da requisição." });
    return;
  }
  console.error(erro);
  resposta.status(500).json({ mensagem: "Erro interno ao processar a requisição." });
};
aplicacao.use(tratarErro);

// Qualquer rota que não existe cai aqui
aplicacao.use((requisicao, resposta) => {
  resposta.status(404).json({ mensagem: "Rota não encontrada" });
});

const porta = process.env.SERVER_PORT || 3001;

aplicacao.listen(porta, () => {
  console.log(`🚀 Servidor rodando na porta ${porta}`);
});
