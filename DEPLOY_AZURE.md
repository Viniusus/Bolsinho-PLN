# 🚀 Deploy do Bolsinho no Microsoft Azure

Guia completo para fazer deploy do Bolsinho usando **Azure App Service** (recomendado) ou **Azure Virtual Machines**.

## 💰 Créditos de Estudante do Azure

Com o **Azure for Students**, você recebe:
- **$100 em créditos** gratuitos
- **12 meses de serviços gratuitos** (incluindo App Service)
- **Sem cartão de crédito** necessário (para estudantes)

Acesse: https://azure.microsoft.com/free/students/

## ❓ Preciso Comprar um Domínio?

**NÃO!** Você pode acessar de qualquer lugar sem comprar domínio:

- **Azure App Service:** Fornece URL HTTPS gratuita automaticamente (ex: `https://bolsinho.azurewebsites.net`)
- **Azure VM:** Fornece IP público que você acessa diretamente (ex: `http://20.123.45.67:3000`)

**Domínio customizado é opcional** e só necessário se você quiser uma URL personalizada.

## 📋 Pré-requisitos

- Conta no [Microsoft Azure](https://portal.azure.com) (com créditos de estudante)
- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) instalado (opcional, mas recomendado)
- API Keys configuradas:
  - `GROQ_API_KEY`
  - `NEWS_API_KEY`
  - `BUILT_IN_FORGE_API_KEY` (opcional)

---

## ☁️ Opção 1: Azure App Service (Recomendado - Serverless)

### ✅ Vantagem: URL HTTPS Automática (Sem precisar de domínio!)

O Azure App Service fornece automaticamente uma URL HTTPS gratuita no formato:
```
https://bolsinho.azurewebsites.net
```

**Você pode acessar de qualquer lugar** sem precisar comprar domínio! 🎉

### Passo 1: Configurar Azure CLI (Opcional)

1. **Instale o Azure CLI:**
   - Windows: https://aka.ms/installazurecliwindows
   - Ou: `winget install -e --id Microsoft.AzureCLI`

2. **Faça login:**
   ```bash
   az login
   ```

3. **Configure a subscription (se tiver múltiplas):**
   ```bash
   az account list --output table
   az account set --subscription "SUA_SUBSCRIPTION_ID"
   ```

### Passo 2: Criar Resource Group

1. **Criar resource group:**
   ```bash
   az group create --name bolsinho-rg --location eastus
   ```

   Ou via Portal Azure:
   - Acesse https://portal.azure.com
   - Vá em "Resource groups" → "Create"
   - Nome: `bolsinho-rg`
   - Region: `East US` (ou mais próxima de você)

### Passo 3: Criar Azure Database for MySQL

1. **Criar servidor MySQL:**
   ```bash
   az mysql flexible-server create \
     --resource-group bolsinho-rg \
     --name bolsinho-mysql \
     --location eastus \
     --admin-user finbot \
     --admin-password "hermes123" \
     --sku-name Standard_B1ms \
     --tier Burstable \
     --storage-size 32 \
     --version 8.0.21
   ```

   **OU** via Portal Azure:
   - Vá em "Create a resource" → "Azure Database for MySQL"
   - Escolha "Flexible server"
   - Configure:
     - Server name: `bolsinho-mysql`
     - Admin username: `finbot`
     - Password: `hermes123`
     - Compute + storage: `Burstable B1ms` (adequado para estudantes)
     - Location: `East US`

2. **Criar banco de dados:**
   ```bash
   az mysql flexible-server db create \
     --resource-group bolsinho-rg \
     --server-name bolsinho-mysql \
     --database-name finbot
   ```

3. **Configurar firewall para permitir acesso do App Service:**
   ```bash
   # Permitir todos os IPs do Azure
   az mysql flexible-server firewall-rule create \
     --resource-group bolsinho-rg \
     --name bolsinho-mysql \
     --rule-name AllowAzureServices \
     --start-ip-address 0.0.0.0 \
     --end-ip-address 0.0.0.0
   ```

### Passo 4: Criar Azure Container Registry (ACR) - Opcional

Para build da imagem Docker:

```bash
az acr create \
  --resource-group bolsinho-rg \
  --name bolsinhoacr \
  --sku Basic \
  --admin-enabled true
```

**Nota:** O nome do ACR deve ser único globalmente e conter apenas letras minúsculas e números (ex: `bolsinhoacr12345`)

**OU** use GitHub Actions ou Azure DevOps para build automático.

**OU** use Azure App Service com build direto do GitHub (mais simples):
- No App Service, configure "Deployment Center"
- Source: GitHub
- Azure fará o build automaticamente usando o Dockerfile

### Passo 5: Build e Push da Imagem Docker

