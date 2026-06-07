# Multi-stage build para otimizar tamanho da imagem

# Stage 1: Build
FROM node:22-slim AS builder

# Instalar Python e dependências do sistema
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos de dependências (incluindo patches)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Instalar pnpm e dependências Node.js
RUN npm install -g pnpm@10.4.1
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --prod=false

# Copiar código fonte
COPY . .

# Build do frontend
RUN pnpm build

# Stage 2: Production
FROM node:22-slim

# Instalar Python, Tesseract e dependências de runtime
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar pnpm
RUN npm install -g pnpm@10.4.1

# Copiar dependências do build stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copiar código fonte necessário
COPY package.json pnpm-lock.yaml ./
COPY server ./server
COPY drizzle ./drizzle
COPY shared ./shared

# Instalar dependências Python
COPY requirements.txt ./
# Criar ambiente virtual Python e instalar dependências
RUN python3.11 -m venv /app/venv && \
    /app/venv/bin/pip install --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Adicionar venv ao PATH
ENV PATH="/app/venv/bin:$PATH"

# Criar diretórios necessários
RUN mkdir -p /app/uploads /app/server/temp

# Configurar permissões
RUN chmod -R 755 /app/uploads /app/server/temp

# Expor porta (Cloud Run usa PORT variável, mas expomos 8080 como padrão)
EXPOSE 8080

# Variáveis de ambiente
ENV NODE_ENV=production

# Comando de inicialização
CMD ["pnpm", "start"]
