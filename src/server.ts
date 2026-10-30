import "dotenv/config";
import express, { ErrorRequestHandler } from "express";
import routes from "./routes";

const app = express();

app.use(express.json());
app.use(routes);

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") {
    res.status(400).json({ message: "JSON inválido no corpo da requisição." });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Erro interno ao processar a requisição." });
};
app.use(handleError);

// Qualquer rota que não existe cai aqui
app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

const port = process.env.SERVER_PORT || 3001;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
