# Bolsinho - Assistente Financeiro Multimodal Open-Source

**Bolsinho** é um assistente financeiro pessoal inteligente e open-source que combina processamento de linguagem natural, visão computacional e análise de dados para ajudar você a gerenciar suas finanças de forma eficiente. O sistema processa documentos financeiros através de OCR, categoriza gastos automaticamente, fornece insights personalizados e mantém você informado sobre notícias do mercado financeiro.

## 🌟 Funcionalidades Principais

### Chatbot Multimodal Inteligente

O Bolsinho utiliza modelos de IA avançados via **Groq API** para fornecer assistência financeira conversacional. O chatbot é capaz de processar tanto texto quanto imagens, permitindo que você envie fotos de recibos, notas fiscais, extratos bancários e boletos para análise automática.

**Capacidades do Chat:**
- Processamento de texto e imagens em tempo real
- Reconhecimento de documentos financeiros via OCR
- Análise de gráficos e tabelas em imagens
- Respostas contextualizadas sobre educação financeira
- Recomendações personalizadas de orçamento e investimentos

### Gestão Financeira Completa

O sistema oferece ferramentas abrangentes para controle financeiro pessoal, incluindo categorização automática de gastos, definição de orçamentos personalizados, acompanhamento de metas de investimento e alertas inteligentes sobre gastos excessivos.

**Recursos de Gestão:**
- Categorização automática de transações usando IA
- Orçamentos personalizados por categoria
- Metas financeiras com acompanhamento de progresso
- Alertas proativos sobre gastos fora do padrão
- Projeções financeiras baseadas em histórico

### Integração com Notícias Financeiras

Mantenha-se atualizado com as últimas notícias do mercado financeiro através da integração com **NewsAPI**. O sistema busca notícias relevantes sobre investimentos, analisa o impacto potencial no seu portfólio e filtra informações por setor e tipo de ativo.

**Funcionalidades de Notícias:**
- Busca em tempo real de notícias sobre investimentos
- Análise de sentimento e impacto no portfólio
- Filtros por setor econômico (tecnologia, energia, saúde, etc.)
- Notícias sobre indicadores de mercado (Ibovespa, dólar, SELIC)
- Recomendações baseadas em tendências do mercado

### Visualização de Dados Interativa

Acompanhe suas finanças através de gráficos interativos e dashboards personalizados. O sistema gera visualizações claras de gastos por categoria, tendências ao longo do tempo, comparativos com orçamento e projeções futuras.

**Visualizações Disponíveis (Nem tao disponiveis assim no momento):**
- Gráficos de gastos e receitas por categoria
- Evolução temporal de despesas e economia
- Comparativo: orçamento planejado vs. realizado
- Projeções financeiras baseadas em tendências
- Dashboard personalizado com métricas-chave

## 🏗️ Arquitetura Técnica

### Stack Tecnológico

O Bolsinho foi desenvolvido com tecnologias modernas e open-source, garantindo performance, escalabilidade e facilidade de manutenção.

#### Frontend Web
- **Framework:** React 19 com TypeScript
- **Estilização:** Tailwind CSS 4
- **Componentes:** shadcn/ui para interface consistente
- **Gráficos:** Recharts para visualizações interativas
- **Comunicação:** tRPC para type-safe API calls

#### Backend
- **Runtime:** Node.js com Express 4
- **API:** tRPC 11 para endpoints type-safe
- **Banco de Dados:** MySQL/TiDB com Drizzle ORM
- **Processamento Python:** Serviços de IA e OCR

#### Inteligência Artificial
- **LLM:** Groq API com modelos Llama 3.2 e Llama 3.3
- **Visão Computacional:** Llama 3.2 90B Vision Preview
- **OCR:** Tesseract com suporte a português e inglês
- **Processamento de Imagens:** OpenCV

#### Integrações
- **Notícias:** NewsAPI para notícias financeiras
- **Armazenamento:** S3 para documentos e imagens
- **Autenticação:** OAuth2 com Manus Auth

### Estrutura do Projeto

```
finbot/
├── client/                    # Frontend React
│   ├── src/
│   │   ├── pages/            # Páginas da aplicação
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── lib/              # Utilitários e configurações
│   │   └── App.tsx           # Rotas e layout principal
│   └── public/               # Assets estáticos
├── server/                    # Backend Node.js
│   ├── services/             # Serviços Python (IA, OCR, News)
│   │   ├── groq_service.py   # Integração com Groq API
│   │   ├── ocr_service.py    # Processamento OCR
│   │   └── news_service.py   # Busca de notícias
│   ├── routers.ts            # Endpoints tRPC
│   ├── db.ts                 # Funções de banco de dados
│   └── python-bridge.ts      # Bridge Node.js ↔ Python
├── drizzle/                   # Schemas e migrações
│   └── schema.ts             # Definição de tabelas
├── docs/                      # Documentação
└── docker/                    # Configurações Docker
```

## 🚀 Instalação e Configuração

### Pré-requisitos

Antes de iniciar, certifique-se de ter instalado:

- **Node.js** 22.x ou superior
- **Python** 3.11 ou superior
- **MySQL** 8.0 ou superior (ou TiDB Cloud)
- **Tesseract OCR** 4.x ou superior

