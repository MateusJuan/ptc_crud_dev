# API Folhagem & Cia

API de loja de plantas com Node.js, Express, TypeScript, Prisma 5, PostgreSQL 16 e Docker. A base local é `http://localhost:3001`. O CRUD de usuários do treinamento foi preservado.

## Executar do zero

Pré-requisitos: Git, Node.js 20 ou superior e Docker Desktop em execução com o motor Linux/WSL 2.

```powershell
git clone https://github.com/MateusJuan/ptc_crud_dev.git
cd ptc_crud_dev
Copy-Item .env.example .env
npm.cmd install
docker compose up -d --build
docker compose exec -T server yarn migration:deploy
```

`migration:deploy` aplica as migrations já versionadas, sem alterar seu histórico. Para criar uma nova migration durante o desenvolvimento: `npm.cmd run migration -- --name nome_da_mudanca`. O `.env` é local e não deve ser enviado ao Git.

O Compose aguarda o healthcheck do PostgreSQL antes de iniciar a API. Abra `http://localhost:3001/` para conferir a mensagem de funcionamento.

```powershell
# Gerar o cliente local e verificar os tipos
npm.cmd run generate
npm.cmd run typecheck
# Testes HTTP: API e banco devem estar rodando; use um ambiente de desenvolvimento
npm.cmd test
# Exemplos opcionais: não executados automaticamente
docker compose exec -T server yarn seed:docker
# Alternativa de seed pelo Windows
npm.cmd run seed
# Logs e parada (preserva os volumes)
docker compose logs -f server
docker compose down
```

Os testes criam plantas com nomes próprios e removem os registros ao final. Não faça alterações de estoque em paralelo ao teste, pois ele compara os totais antes e depois. `TEST_API_URL` permite usar outra URL. O seed adiciona três exemplos; executá-lo novamente em sequência não duplica os exemplos e não redefine os estoques existentes. Não execute seeds simultaneamente.

## Modelo

| Campo | Tipo | Regra |
| --- | --- | --- |
| id | inteiro | Positivo, automático |
| nome | texto | Não vazio, espaços externos removidos |
| especie | texto | Não vazio, espaços externos removidos |
| preco | inteiro | Centavos, de 1 a 2147483647 |
| estoque | inteiro | De 0 a 2147483647 |
| luminosidade | enum | SOMBRA, MEIA_SOMBRA ou SOL_PLENO |
| petFriendly | booleano | true ou false, sem aspas |
| regaACadaDias | inteiro | De 1 a 2147483647 |
| createdAt | data ISO | Gerada no cadastro |
| updatedAt | data ISO | Atualizada pelo Prisma |

Todos os sete campos de negócio são obrigatórios no POST. O limite dos inteiros acompanha o `Int` do PostgreSQL. `0` no estoque e `false` em petFriendly são válidos. Números enviados como texto, decimais, null, campos desconhecidos e corpos que não sejam objetos retornam 400. `id` e datas não podem ser definidos pelo cliente.

## Rotas e exemplos

### POST /plantas

Corpo JSON:

```json
{
  "nome": "Costela-de-adão",
  "especie": "Monstera deliciosa",
  "preco": 8990,
  "estoque": 12,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": false,
  "regaACadaDias": 3
}
```

Resposta 201 (id e datas ilustrativos):

```json
{
  "id": 1,
  "nome": "Costela-de-adão",
  "especie": "Monstera deliciosa",
  "preco": 8990,
  "estoque": 12,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": false,
  "regaACadaDias": 3,
  "createdAt": "2026-10-30T01:00:00.000Z",
  "updatedAt": "2026-10-30T01:00:00.000Z"
}
```

400 se faltar campo ou houver valor inválido; 500 em falha inesperada.

### GET /plantas

Sem corpo. Retorna 200 com uma lista de objetos no formato acima, ou `[]` quando não houver resultados. Por padrão ordena por id crescente.

Filtros opcionais podem ser combinados:

