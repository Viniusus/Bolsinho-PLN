# Solução para Erro de Acesso ao Banco de Dados

## Problema
Erro: `Access denied for user 'usuario'@'localhost' (using password: YES)`

Isso significa que as credenciais do MySQL estão incorretas ou o usuário/banco de dados não existe.

## Soluções

### Opção 1: Usar Docker (Recomendado)

A forma mais fácil é usar o Docker Compose que já está configurado:

1. **Inicie o banco de dados com Docker:**
   ```bash
   docker-compose up -d db
   ```

2. **Crie o arquivo `.env` na raiz do projeto:**
   ```env
   DATABASE_URL=mysql://finbot:finbot_password@localhost:3306/finbot
   GROQ_API_KEY=sua_chave_groq_aqui
   NEWS_API_KEY=sua_chave_newsapi_aqui
   JWT_SECRET=sua_chave_secreta_aleatoria
   ```

3. **Execute as migrações:**
   ```bash
   pnpm db:push
   ```

### Opção 2: MySQL Local

Se preferir usar MySQL instalado localmente:

1. **Certifique-se de que o MySQL está rodando:**
   - Windows: Verifique nos Serviços do Windows se o MySQL está iniciado
   - Ou execute: `mysql --version` para verificar se está instalado

2. **Conecte ao MySQL como root:**
   ```bash
   mysql -u root -p
   ```

3. **Crie o banco de dados e usuário:**
   ```sql
   CREATE DATABASE finbot;
   CREATE USER 'finbot'@'localhost' IDENTIFIED BY 'sua_senha_aqui';
   GRANT ALL PRIVILEGES ON finbot.* TO 'finbot'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

4. **Crie o arquivo `.env` na raiz do projeto:**
   ```env
   DATABASE_URL=mysql://finbot:sua_senha_aqui@localhost:3306/finbot
   GROQ_API_KEY=sua_chave_groq_aqui
   NEWS_API_KEY=sua_chave_newsapi_aqui
   JWT_SECRET=sua_chave_secreta_aleatoria
   ```

5. **Execute as migrações:**
   ```bash
   pnpm db:push
   ```

### Opção 3: Usar Usuário Root Existente

Se você já tem um MySQL rodando e quer usar o usuário root:

1. **Crie o banco de dados:**
   ```bash
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE finbot;
   EXIT;
   ```

2. **Crie o arquivo `.env` na raiz do projeto:**
   ```env
   DATABASE_URL=mysql://root:sua_senha_root@localhost:3306/finbot
   GROQ_API_KEY=sua_chave_groq_aqui
   NEWS_API_KEY=sua_chave_newsapi_aqui
   JWT_SECRET=sua_chave_secreta_aleatoria
   ```

3. **Execute as migrações:**
   ```bash
   pnpm db:push
   ```

## Formato da DATABASE_URL

O formato correto é:
```
mysql://usuario:senha@host:porta/nome_do_banco
```

Exemplos:
- `mysql://root:minhasenha@localhost:3306/finbot`
- `mysql://finbot:finbot_password@localhost:3306/finbot`
- `mysql://usuario:senha123@127.0.0.1:3306/finbot`

## Verificações

1. **Verifique se o arquivo `.env` existe na raiz do projeto**
2. **Verifique se o MySQL está rodando:**
   - Windows: Serviços do Windows → MySQL
   - Ou: `mysqladmin ping` ou `mysql -u root -p`
3. **Teste a conexão manualmente:**
   ```bash
   mysql -u seu_usuario -p -h localhost finbot
   ```

## Nota Importante

O arquivo `.env` está no `.gitignore` e não será commitado no repositório. Você precisa criá-lo localmente seguindo um dos métodos acima.

