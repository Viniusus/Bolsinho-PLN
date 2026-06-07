# 🚀 Guia de Deploy - Bolsinho

Este guia explica como fazer deploy da aplicação Bolsinho em diferentes ambientes.

## 📋 Pré-requisitos

Antes de fazer o deploy, certifique-se de ter:

- **Node.js** 22.x ou superior
- **Python** 3.11 ou superior
- **MySQL** 8.0 ou superior (ou banco de dados compatível)
- **Docker** e **Docker Compose** (para deploy com Docker)
- **Tesseract OCR** instalado
- **Poppler** instalado (para processar PDFs escaneados)
- API Keys configuradas:
  - `GROQ_API_KEY` - Para IA (obtenha em: https://console.groq.com/keys)
  - `NEWS_API_KEY` - Para notícias (obtenha em: https://newsapi.org/register)
  - `BUILT_IN_FORGE_API_KEY` (opcional) - Para storage de arquivos

## 🐳 Opção 1: Deploy com Docker (Recomendado)

### 1.1. Preparação

1. **Clone o repositório:**
```bash
git clone <seu-repositorio>
cd finbot-source
```

2. **Crie o arquivo `.env` na raiz do projeto:**
```env
# Banco de Dados
DATABASE_URL=mysql://finbot:finbot_password@db:3306/finbot

# Groq API (obtenha em: https://console.groq.com/keys)
GROQ_API_KEY=sua_chave_groq_aqui

# NewsAPI (obtenha em: https://newsapi.org/register)
NEWS_API_KEY=sua_chave_newsapi_aqui

# JWT para autenticação
JWT_SECRET=sua_chave_secreta_aleatoria_muito_segura

# Storage (opcional - para uploads persistentes de imagens/áudio)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=sua_chave_forge_aqui

# Ambiente
NODE_ENV=production
PORT=3000
```

3. **Atualize o Dockerfile para incluir Poppler:**

O Dockerfile precisa ser atualizado para incluir o Poppler. Adicione no Dockerfile:

```dockerfile
# No Stage 1: Builder
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# No Stage 2: Production
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
```

### 1.2. Build e Execução

1. **Build e inicie os containers:**
```bash
docker-compose up -d --build
```

2. **Execute as migrações do banco de dados:**
```bash
docker-compose exec app pnpm db:push
```

3. **Verifique os logs:**
```bash
docker-compose logs -f app
```

4. **Acesse a aplicação:**
- Frontend: http://localhost:3000
- Banco de dados: localhost:3307

### 1.3. Comandos Úteis

```bash
# Parar os containers
docker-compose down

# Parar e remover volumes (CUIDADO: remove dados do banco)
docker-compose down -v

# Ver logs
docker-compose logs -f

# Reiniciar um serviço específico
docker-compose restart app

# Executar comandos dentro do container
docker-compose exec app pnpm db:push
```

## 🖥️ Opção 2: Deploy em Servidor VPS

### 2.1. Preparação do Servidor

1. **Atualize o sistema:**
```bash
sudo apt update && sudo apt upgrade -y
```

2. **Instale Node.js 22.x:**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

3. **Instale pnpm:**
```bash
npm install -g pnpm@10.4.1
```

4. **Instale Python 3.11:**
```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
```

5. **Instale MySQL 8.0:**
```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

6. **Instale Tesseract OCR:**
```bash
sudo apt install -y tesseract-ocr tesseract-ocr-por
```

7. **Instale Poppler:**
```bash
sudo apt install -y poppler-utils
```

### 2.2. Configuração da Aplicação

1. **Clone o repositório:**
```bash
git clone <seu-repositorio>
cd finbot-source
```

2. **Instale dependências Node.js:**
```bash
pnpm install
```

3. **Crie e configure o ambiente virtual Python:**
```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

4. **Configure o arquivo `.env`:**
```env
# Banco de Dados
DATABASE_URL=mysql://usuario:senha@localhost:3306/finbot

# Groq API
GROQ_API_KEY=sua_chave_groq_aqui

# NewsAPI
NEWS_API_KEY=sua_chave_newsapi_aqui

# JWT
JWT_SECRET=sua_chave_secreta_aleatoria_muito_segura

# Storage (opcional)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=sua_chave_forge_aqui

# Ambiente
NODE_ENV=production
PORT=3000
```

5. **Configure o banco de dados:**
```bash
# Acesse o MySQL
sudo mysql -u root -p

# Execute:
CREATE DATABASE finbot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'finbot'@'localhost' IDENTIFIED BY 'sua_senha_segura';
GRANT ALL PRIVILEGES ON finbot.* TO 'finbot'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

6. **Execute as migrações:**
```bash
pnpm db:push
```

### 2.3. Build e Execução

1. **Build da aplicação:**
```bash
pnpm build
```

2. **Teste localmente:**
```bash
pnpm start
```

3. **Configure PM2 para produção (opcional, mas recomendado):**
```bash
npm install -g pm2
pm2 start dist/index.js --name bolsinho
pm2 save
pm2 startup
```

4. **Configure Nginx como reverse proxy (recomendado):**
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

5. **Configure SSL com Let's Encrypt (recomendado):**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

## ☁️ Opção 3: Deploy em Plataformas Cloud

### 3.1. Railway

1. **Crie uma conta no Railway:**
   - Acesse: https://railway.app
   - Conecte seu repositório GitHub

2. **Configure as variáveis de ambiente:**
   - Adicione todas as variáveis do `.env` na seção de Environment Variables

3. **Configure o banco de dados:**
   - Adicione um serviço MySQL no Railway
   - Use a URL de conexão fornecida como `DATABASE_URL`

4. **Deploy:**
   - O Railway detecta automaticamente o Dockerfile
   - O deploy acontece automaticamente a cada push

### 3.2. Render

1. **Crie uma conta no Render:**
   - Acesse: https://render.com
   - Conecte seu repositório GitHub

2. **Crie um novo Web Service:**
   - Build Command: `pnpm install && pnpm build`
   - Start Command: `pnpm start`
   - Environment: `Node`

3. **Adicione um banco de dados PostgreSQL ou MySQL:**
   - Crie um novo banco de dados
   - Use a URL de conexão fornecida

4. **Configure as variáveis de ambiente:**
   - Adicione todas as variáveis necessárias

### 3.3. DigitalOcean App Platform

1. **Crie uma conta no DigitalOcean:**
   - Acesse: https://www.digitalocean.com

2. **Crie um novo App:**
   - Conecte seu repositório GitHub
   - Selecione o Dockerfile

3. **Configure o banco de dados:**
   - Adicione um MySQL Managed Database
   - Use a connection string fornecida

4. **Configure as variáveis de ambiente:**
   - Adicione todas as variáveis necessárias

### 3.4. Vercel (Frontend) + Railway/Render (Backend)

Para deploy separado:

1. **Deploy do Backend:**
   - Use Railway ou Render para o backend
   - Configure todas as variáveis de ambiente

2. **Deploy do Frontend:**
   - Crie um projeto no Vercel
   - Configure as variáveis de ambiente
   - Atualize a URL da API no frontend

## 🔒 Segurança em Produção

### Checklist de Segurança

- [ ] Use senhas fortes para o banco de dados
- [ ] Configure `JWT_SECRET` com uma chave aleatória forte
- [ ] Use HTTPS (SSL/TLS) em produção
- [ ] Configure CORS adequadamente
- [ ] Limite o tamanho dos uploads
- [ ] Configure rate limiting
- [ ] Mantenha as dependências atualizadas
- [ ] Use variáveis de ambiente para secrets
- [ ] Não commite o arquivo `.env`
- [ ] Configure backup automático do banco de dados

### Configurações Recomendadas

1. **Rate Limiting:**
```javascript
// Adicione no server/_core/index.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requisições por IP
});