### Instalação do Tesseract

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr tesseract-ocr-por
```

**macOS:**
```bash
brew install tesseract tesseract-lang
```

**Windows:**
Baixe o instalador em: https://github.com/UB-Mannheim/tesseract/wiki

### Instalação do Poppler (necessário para processar PDFs)

O Poppler é necessário para converter PDFs em imagens quando o PDF é escaneado.

**Ubuntu/Debian:**
```bash
sudo apt-get install poppler-utils
```

**macOS:**
```bash
brew install poppler
```

**Windows:**
1. Baixe o Poppler para Windows: https://github.com/oschwartz10612/poppler-windows/releases/
2. Extraia o arquivo ZIP
3. Adicione a pasta `bin` ao PATH do sistema:
   - Abra "Variáveis de Ambiente" no Windows
   - Edite a variável PATH
   - Adicione o caminho completo para a pasta `bin` do Poppler (ex: `C:\poppler\Library\bin`)
   - Reinicie o terminal/PowerShell

**Alternativa rápida para Windows (usando Chocolatey):**
```powershell
choco install poppler
```

### Configuração do Projeto

1. **Clone o repositório:**
```bash
git clone https://github.com/seu-usuario/bolsinho.git
cd bolsinho
```

2. **Instale as dependências Node.js:**
```bash
pnpm install
```

3. **Crie e ative o ambiente virtual Python:**
```bash
# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
venv\Scripts\activate.bat
# Linux/macOS:
source venv/bin/activate
```

4. **Instale as dependências Python:**
```bash
pip install -r requirements.txt
```

5. **Configure as variáveis de ambiente:**

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Banco de Dados
DATABASE_URL=mysql://finbot:finbot_password@localhost:3307/finbot

# Groq API (obtenha em: https://console.groq.com/keys)
GROQ_API_KEY=sua_chave_groq_aqui

# NewsAPI (obtenha em: https://newsapi.org/register)
NEWS_API_KEY=sua_chave_newsapi_aqui

# JWT para autenticação
JWT_SECRET=sua_chave_secreta_aleatoria

# Storage (opcional - para uploads persistentes de imagens/áudio)
# Se não configurado, o sistema usa data URLs (funciona para desenvolvimento)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=sua_chave_forge_aqui

# Para usar o modelo multimodal Gemini (recomendado)
# Configure estas variáveis se estiver usando o serviço Forge
# Caso contrário, o sistema tentará usar o modelo configurado
```

**Nota sobre Storage:** As variáveis `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY` são opcionais. Se não estiverem configuradas, o sistema usará data URLs base64 para imagens e áudio, que funcionam perfeitamente para desenvolvimento e testes. Para produção, recomenda-se configurar o storage para URLs persistentes.

6. **Execute as migrações do banco de dados:**
```bash
pnpm db:push
```

Se preferir usar o MySQL local via Docker, suba os serviços antes do push do schema:
```bash
docker compose up -d
```
# USE ESSE COMANDO PARA ACESSAR O BANCO DE DADOS 
--  docker exec -it bolsinho-db mysql -u root -p 

7. **Inicie o servidor de desenvolvimento:**
```bash
pnpm dev
```

**Nota:** Certifique-se de que o ambiente virtual Python está ativado antes de iniciar o servidor. O sistema tentará usar o Python do venv automaticamente se ele existir.

O aplicativo estará disponível em `http://localhost:3000`


## 🤝 Contribuindo

Contribuições são bem-vindas! O FinBot é um projeto open-source e sua ajuda é fundamental para torná-lo ainda melhor.

### Como Contribuir

1. **Fork o projeto**
2. **Crie uma branch para sua feature** (`git checkout -b feature/MinhaFeature`)
3. **Commit suas mudanças** (`git commit -m 'Adiciona MinhaFeature'`)
4. **Push para a branch** (`git push origin feature/MinhaFeature`)
5. **Abra um Pull Request**

### Diretrizes de Contribuição

- Siga os padrões de código existentes (ESLint, Prettier)
- Escreva testes para novas funcionalidades
- Atualize a documentação quando necessário
- Descreva claramente as mudanças no Pull Request
- Mantenha commits pequenos e focados

### Reportando Bugs

Encontrou um bug? Abra uma issue com:
- Descrição clara do problema
- Passos para reproduzir
- Comportamento esperado vs. atual
- Screenshots (se aplicável)
- Informações do ambiente (OS, versões)

### Sugestões de Melhorias

Tem uma ideia para melhorar o FinBot? Abra uma issue com:
- Descrição detalhada da sugestão
- Casos de uso
- Benefícios esperados
- Possíveis implementações

## 📄 Licença

Este projeto está licenciado sob a **Licença MIT** - veja o arquivo [LICENSE](LICENSE) para detalhes.

```
MIT License

Copyright (c) 2025 Bolsinho, eu e o super time do projeto integrador 3, Valeu Wesley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Agradecimentos

O Bolsinho ama o open-source:

- **Groq** - Por fornecer acesso a modelos de IA de alta performance
- **Tesseract OCR** - Por possibilitar o reconhecimento de texto em imagens
- **NewsAPI** - Por disponibilizar notícias financeiras em tempo real
- **React** e **Node.js** - Pela base sólida do framework
- **Drizzle ORM** - Pela excelente experiência com banco de dados
- **shadcn/ui** - Pelos componentes UI elegantes e acessíveis



*Bolsinho - Seu assistente financeiro inteligente e open-source*