1. **Login no ACR:**
   ```bash
   az acr login --name bolsinhoacr
   ```

2. **Build e push:**
   ```bash
   az acr build --registry bolsinhoacr --image bolsinho:latest .
   ```

**OU** use Azure Container Registry Tasks para build automático no push do código.

### Passo 6: Criar App Service Plan

```bash
az appservice plan create \
  --name bolsinho-plan \
  --resource-group bolsinho-rg \
  --location eastus \
  --is-linux \
  --sku B1
```

**OU** via Portal:
- Vá em "Create a resource" → "App Service Plan"
- Configure:
  - Name: `bolsinho-plan`
  - OS: `Linux`
  - Region: `East US` (ou `Brazil South` se preferir)
  - Pricing tier: `Basic B1` (usar créditos de estudante)
  - **Nota:** Com créditos de estudante, você pode usar até 750 horas/mês no tier Basic

### Método Alternativo: Deploy Direto do GitHub (Mais Simples)

Se não quiser usar Container Registry, pode fazer deploy direto do GitHub:

1. **Criar App Service:**
   ```bash
   az webapp create \
     --resource-group bolsinho-rg \
     --plan bolsinho-plan \
     --name bolsinho-app-UNIQUE_ID \
     --runtime "NODE:22-lts"
   ```

2. **Configurar deployment do GitHub:**
   - Via Portal: App Service → "Deployment Center"
   - Source: `GitHub`
   - Autorize Azure
   - Repository: `FilipeSCampos/Bolsinho`
   - Branch: `main`
   - Build provider: `GitHub Actions` ou `App Service build service`

3. **Azure fará o build automaticamente usando o Dockerfile!**

### Passo 7: Criar Web App no App Service

**Importante:** O nome do App Service deve ser único globalmente (ex: `bolsinho-app-12345`)

1. **Via Azure CLI:**
   ```bash
   az webapp create \
     --resource-group bolsinho-rg \
     --plan bolsinho-plan \
     --name bolsinho-app-UNIQUE_ID \
     --deployment-container-image-name bolsinhoacr.azurecr.io/bolsinho:latest
   ```

   **OU** criar sem container primeiro e configurar depois:
   ```bash
   az webapp create \
     --resource-group bolsinho-rg \
     --plan bolsinho-plan \
     --name bolsinho-app-UNIQUE_ID \
     --runtime "NODE:22-lts"
   ```

2. **Configurar variáveis de ambiente:**
   ```bash
   az webapp config appsettings set \
     --resource-group bolsinho-rg \
     --name bolsinho-app-UNIQUE_ID \
     --settings \
       DATABASE_URL="mysql://finbot:SUA_SENHA@bolsinho-mysql.mysql.database.azure.com:3306/finbot" \
       GROQ_API_KEY="sua_chave_groq" \
       NEWS_API_KEY="sua_chave_newsapi" \
       JWT_SECRET="sua_chave_secreta_aleatoria" \
       NODE_ENV="production" \
       PORT="8080" \
       WEBSITES_PORT="8080" \
       SCM_DO_BUILD_DURING_DEPLOYMENT="true"
   ```

   **Importante:** 
   - `WEBSITES_PORT="8080"` - Azure precisa saber em qual porta sua app escuta
   - `SCM_DO_BUILD_DURING_DEPLOYMENT="true"` - Faz build automático durante deploy

3. **Configurar conexão com MySQL:**
   ```bash
   az webapp config connection-string set \
     --resource-group bolsinho-rg \
     --name bolsinho-app \
     --connection-string-type MySQL \
     --settings DefaultConnection="mysql://finbot:SUA_SENHA@bolsinho-mysql.mysql.database.azure.com:3306/finbot"
   ```

**OU** via Portal Azure:

1. **Criar Web App:**
   - Vá em "Create a resource" → "Web App"
   - Configure:
     - Name: `bolsinho-app` (deve ser único globalmente)
     - Publish: `Docker Container`
     - OS: `Linux`
     - Region: `East US`
     - App Service Plan: `bolsinho-plan`

2. **Configurar Container:**
   - Vá em "Deployment Center"
   - Source: `Azure Container Registry`
   - Registry: `bolsinhoacr`
   - Image: `bolsinho:latest`

3. **Configurar variáveis de ambiente:**
   - Vá em "Configuration" → "Application settings"
   - Adicione:
     - `DATABASE_URL`: `mysql://finbot:SUA_SENHA@bolsinho-mysql.mysql.database.azure.com:3306/finbot`
     - `GROQ_API_KEY`: `sua_chave_groq`
     - `NEWS_API_KEY`: `sua_chave_newsapi`
     - `JWT_SECRET`: `sua_chave_secreta`
     - `NODE_ENV`: `production`
     - `PORT`: `8080`
     - `WEBSITES_PORT`: `8080`

