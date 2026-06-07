# 🚀 Deploy do Bolsinho na Google Cloud Platform

Guia completo para fazer deploy do Bolsinho usando **Google Cloud Run** (recomendado) ou **Google Compute Engine**.

## ❓ Preciso Comprar um Domínio?

**NÃO!** Você pode acessar de qualquer lugar sem comprar domínio:

- **Cloud Run:** Fornece URL HTTPS gratuita automaticamente (ex: `https://bolsinho-xxxxx.run.app`)
- **Compute Engine (VM):** Fornece IP externo que você acessa diretamente (ex: `http://34.123.45.67:3000`)

**Domínio customizado é opcional** e só necessário se você quiser uma URL personalizada como `bolsinho.seudominio.com`.

## 📋 Pré-requisitos

- Conta no [Google Cloud Platform](https://cloud.google.com)
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) instalado
- Projeto criado no GCP
- API Keys configuradas:
  - `GROQ_API_KEY`
  - `NEWS_API_KEY`
  - `BUILT_IN_FORGE_API_KEY` (opcional)

---

## ☁️ Opção 1: Google Cloud Run (Recomendado - Serverless)

### ✅ Vantagem: URL HTTPS Automática (Sem precisar de domínio!)

O Cloud Run fornece automaticamente uma URL HTTPS gratuita no formato:
```
https://bolsinho-XXXXX-uc.a.run.app
```

**Você pode acessar de qualquer lugar** sem precisar comprar domínio! 🎉

### Passo 1: Configurar Google Cloud SDK

1. **Instale o gcloud CLI:**
   - Windows: https://cloud.google.com/sdk/docs/install
   - Ou use: `choco install gcloudsdk` (se tiver Chocolatey)

2. **Faça login:**
   ```bash
   gcloud auth login
   ```

3. **Configure o projeto:**
   ```bash
   gcloud config set project SEU_PROJECT_ID
   ```

4. **Habilite APIs necessárias:**
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   ```

### Passo 2: Criar Banco de Dados Cloud SQL (MySQL)

1. **Crie uma instância MySQL:**
   ```bash
   gcloud sql instances create bolsinho-db \
     --database-version=MYSQL_8_0 \
     --tier=db-f1-micro \
     --region=us-central1 \
     --root-password=SUA_SENHA_ROOT_SEGURA
   ```

2. **Crie o banco de dados:**
   ```bash
   gcloud sql databases create finbot --instance=bolsinho-db
   ```

3. **Crie um usuário:**
   ```bash
   gcloud sql users create finbot \
     --instance=bolsinho-db \
     --password=SUA_SENHA_USUARIO_SEGURA
   ```

4. **Obtenha a connection string:**
   ```bash
   gcloud sql instances describe bolsinho-db --format="value(connectionName)"
   ```
   - Anote o `connectionName` (formato: `projeto:regiao:bolsinho-db`)

### Passo 3: Verificar configuração de PORT

O código já está configurado para usar `process.env.PORT || 3000`. Cloud Run fornece `PORT=8080` automaticamente, então está tudo OK.

### Passo 4: Configurar Dockerfile para Cloud Run

O Dockerfile já está pronto e funcionará no Cloud Run. Apenas certifique-se de que está usando a variável PORT corretamente.

**Criar `Dockerfile.cloudrun`** (opcional - pode usar o Dockerfile existente):

```dockerfile
# Multi-stage build para Cloud Run
FROM node:22-slim AS builder

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Instalar pnpm e dependências
RUN npm install -g pnpm@10.4.1
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build
RUN pnpm build

# Stage 2: Production
FROM node:22-slim

# Instalar dependências de runtime
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar pnpm
RUN npm install -g pnpm@10.4.1

# Copiar do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json pnpm-lock.yaml ./
COPY server ./server
COPY drizzle ./drizzle
COPY shared ./shared

# Instalar dependências Python
COPY requirements.txt ./
RUN python3.11 -m venv /app/venv && \
    /app/venv/bin/pip install --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

