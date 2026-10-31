# Folhagem & Cia — API de plantas

Implementação do desafio com CRUD de plantas, filtros, venda com controle concorrente de estoque, total do estoque e todos os bônus. O CRUD de usuários do treinamento continua disponível.

- [Documento completo da API: instalação, modelo, rotas, exemplos e erros](API.md)
- [Relatório do trabalho e uso de IA em PDF](output/pdf/Relatorio_Folhagem_e_Cia.pdf)

Com Docker Desktop aberto e `.env` copiado de `.env.example`:

```powershell
npm.cmd install
docker compose up -d --build
docker compose exec -T server yarn migration:deploy
npm.cmd run generate
npm.cmd run typecheck
npm.cmd test
```

Exemplos opcionais: `docker compose exec -T server yarn seed:docker`. A API fica em `http://localhost:3001`. O teste HTTP usa a API e o PostgreSQL locais e remove as plantas temporárias ao terminar.

Para organizar a indentação, os espaços e as quebras de linha, execute `npm.cmd run formatar`. Para conferir o padrão sem alterar os arquivos, use `npm.cmd run verificar:formatacao`. A configuração utiliza dois espaços e limita as linhas de código a 90 caracteres quando possível.

O CRUD de usuários original está disponível em `/users` (POST e GET) e `/users/:id` (GET, PATCH e DELETE). O enunciado original está em [DESAFIO.md](DESAFIO.md).