### Passo 8: Habilitar Continuous Deployment (Opcional)

Para deploy automático quando você fizer push no GitHub:

1. **Via Portal:**
   - Vá em "Deployment Center"
   - Source: `GitHub`
   - Autorize o Azure a acessar seu GitHub
   - Selecione o repositório: `FilipeSCampos/Bolsinho`
   - Branch: `main`
   - Configure o Dockerfile

### Passo 9: Executar Migrações

1. **Via Azure CLI (SSH no container):**
   ```bash
   az webapp ssh --resource-group bolsinho-rg --name bolsinho-app
   ```

2. **Dentro do container, execute:**
   ```bash
   pnpm db:push
   ```

**OU** crie um script de inicialização que executa as migrações automaticamente.

### Passo 10: Acessar a Aplicação

1. **Obter URL:**
   ```bash
   az webapp show --resource-group bolsinho-rg --name bolsinho-app --query defaultHostName --output tsv
   ```

   A URL será: `https://bolsinho-app.azurewebsites.net`

2. **Acessar:**
   - Abra no navegador: `https://bolsinho-app.azurewebsites.net`
   - ✅ **Funciona de qualquer lugar!**
   - ✅ **HTTPS já configurado (gratuito)!**
   - ✅ **Não precisa comprar domínio!**

---

## 🖥️ Opção 2: Azure Virtual Machine (VM)

### ⚠️ Importante: Domínio vs IP Público

**Você NÃO precisa comprar um domínio!** O Azure fornece:

1. **IP Público:** Uma URL do tipo `http://20.123.45.67:3000` que você pode acessar de qualquer lugar
2. **IP Público Estático:** Pode tornar estático para não mudar
3. **Domínio Customizado (Opcional):** Apenas se quiser uma URL personalizada

### Passo 1: Criar Virtual Machine

1. **Via Azure CLI:**
   ```bash
   az vm create \
     --resource-group bolsinho-rg \
     --name bolsinho-vm \
     --image Ubuntu2204 \
     --size Standard_B2s \
     --admin-username azureuser \
     --generate-ssh-keys \
     --public-ip-sku Standard
   ```

2. **Obter IP público:**
   ```bash
   az vm show -d -g bolsinho-rg -n bolsinho-vm --query publicIps -o tsv
   ```
   - Anote esse IP! Você usará: `http://SEU_IP:3000`

3. **Abrir porta 3000 no firewall:**
   ```bash
   az vm open-port --port 3000 --resource-group bolsinho-rg --name bolsinho-vm
   ```

**OU** via Portal Azure:

1. **Criar VM:**
   - Vá em "Create a resource" → "Virtual machine"
   - Configure:
     - Name: `bolsinho-vm`
     - Image: `Ubuntu Server 22.04 LTS`
     - Size: `Standard_B2s` (adequado para estudantes)
     - Authentication type: `SSH public key` ou `Password`
     - Public inbound ports: `Allow selected ports` → `SSH (22)`

2. **Configurar Network Security Group (NSG):**
   - Após criar a VM, vá em "Networking"
   - Adicione uma regra de entrada:
     - Port: `3000`
     - Protocol: `TCP`
     - Source: `Any`
     - Action: `Allow`

### Passo 2: Conectar e Configurar VM

1. **Conectar via SSH:**
   ```bash
   ssh azureuser@SEU_IP_PUBLICO
   ```

   **OU** via Azure Portal:
   - Vá na VM → "Connect" → "SSH"
   - Copie o comando e execute no terminal

2. **Instalar dependências:**
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

   # Instalar Git
   sudo apt install -y git

   # Instalar Docker (opcional)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

### Passo 3: Deploy na VM

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/FilipeSCampos/Bolsinho.git
   cd Bolsinho
   ```

2. **Configure ambiente:**
   ```bash
   nano .env
   ```

   Adicione:
   ```env
   DATABASE_URL=mysql://finbot:senha@bolsinho-mysql.mysql.database.azure.com:3306/finbot
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

Após configurar tudo, você pode acessar de **qualquer lugar**:

```
http://SEU_IP_PUBLICO:3000
```

**Exemplo:**
- IP: `20.123.45.67`
- URL: `http://20.123.45.67:3000`

✅ **Funciona de qualquer lugar!** Não precisa de domínio.

---

## 🔐 Opção 3: Usar Azure Key Vault (Recomendado para Produção)

Para maior segurança, armazene secrets no Key Vault:

1. **Criar Key Vault:**
   ```bash
   az keyvault create \
     --name bolsinho-kv \
     --resource-group bolsinho-rg \
     --location eastus
   ```