ENV PATH="/app/venv/bin:$PATH"

# Criar diretórios
RUN mkdir -p /app/uploads /app/server/temp
RUN chmod -R 755 /app/uploads /app/server/temp

# Cloud Run usa a variável PORT automaticamente
ENV NODE_ENV=production
ENV PORT=8080

# Expor porta (Cloud Run usa PORT variável)
EXPOSE 8080

CMD ["pnpm", "start"]
```

**Nota:** Você pode usar o Dockerfile existente, apenas certifique-se de que ele expõe a porta 8080 ou usa a variável PORT.

Verificar se o código já usa `process.env.PORT`. Se não, vamos garantir:

O código já está configurado para usar `process.env.PORT || 3000`, então está OK.

### Passo 5: Build e Deploy no Cloud Run

**Importante:** O Cloud Run requer que a aplicação escute na porta fornecida pela variável de ambiente `PORT`. O código já está configurado para isso.

1. **Build a imagem:**
   ```bash
   gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/bolsinho
   ```

2. **Deploy no Cloud Run:**
   ```bash
   gcloud run deploy bolsinho \
     --image gcr.io/SEU_PROJECT_ID/bolsinho \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --add-cloudsql-instances=SEU_PROJECT_ID:us-central1:bolsinho-db \
     --set-env-vars="DATABASE_URL=mysql://finbot:SUA_SENHA_USUARIO@/finbot?unix_socket=/cloudsql/SEU_PROJECT_ID:us-central1:bolsinho-db" \
     --set-env-vars="GROQ_API_KEY=sua_chave_groq" \
     --set-env-vars="NEWS_API_KEY=sua_chave_newsapi" \
     --set-env-vars="JWT_SECRET=sua_chave_secreta_aleatoria" \
     --set-env-vars="NODE_ENV=production" \
     --set-env-vars="PORT=8080" \
     --memory=2Gi \
     --cpu=2 \
     --timeout=300 \
     --max-instances=10
   ```

**OU** use um arquivo `.env.yaml`:

1. **Crie `.env.yaml`:**
   ```yaml
   DATABASE_URL: mysql://finbot:SUA_SENHA@/finbot?unix_socket=/cloudsql/SEU_PROJECT_ID:us-central1:bolsinho-db
   GROQ_API_KEY: sua_chave_groq
   NEWS_API_KEY: sua_chave_newsapi
   JWT_SECRET: sua_chave_secreta_aleatoria
   NODE_ENV: production
   PORT: 8080
   ```

2. **Deploy com arquivo de env:**
   ```bash
   gcloud run deploy bolsinho \
     --image gcr.io/SEU_PROJECT_ID/bolsinho \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --add-cloudsql-instances=SEU_PROJECT_ID:us-central1:bolsinho-db \
     --env-vars-file=.env.yaml \
     --memory=2Gi \
     --cpu=2 \
     --timeout=300
   ```

### Passo 6: Configurar Secret Manager (Recomendado para produção)

Para maior segurança, use Secret Manager:

1. **Criar secrets:**
   ```bash
   echo -n "sua_chave_groq" | gcloud secrets create groq-api-key --data-file=-
   echo -n "sua_chave_newsapi" | gcloud secrets create news-api-key --data-file=-
   echo -n "sua_chave_jwt" | gcloud secrets create jwt-secret --data-file=-
   ```

2. **Dar permissão ao Cloud Run:**
   ```bash
   gcloud secrets add-iam-policy-binding groq-api-key \
     --member="serviceAccount:SEU_SERVICE_ACCOUNT@SEU_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. **Deploy com secrets:**
   ```bash
   gcloud run deploy bolsinho \
     --image gcr.io/SEU_PROJECT_ID/bolsinho \
     --update-secrets=GROQ_API_KEY=groq-api-key:latest,NEWS_API_KEY=news-api-key:latest,JWT_SECRET=jwt-secret:latest
   ```

### Passo 7: Executar Migrações

