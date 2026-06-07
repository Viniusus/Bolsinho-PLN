# Memória Persistente do Usuário

## Objetivo

Adicionar uma camada persistente para que o Bolsinho resgate informações úteis do usuário, personalize respostas e reaproveite contexto financeiro em chats futuros.

## Tabelas Criadas

- `userProfiles`: perfil financeiro estável do usuário.
- `userMemories`: memórias persistentes extraídas da conversa.
- `userPreferences`: preferências simples em chave/valor.

## Fluxo Do Chat

1. O chat recebe a mensagem do usuário.
2. O backend identifica `userId` quando existe autenticação.
3. O contexto persistente é carregado com `getUserRagContext(userId)`.
4. Esse contexto é injetado no prompt antes da chamada ao modelo.
5. A resposta do modelo é retornada ao frontend.
6. Em seguida, o histórico do chat é salvo em `chatMessages` quando há usuário autenticado.
7. A extração de memórias roda em background e salva novos itens relevantes em `userMemories`.

## Variáveis De Ambiente

- `DATABASE_URL=mysql://finbot:finbot_password@localhost:3307/finbot`
- `JWT_SECRET=change_me`
- `GROQ_API_KEY=change_me`
- `NEWS_API_KEY=change_me`

Opcional:

- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

## Comandos

Subir banco local:

```bash
docker compose up -d
```

Aplicar schema:

```bash
pnpm db:push
```

## Endpoints

- `userMemory.list`
- `userMemory.create`
- `userMemory.disable`
- `userMemory.context`
- `userMemory.profile.get`
- `userMemory.profile.upsert`

## Limitações Atuais

- A extração automática de memórias ainda usa fallback heurístico quando o modelo não responde com JSON válido.
- O chat anônimo continua funcionando sem memória persistente.
- A persistência de memórias depende de usuário autenticado para os endpoints de gerenciamento.

## Próximos Passos

- Melhorar a classificação automática de memórias com um extrator dedicado.
- Adicionar endpoints de preferências se o produto precisar editar a tabela manualmente.
- Criar testes automatizados para o fluxo de extração e deduplicação.