2. **Adicionar secrets:**
   ```bash
   az keyvault secret set --vault-name bolsinho-kv --name "groq-api-key" --value "sua_chave"
   az keyvault secret set --vault-name bolsinho-kv --name "news-api-key" --value "sua_chave"
   az keyvault secret set --vault-name bolsinho-kv --name "jwt-secret" --value "sua_chave"
   ```

3. **Configurar acesso no App Service:**
   ```bash
   az webapp config appsettings set \
     --resource-group bolsinho-rg \
     --name bolsinho-app \
     --settings \
       @Microsoft.KeyVault(SecretUri=https://bolsinho-kv.vault.azure.net/secrets/groq-api-key/) \
       @Microsoft.KeyVault(SecretUri=https://bolsinho-kv.vault.azure.net/secrets/news-api-key/)
   ```

---

## 📊 Monitoramento e Logs

### App Service Logs

```bash
# Ver logs em tempo real
az webapp log tail --resource-group bolsinho-rg --name bolsinho-app

# Baixar logs
az webapp log download --resource-group bolsinho-rg --name bolsinho-app --log-file app-logs.zip
```

### Application Insights (Opcional)

1. **Criar Application Insights:**
   ```bash
   az monitor app-insights component create \
     --app bolsinho-insights \
     --location eastus \
     --resource-group bolsinho-rg
   ```

2. **Conectar ao App Service:**
   - Via Portal: App Service → Application Insights → Enable

---

## 🔄 Atualizações

### App Service

1. **Rebuild e redeploy:**
   ```bash
   az acr build --registry bolsinhoacr --image bolsinho:latest .
   az webapp restart --resource-group bolsinho-rg --name bolsinho-app
   ```

2. **OU** se estiver usando GitHub Actions, apenas faça push:
   ```bash
   git push
   ```

### Virtual Machine

1. **SSH na VM:**
   ```bash
   ssh azureuser@SEU_IP
   ```

2. **Atualizar:**
   ```bash
   cd Bolsinho
   git pull
   pnpm install
   pnpm build
   pm2 restart bolsinho
   ```

---

## 💰 Custos com Créditos de Estudante

### App Service
- **Free Tier:** Não disponível, mas Basic B1 está nos créditos
- **Basic B1:** ~$13/mês (usando créditos de estudante)

### Azure Database for MySQL
- **Burstable B1ms:** ~$12/mês (usando créditos de estudante)
- **32 GB storage:** Incluído

### Virtual Machine
- **Standard_B2s:** ~$30/mês (usando créditos de estudante)

**Com $100 de créditos, você tem aproximadamente 3-4 meses de uso!**

---

## 🆘 Troubleshooting

### Erro: "Container failed to start"
- Verifique os logs: `az webapp log tail`
- Verifique se a porta está configurada corretamente (`WEBSITES_PORT=8080`)
- Verifique se as variáveis de ambiente estão configuradas

### Erro: "Database connection failed"
- Verifique o firewall do MySQL (deve permitir serviços do Azure)
- Verifique a connection string
- Verifique se o usuário tem permissões

### Erro: "Out of memory"
- Aumente o plano do App Service (Basic B2 ou Standard)
- Ou aumente o tamanho da VM

### Erro: "Port not accessible"
- Verifique o NSG (Network Security Group)
- Verifique se a porta está aberta no firewall da VM

---

## 📝 Checklist de Deploy

- [ ] Azure CLI instalado e configurado
- [ ] Resource Group criado
- [ ] Azure Database for MySQL criado e configurado
- [ ] App Service Plan criado
- [ ] Web App criado
- [ ] Container Registry configurado (ou GitHub Actions)
- [ ] Imagem Docker buildada e pushada
- [ ] Variáveis de ambiente configuradas
- [ ] Firewall do MySQL configurado
- [ ] Migrações executadas
- [ ] Aplicação acessível
- [ ] Logs configurados

---

## 🚀 Próximos Passos

1. **Configurar domínio customizado (opcional):**
   - No App Service, vá em "Custom domains"
   - Adicione seu domínio
   - Configure DNS
   - SSL será configurado automaticamente!

2. **Configurar CI/CD:**
   - Use GitHub Actions
   - Configure Azure DevOps
   - Ou use Azure Container Registry Tasks

3. **Monitoramento:**
   - Configure Application Insights
   - Configure alertas
   - Configure logs

---

## 🎓 Aproveitando Créditos de Estudante

- **Use App Service Basic B1** (suficiente para desenvolvimento)
- **Use MySQL Burstable B1ms** (adequado para pequenas aplicações)
- **Desligue recursos quando não estiver usando** para economizar créditos
- **Configure alertas de custo** para não exceder os créditos

---

**Pronto!** Seu Bolsinho está rodando no Azure! ☁️🚀