1. **Conectar ao Cloud Run e executar migrações:**
   ```bash
   gcloud run jobs create migrate-bolsinho \
     --image gcr.io/SEU_PROJECT_ID/bolsinho \
     --add-cloudsql-instances=SEU_PROJECT_ID:us-central1:bolsinho-db \
     --set-env-vars="DATABASE_URL=mysql://finbot:SUA_SENHA@/finbot?unix_socket=/cloudsql/SEU_PROJECT_ID:us-central1:bolsinho-db" \
     --command="pnpm" \
     --args="db:push" \
     --region us-central1
   ```

2. **Executar o job:**
   ```bash
   gcloud run jobs execute migrate-bolsinho --region us-central1
   ```

### Passo 8: Verificar Deploy e Acessar

1. **Obter URL do serviço (fornecida automaticamente pelo Cloud Run):**
   ```bash
   gcloud run services describe bolsinho --region us-central1 --format="value(status.url)"
   ```
   
   A URL será algo como: `https://bolsinho-abc123-uc.a.run.app`

2. **Acessar a aplicação:**
   - Abra no navegador: `https://bolsinho-abc123-uc.a.run.app`
   - ✅ **Funciona de qualquer lugar!**
   - ✅ **HTTPS já configurado (gratuito)!**
   - ✅ **Não precisa comprar domínio!**

3. **Testar health check:**
   ```bash
   curl https://bolsinho-abc123-uc.a.run.app/api/trpc/system.health
   ```

### 🌐 Configurar Domínio Customizado (Opcional)

Se você **quiser** usar um domínio próprio (ex: `bolsinho.seudominio.com`):

1. **No Cloud Run, vá em "Manage Custom Domains"**
2. **Adicione seu domínio**
3. **Configure DNS conforme instruções**
4. **SSL será configurado automaticamente!**

Mas isso é **opcional** - a URL do Cloud Run já funciona perfeitamente!

---

## 🖥️ Opção 2: Google Compute Engine (VM)

### ⚠️ Importante: Domínio vs IP Externo

**Você NÃO precisa comprar um domínio!** O Google Cloud fornece:

1. **IP Externo Estático:** Uma URL do tipo `http://34.123.45.67:3000` que você pode acessar de qualquer lugar
2. **IP Externo Temporário:** Muda se a VM for reiniciada (pode tornar estático gratuitamente)
3. **Domínio Customizado (Opcional):** Apenas se quiser uma URL personalizada como `bolsinho.seudominio.com`

**Recomendação:** 
- Para testes/desenvolvimento: Use o IP externo (gratuito)
- Para produção: Use Cloud Run (fornece URL HTTPS gratuita) OU configure domínio próprio

### Passo 1: Criar VM com IP Externo Estático

1. **Crie um IP externo estático (gratuito):**
   ```bash
   gcloud compute addresses create bolsinho-ip \
     --region=us-central1
   ```

2. **Crie a VM com o IP estático:**
   ```bash
   gcloud compute instances create bolsinho-vm \
     --zone=us-central1-a \
     --machine-type=e2-medium \
     --image-family=ubuntu-2204-lts \
     --image-project=ubuntu-os-cloud \
     --boot-disk-size=20GB \
     --boot-disk-type=pd-standard \
     --address=bolsinho-ip
   ```

   **OU** sem IP estático (terá IP temporário):
   ```bash
   gcloud compute instances create bolsinho-vm \
     --zone=us-central1-a \
     --machine-type=e2-medium \
     --image-family=ubuntu-2204-lts \
     --image-project=ubuntu-os-cloud \
     --boot-disk-size=20GB \
     --boot-disk-type=pd-standard
   ```

3. **Obtenha o IP externo da VM:**
   ```bash
   gcloud compute instances describe bolsinho-vm \
     --zone=us-central1-a \
     --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
   ```
   - Anote esse IP! Você usará para acessar: `http://SEU_IP:3000`

