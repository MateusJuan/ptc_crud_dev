# Relatório do desafio Folhagem & Cia

Este registro foi preparado com assistência do Codex a partir do trabalho realizado neste projeto. Deve ser revisado pelo candidato antes da entrega, especialmente a parte pessoal: ele não deve ser apresentado como um relato escrito integralmente sem IA.

## O que foi feito

Foi criado o modelo Planta com enum Luminosidade e migration PostgreSQL. Foram implementados cadastro, listagem com filtros, consulta por id, edição parcial, exclusão, venda e cálculo do valor total do estoque. Os quatro bônus também foram incluídos: busca por nome sem diferenciar maiúsculas, ordenação por nome ou preço, listagem de esgotadas e seed com exemplos.

As validações aceitam estoque zero e petFriendly false, rejeitam números enviados como texto e aplicam as mesmas regras aos campos enviados no PATCH. A venda faz uma atualização condicional em transação para impedir estoque negativo quando há requisições simultâneas. O documento API.md contém as instruções e exemplos.

## Como foi feito

Primeiro foi importado o projeto-base com o CRUD de usuários. Depois foram preparados Docker Desktop, WSL 2 e PostgreSQL, e o CRUD existente foi testado. Em seguida foram criados o modelo e a migration das plantas, depois o repository, o controller, as rotas, os bônus e os testes HTTP. O trabalho permaneceu em main por solicitação do usuário.

Foi mantida a separação do projeto: controller para validação e respostas; repository para acesso ao Prisma. Os preços são inteiros em centavos. A lista permite combinar os filtros em uma consulta. O total do estoque é calculado em código a partir de preço e quantidade. Foi usada uma soma BigInt para evitar arredondamento e verificado o limite antes de responder em JSON.

## Dificuldades observadas durante o trabalho

O ambiente não tinha WSL instalado e o Docker precisava dos componentes de virtualização do Windows. O WSL e o Docker foram instalados, os componentes habilitados e o computador reiniciado pelo usuário. A primeira inicialização do Docker precisou copiar suas imagens internas, o que demorou alguns minutos.

O PostgreSQL ainda estava inicializando na primeira tentativa de migration, causando P1001. Após confirmar sua prontidão a migration funcionou; foi acrescentado um healthcheck ao Compose para a API aguardar o banco nas próximas inicializações.

Após editar arquivos do servidor, o processo de desenvolvimento precisou ser reiniciado antes dos testes HTTP. Os testes são executados contra a API e o banco reais para verificar os status, a persistência e as vendas concorrentes.

## Uso de IA

Foi utilizado o Codex, da OpenAI, para preparar o ambiente, ler os requisitos, gerar e editar código, executar comandos, criar testes e preparar a documentação. A conferência técnica incluiu geração do Prisma Client, aplicação e verificação das migrations, typecheck e testes HTTP. O teste de concorrência tenta vender oito vezes um único vaso e exige exatamente uma resposta 200, sete respostas 400 e estoque final zero.

## Verificações realizadas

- Migration da Planta aplicada e `prisma migrate status` sem pendências.
- `npm.cmd run typecheck` sem erros.
- `npm.cmd run build` compilou os sete arquivos TypeScript.
- `npm.cmd test` passou com PostgreSQL real: cadastro, campos obrigatórios, tipos e limites inválidos, PATCH, filtros, buscas, ordenação, esgotadas, totais, venda, oito vendas simultâneas e exclusão.
- Totais zerados verificados antes de adicionar exemplos ao banco vazio.
- Seed executado uma vez pelo Docker e outra pelo Windows, mantendo três plantas sem duplicação.
- Contêiner do PostgreSQL saudável e API disponível na porta 3001.

## Reflexão pessoal a preencher pelo candidato

- O que você entendeu sobre o caminho rota → controller → repository → banco?
- Qual validação ou erro teve mais dificuldade de entender e como verificou a solução?
- Explique com suas palavras por que ler o estoque e decrementar em duas operações independentes permite uma venda indevida.
- Que partes do código você revisou, alterou ou testou pessoalmente e o que aprendeu com a ajuda de IA?

Essas respostas devem registrar sua experiência real. Não foram inventadas pela IA.
