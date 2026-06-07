# 🚀 Deploy do Bolsinho - Render e Railway

Guia passo a passo para fazer deploy do Bolsinho usando **Render** (Frontend + Backend) e **Railway** (Backend + Banco de Dados).

## 📋 Pré-requisitos

- Conta no [Render](https://render.com)
- Conta no [Railway](https://railway.app)
- Repositório no GitHub: https://github.com/FilipeSCampos/Bolsinho.git
- API Keys configuradas:
  - `GROQ_API_KEY` - https://console.groq.com/keys
  - `NEWS_API_KEY` - https://newsapi.org/register
  - `BUILT_IN_FORGE_API_KEY` (opcional) - Para storage

---

## 🚂 Opção 1: Deploy Completo no Railway (Recomendado)

### Passo 1: Criar Projeto no Railway

1. Acesse: https://railway.app
2. Faça login com GitHub
3. Clique em **"New Project"**
4. Selecione **"Deploy from GitHub repo"**
5. Conecte o repositório: `FilipeSCampos/Bolsinho`
6. Clique em **"Deploy Now"**

### Passo 2: Adicionar Banco de Dados MySQL

1. No projeto Railway, clique em **"+ New"**
2. Selecione **"Database"** → **"Add MySQL"**
3. Aguarde a criação do banco
4. Clique no banco de dados criado
5. Vá em **"Variables"** e copie a URL de conexão:
   - Formato: `mysql://root:senha@host:porta/railway`
   - Anote essa URL, você precisará dela

### Passo 3: Configurar Variáveis de Ambiente

1. No projeto Railway, clique no serviço da aplicação
2. Vá em **"Variables"**
3. Adicione as seguintes variáveis:

```env
# Banco de Dados (use a URL do MySQL criado)
DATABASE_URL=mysql://root:senha@host:porta/railway

# Groq API
GROQ_API_KEY=sua_chave_groq_aqui

# NewsAPI
NEWS_API_KEY=sua_chave_newsapi_aqui

# JWT
JWT_SECRET=uma_chave_secreta_aleatoria_muito_segura

# Storage (opcional)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=sua_chave_forge_aqui

# Ambiente
NODE_ENV=production
PORT=3000
```

### Passo 4: Configurar Build e Deploy

1. No serviço da aplicação, vá em **"Settings"**
2. Em **"Build Command"**, configure:
   ```bash
   npm install -g pnpm@10.4.1 && pnpm install && pnpm build
   ```
3. Em **"Start Command"**, configure:
   ```bash
   pnpm start
   ```
4. Em **"Root Directory"**, deixe vazio (raiz do projeto)
5. Em **"Dockerfile Path"**, deixe vazio (não vamos usar Docker neste caso)

**OU** configure para usar Docker:

1. No **"Settings"**, ative **"Use Dockerfile"**
2. Railway detectará automaticamente o `Dockerfile`
3. O build será automático

### Passo 5: Executar Migrações do Banco

1. No Railway, clique no serviço da aplicação
2. Vá em **"Deployments"** → clique no deployment mais recente
3. Clique em **"View Logs"** para ver os logs
4. Para executar migrações, você pode:
   - **Opção A:** Adicionar um script no `package.json`:
     ```json
     "scripts": {
       "postinstall": "pnpm db:push || true"
     }
     ```
   - **Opção B:** Usar Railway CLI:
     ```bash
     railway run pnpm db:push
     ```

### Passo 6: Configurar Domínio (Opcional)

1. No serviço da aplicação, vá em **"Settings"**
2. Em **"Custom Domain"**, adicione seu domínio
3. Configure DNS conforme as instruções

---

## 🎨 Opção 2: Deploy no Render

### Passo 1: Criar Web Service no Render

1. Acesse: https://render.com
2. Faça login com GitHub
3. Clique em **"New +"** → **"Web Service"**
4. Conecte o repositório: `FilipeSCampos/Bolsinho`
5. Configure:
   - **Name:** `bolsinho`
   - **Region:** Escolha a região mais próxima
   - **Branch:** `main`
   - **Root Directory:** (deixe vazio)
   - **Runtime:** `Node`
   - **Build Command:** `npm install -g pnpm@10.4.1 && pnpm install && pnpm build`
   - **Start Command:** `pnpm start`

### Passo 2: Adicionar Banco de Dados PostgreSQL (Render)

1. No dashboard do Render, clique em **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name:** `bolsinho-db`
   - **Database:** `bolsinho`
   - **User:** (será gerado automaticamente)
   - **Region:** Mesma região do Web Service
3. Aguarde a criação
4. Copie a **Internal Database URL** (para uso dentro do Render)
5. Copie a **External Database URL** (para uso externo, se necessário)

### Passo 3: Configurar Variáveis de Ambiente no Render

1. No Web Service, vá em **"Environment"**
2. Adicione as variáveis:

```env
# Banco de Dados (use a Internal Database URL do PostgreSQL)
DATABASE_URL=postgresql://user:senha@host:porta/database

# Groq API
GROQ_API_KEY=sua_chave_groq_aqui

# NewsAPI
NEWS_API_KEY=sua_chave_newsapi_aqui

# JWT
JWT_SECRET=uma_chave_secreta_aleatoria_muito_segura

# Storage (opcional)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=sua_chave_forge_aqui

# Ambiente
NODE_ENV=production
PORT=3000

# Python (para o venv)
PYTHON_VERSION=3.11
```

### Passo 4: Configurar Buildpack Python (Render)

O Render precisa saber que há código Python. Adicione um arquivo `render.yaml` na raiz:

```yaml
services:
  - type: web
    name: bolsinho
    env: node
    buildCommand: npm install -g pnpm@10.4.1 && pnpm install && pnpm build
    startCommand: pnpm start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: bolsinho-db
          property: connectionString
      - key: GROQ_API_KEY
        sync: false
      - key: NEWS_API_KEY
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
```

### Passo 5: Executar Migrações

1. Após o primeiro deploy, vá em **"Shell"** no Web Service
2. Execute:
   ```bash
   pnpm db:push
   ```

---

## 🔄 Opção 3: Frontend no Render + Backend no Railway

### Parte 1: Backend no Railway

Siga os passos da **Opção 1** acima para configurar o backend no Railway.

### Parte 2: Frontend no Render

1. No Render, crie um novo **"Static Site"**
2. Conecte o repositório
3. Configure:
   - **Build Command:** `npm install -g pnpm@10.4.1 && pnpm install && pnpm build`
   - **Publish Directory:** `dist/public`
4. Configure variáveis de ambiente:
   - `VITE_API_URL=https://seu-backend.railway.app`

---

## ⚙️ Configurações Importantes

### Para Railway

1. **Dockerfile:** Railway detecta automaticamente o `Dockerfile`
2. **Python:** O Dockerfile já configura o ambiente Python
3. **Dependências:** Todas as dependências são instaladas automaticamente
4. **Porta:** Railway define automaticamente a porta via `PORT`

### Para Render

1. **Buildpack:** Render detecta automaticamente Node.js
2. **Python:** Configure via `render.yaml` ou adicione buildpack Python
3. **Dependências:** Instaladas automaticamente via `pnpm install`
4. **Porta:** Render define via variável `PORT`

### Problemas Comuns

#### Erro: "Python not found"
**Solução:** Use o Dockerfile ou configure buildpack Python no Render

#### Erro: "Tesseract not found"
**Solução:** O Dockerfile já instala Tesseract. Se não usar Docker, configure manualmente

#### Erro: "Poppler not found"
**Solução:** O Dockerfile já instala Poppler. Se não usar Docker, configure manualmente

#### Erro: "Database connection failed"
**Solução:** 
- Verifique se a `DATABASE_URL` está correta
- Verifique se o banco está acessível
- No Railway, use a URL interna do banco
- No Render, use a Internal Database URL

#### Erro: "API Key not configured"
**Solução:** Verifique se todas as variáveis de ambiente estão configuradas

---

## 🧪 Testar o Deploy

Após o deploy, teste:

1. **Health Check:**
   ```
   GET https://seu-app.railway.app/api/trpc/system.health
   ```

2. **Frontend:**
   ```
   https://seu-app.railway.app
   ```

3. **Teste de Chat:**
   - Acesse o frontend
   - Envie uma mensagem de teste
   - Verifique os logs para erros

---

## 📊 Monitoramento

### Railway

- **Logs:** Disponíveis em tempo real no dashboard
- **Métricas:** CPU, Memória, Network
- **Alertas:** Configure em Settings → Notifications

### Render

- **Logs:** Disponível em Logs do serviço
- **Métricas:** Disponível no dashboard
- **Uptime:** Monitorado automaticamente

---

## 🔄 Atualizações

Para atualizar a aplicação:

1. Faça push para o repositório GitHub:
   ```bash
   git add .
   git commit -m "Atualização"
   git push
   ```

2. O Railway/Render detectará automaticamente e fará novo deploy

3. Aguarde o deploy completar (2-5 minutos)

---

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique os logs:** Railway/Render → Logs
2. **Verifique variáveis de ambiente:** Settings → Environment
3. **Verifique o banco de dados:** Conectividade e migrações
4. **Verifique as API keys:** Se estão corretas e ativas

---

## 📝 Checklist de Deploy

- [ ] Repositório conectado
- [ ] Banco de dados criado
- [ ] Variáveis de ambiente configuradas
- [ ] Build configurado corretamente
- [ ] Migrações executadas
- [ ] Aplicação acessível
- [ ] Health check funcionando
- [ ] Chat funcionando
- [ ] Upload de arquivos funcionando
- [ ] Processamento de PDFs funcionando

---

**Pronto!** Seu Bolsinho está no ar! 🚀