4. **Configure firewall (permite acesso de qualquer lugar):**
   ```bash
   gcloud compute firewall-rules create allow-bolsinho \
     --allow tcp:3000 \
     --source-ranges 0.0.0.0/0 \
     --description "Allow Bolsinho on port 3000"
   ```
   
   **Importante:** Isso permite acesso de qualquer lugar na internet. Para produção, considere restringir com `--source-ranges`.

### Passo 2: Configurar VM

1. **Conecte via SSH:**
   ```bash
   gcloud compute ssh bolsinho-vm --zone=us-central1-a
   ```

2. **Instale dependências:**
   ```bash
   # Atualizar sistema
   sudo apt update && sudo apt upgrade -y

   # Instalar Node.js 22
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs

   # Instalar pnpm
   npm install -g pnpm@10.4.1

   # Instalar Python 3.11
   sudo apt install -y python3.11 python3.11-venv python3-pip

   # Instalar Tesseract
   sudo apt install -y tesseract-ocr tesseract-ocr-por

   # Instalar Poppler
   sudo apt install -y poppler-utils

   # Instalar MySQL client
   sudo apt install -y mysql-client

   # Instalar Git
   sudo apt install -y git

   # Instalar Docker (opcional, mas recomendado)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

### Passo 3: Deploy na VM

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/FilipeSCampos/Bolsinho.git
   cd Bolsinho
   ```

2. **Configure ambiente:**
   ```bash
   # Criar arquivo .env
   nano .env
   ```

   Adicione:
   ```env
   DATABASE_URL=mysql://finbot:senha@IP_DO_CLOUD_SQL:3306/finbot
   GROQ_API_KEY=sua_chave_groq
   NEWS_API_KEY=sua_chave_newsapi
   JWT_SECRET=sua_chave_secreta
   NODE_ENV=production
   PORT=3000
   ```

3. **Instalar dependências:**
   ```bash
   pnpm install
   python3.11 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Build:**
   ```bash
   pnpm build
   ```

5. **Executar migrações:**
   ```bash
   pnpm db:push
   ```

6. **Iniciar com PM2:**
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name bolsinho
   pm2 save
   pm2 startup
   ```

### Passo 4: Acessar a Aplicação

Após configurar tudo, você pode acessar a aplicação de **qualquer lugar** usando:

```
http://SEU_IP_EXTERNO:3000
```

Onde `SEU_IP_EXTERNO` é o IP que você obteve no Passo 1.

**Exemplo:**
- IP: `34.123.45.67`
- URL: `http://34.123.45.67:3000`

✅ **Funciona de qualquer lugar!** Não precisa de domínio.

### Passo 5: Configurar Nginx (Opcional - Apenas se quiser usar porta 80)

Se quiser acessar sem especificar a porta (apenas `http://SEU_IP`), configure Nginx:

1. **Atualizar firewall para porta 80:**
   ```bash
   gcloud compute firewall-rules create allow-bolsinho-http \
     --allow tcp:80 \
     --source-ranges 0.0.0.0/0 \
     --description "Allow Bolsinho HTTP on port 80"
   ```

2. **Instalar Nginx:**
   ```bash
   sudo apt install -y nginx
   ```

3. **Configurar:**
   ```bash
   sudo nano /etc/nginx/sites-available/bolsinho
   ```

   Adicione:
   ```nginx
   server {
       listen 80;
       # Use o IP externo ou '*' para aceitar qualquer domínio
       server_name _;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Ativar:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/bolsinho /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

Agora você pode acessar: `http://SEU_IP_EXTERNO` (sem porta)

### Passo 6: Configurar Domínio Customizado (Opcional - Apenas se tiver domínio)

**Só faça isso se você tem um domínio próprio!**

1. **Configure DNS do seu domínio:**
   - Adicione um registro A apontando para o IP externo da VM
   - Exemplo: `A bolsinho.seudominio.com -> 34.123.45.67`

2. **Atualize Nginx para usar o domínio:**
   ```nginx
   server {
       listen 80;
       server_name bolsinho.seudominio.com;

       location / {
           proxy_pass http://localhost:3000;
           # ... resto da configuração
       }
   }
   ```