| Parâmetro | Valores |
| --- | --- |
| luminosidade | SOMBRA, MEIA_SOMBRA, SOL_PLENO |
| petFriendly | true, false |
| nome | Trecho não vazio, sem diferenciar maiúsculas |
| ordem | preco ou nome, em ordem crescente |

Exemplo: `GET /plantas?luminosidade=MEIA_SOMBRA&petFriendly=false&nome=COSTELA&ordem=preco`. Retorna uma lista com as plantas correspondentes. Filtros inválidos, desconhecidos ou repetidos retornam 400. Falhas inesperadas retornam 500.

### GET /plantas/:id

Exemplo: `GET /plantas/1`, sem corpo. Retorna 200 com um objeto de planta. Id inválido: 400; planta ausente: 404; falha inesperada: 500.

### PATCH /plantas/:id

Exemplo: `PATCH /plantas/1` com `{"preco": 9500}`. Retorna 200 com a planta completa atualizada, mantendo os outros campos. Aceita um ou mais campos de negócio; um objeto vazio retorna 400. Aplica as mesmas validações do cadastro. Id ou dados inválidos: 400; planta ausente: 404; falha inesperada: 500.

### DELETE /plantas/:id

Exemplo: `DELETE /plantas/1`, sem corpo. Retorna 204 sem conteúdo. Id inválido: 400; planta ausente: 404; falha inesperada: 500.

### POST /plantas/:id/venda

Exemplo: `POST /plantas/1/venda` com `{"quantidade": 2}`. Quantidade deve ser um inteiro positivo até 2147483647. Se o estoque anterior era 12, retorna 200 com o objeto da planta e `estoque: 10`.

Id ou quantidade inválidos: 400. Estoque insuficiente: 400, sem alteração do estoque. Planta ausente: 404. Falha inesperada: 500.

O repository usa `updateMany` com `where: { id, estoque: { gte: quantidade } }` e decremento na mesma instrução. A leitura da planta atualizada ocorre na mesma transação. O PostgreSQL reavalia a condição após aguardar escritas concorrentes: apenas uma venda pode consumir o último vaso. Não basta conferir o estoque no controller e decrementar depois.

### GET /plantas/estoque/valor-total

Sem corpo. Retorna 200, por exemplo:

```json
{ "valorTotalEmCentavos": 107880, "totalDeVasos": 12 }
```

Calcula a soma de `preco × estoque` e a soma dos estoques. Sem plantas, ambos são zero. A soma usa BigInt internamente e converte para números JSON após verificar a precisão. Um total acima de `Number.MAX_SAFE_INTEGER` gera 500 em vez de devolver um valor arredondado. Falhas inesperadas também retornam 500.

### GET /plantas/esgotadas

Sem corpo. Retorna 200 com uma lista de plantas cujo estoque é zero, ou `[]`. Falha inesperada: 500. As rotas fixas são registradas antes de `/plantas/:id`.

## Formato de erro

```json
{ "message": "Estoque insuficiente. Temos só 1 vasos." }
```

Os erros das rotas de plantas e o JSON malformado retornam JSON com `message`. Erros inesperados são registrados no servidor sem expor detalhes do banco ao cliente. Uma URL não registrada retorna 404.

## Organização e escopo

`src/routes.ts` registra os endereços. `PlantaController.ts` valida e escolhe o status HTTP. `PlantaRepository.ts` é a camada que consulta o Prisma. `prisma/schema.prisma` descreve o modelo e `prisma/migrations/` contém o histórico SQL. `tests/plantas.test.mjs` testa a API real com PostgreSQL, incluindo oito vendas simultâneas do último vaso.

Foram incluídos todos os bônus: busca por nome, ordenação, plantas esgotadas e seed. A API não tem autenticação, pagamentos ou histórico de vendas: a venda do desafio apenas decrementa o estoque. A branch de trabalho é `main`, conforme solicitação do usuário e o DESAFIO.md do projeto.