app.use('/api/', limiter);
```

2. **CORS:**
```javascript
// Configure CORS adequadamente
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://seu-dominio.com'],
  credentials: true
}));
```

3. **Helmet (segurança HTTP):**
```bash
pnpm add helmet
```

```javascript
import helmet from 'helmet';
app.use(helmet());
```

## 📊 Monitoramento

### Logs

- Use serviços como **Logtail**, **Datadog** ou **Sentry** para monitoramento de logs
- Configure alertas para erros críticos

### Performance

- Use **PM2** para gerenciar processos Node.js
- Configure **nginx** para servir arquivos estáticos
- Use CDN para assets estáticos (opcional)

### Health Checks

A aplicação já tem um endpoint de health check:
```
GET /api/trpc/system.health
```

## 🔄 Atualizações

Para atualizar a aplicação em produção:

### Com Docker:
```bash
git pull
docker-compose down
docker-compose up -d --build
docker-compose exec app pnpm db:push
```

### Sem Docker:
```bash
git pull
pnpm install
source venv/bin/activate
pip install -r requirements.txt
pnpm build
pm2 restart bolsinho
pnpm db:push
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco de dados:**
   - Verifique se o MySQL está rodando
   - Verifique as credenciais no `.env`
   - Verifique se o banco de dados foi criado

2. **Erro ao processar PDFs:**
   - Verifique se o Poppler está instalado
   - Verifique se o Poppler está no PATH

3. **Erro ao processar imagens (OCR):**
   - Verifique se o Tesseract está instalado
   - Verifique se o Tesseract está no PATH

4. **Erro de API Keys:**
   - Verifique se todas as API keys estão configuradas
   - Verifique se as keys são válidas

5. **Problemas de permissões:**
   - Verifique permissões dos arquivos
   - Verifique permissões do diretório de uploads

## 📝 Notas Importantes

- **Backup:** Configure backup automático do banco de dados
- **SSL:** Sempre use HTTPS em produção
- **Variáveis de Ambiente:** Nunca commite o arquivo `.env`
- **Logs:** Configure rotação de logs para evitar que ocupem muito espaço
- **Monitoramento:** Configure alertas para problemas críticos

## 🆘 Suporte

Se encontrar problemas durante o deploy:
1. Verifique os logs da aplicação
2. Verifique os logs do banco de dados
3. Verifique as variáveis de ambiente
4. Consulte a documentação das ferramentas utilizadas