3. **Configure SSL com Let's Encrypt (recomendado):**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d bolsinho.seudominio.com
   ```

---

## 🔐 Opção 3: Usar Cloud SQL com conexão Unix Socket (Recomendado)

Para melhor segurança e performance, use Unix Socket:

### Configurar conexão Unix Socket no código

Atualizar `server/db.ts` para suportar Unix Socket:

```typescript
// Se DATABASE_URL contém unix_socket, usar conexão Unix Socket
const databaseUrl = process.env.DATABASE_URL || '';
if (databaseUrl.includes('unix_socket')) {
  // Cloud SQL via Unix Socket
  // A conexão já está configurada na URL
}
```

### Connection String Format

```
mysql://user:password@/database?unix_socket=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

---

## 📊 Monitoramento e Logs

### Cloud Run Logs

```bash
# Ver logs em tempo real
gcloud run services logs read bolsinho --region us-central1 --follow

# Ver logs específicos
gcloud run services logs read bolsinho --region us-central1 --limit=50
```

### Compute Engine Logs

```bash
# Ver logs do PM2
pm2 logs bolsinho

# Ver logs do sistema
sudo journalctl -u bolsinho -f
```

---

## 🔄 Atualizações

### Cloud Run

1. **Fazer push do código:**
   ```bash
   git push
   ```

2. **Rebuild e redeploy:**
   ```bash
   gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/bolsinho
   gcloud run deploy bolsinho --image gcr.io/SEU_PROJECT_ID/bolsinho --region us-central1
   ```

### Compute Engine

1. **SSH na VM:**
   ```bash
   gcloud compute ssh bolsinho-vm --zone=us-central1-a
   ```

2. **Atualizar código:**
   ```bash
   cd Bolsinho
   git pull
   pnpm install
   pnpm build
   pm2 restart bolsinho
   ```

---

## 💰 Custos Estimados

### Cloud Run
- **Free Tier:** 2 milhões de requisições/mês
- **Após free tier:** ~$0.40 por 1M requisições
- **CPU/Memória:** Cobrado por uso

### Cloud SQL
- **db-f1-micro:** ~$7-10/mês
- **db-g1-small:** ~$25/mês (recomendado para produção)

### Compute Engine
- **e2-medium:** ~$25-30/mês
- **e2-standard-2:** ~$50-60/mês

---

## 🆘 Troubleshooting

### Erro: "Connection to Cloud SQL failed"
- Verifique se o Cloud SQL está na mesma região
- Verifique se a connection string está correta
- Verifique permissões do service account

### Erro: "Out of memory"
- Aumente a memória: `--memory=4Gi`
- Verifique vazamentos de memória no código

### Erro: "Timeout"
- Aumente o timeout: `--timeout=600`
- Otimize consultas ao banco de dados

### Erro: "Port already in use"
- Verifique se já há uma instância rodando
- Use `--port=8080` explicitamente

---

## 📝 Checklist de Deploy

- [ ] Google Cloud SDK instalado e configurado
- [ ] APIs habilitadas (Cloud Run, Cloud SQL, Cloud Build)
- [ ] Cloud SQL criado e configurado
- [ ] Imagem Docker buildada
- [ ] Variáveis de ambiente configuradas
- [ ] Secrets configurados (opcional, mas recomendado)
- [ ] Migrações executadas
- [ ] Serviço acessível
- [ ] Health check funcionando
- [ ] Logs configurados
- [ ] Monitoramento configurado

---

## 🚀 Próximos Passos

1. **Configurar domínio customizado:**
   ```bash
   gcloud run domain-mappings create \
     --service bolsinho \
     --domain seu-dominio.com \
     --region us-central1
   ```

2. **Configurar SSL automático:**
   - Cloud Run já fornece SSL por padrão
   - Para domínio customizado, configure DNS

3. **Configurar CI/CD:**
   - Use Cloud Build para deploy automático
   - Configure triggers no GitHub

---

**Pronto!** Seu Bolsinho está rodando na Google Cloud! ☁️🚀

