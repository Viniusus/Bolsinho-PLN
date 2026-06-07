# FinBot - Documentação da API

Esta documentação descreve os endpoints e serviços disponíveis no FinBot.

## Arquitetura

O FinBot utiliza **tRPC** para comunicação type-safe entre frontend e backend. Todos os endpoints são automaticamente tipados e validados.

## Autenticação

A autenticação é feita via OAuth2 com Manus Auth. O token de sessão é armazenado em cookie HTTP-only.

### Endpoints de Autenticação

#### `auth.me`
Retorna informações do usuário autenticado.

**Tipo:** Query  
**Autenticação:** Pública  
**Retorno:** `User | null`

```typescript
const { data: user } = trpc.auth.me.useQuery();
```

#### `auth.logout`
Faz logout do usuário atual.

**Tipo:** Mutation  
**Autenticação:** Pública  
**Retorno:** `{ success: boolean }`

```typescript
const logout = trpc.auth.logout.useMutation();
await logout.mutateAsync();
```

## Serviços Python

Os serviços Python são acessados através de um bridge Node.js → Python.

### Groq Service

#### `groq.chatCompletion`
Realiza chat completion com LLM.

**Parâmetros:**
- `messages`: Array de mensagens no formato OpenAI
- `options`: Opções adicionais (temperature, max_tokens, etc.)

**Retorno:** String com resposta do modelo

```typescript
const response = await groqService.chatCompletion([
  { role: "user", content: "Como economizar dinheiro?" }
]);
```

#### `groq.analyzeImage`
Analisa uma imagem usando visão computacional.

**Parâmetros:**
- `imageUrl`: URL da imagem
- `prompt`: Prompt descrevendo o que analisar

**Retorno:** String com análise da imagem

```typescript
const analysis = await groqService.analyzeImage(
  "https://example.com/receipt.jpg",
  "Extraia o valor total e a data deste recibo"
);
```

#### `groq.extractFinancialData`
Extrai dados estruturados de documentos financeiros.

**Parâmetros:**
- `imageUrl`: URL da imagem do documento
- `documentType`: Tipo do documento (recibo, nota_fiscal, extrato, boleto)

**Retorno:** Objeto JSON com dados extraídos

```typescript
const data = await groqService.extractFinancialData(
  "https://example.com/invoice.jpg",
  "nota_fiscal"
);
// {
//   numero_nf: "123456",
//   valor_total: 350.00,
//   data_emissao: "10/01/2025",
//   ...
// }
```

#### `groq.categorizeTransaction`
Categoriza uma transação automaticamente.

**Parâmetros:**
- `description`: Descrição da transação
- `amount`: Valor da transação
- `context`: Contexto adicional (opcional)

**Retorno:** Objeto com categoria e confiança

```typescript
const category = await groqService.categorizeTransaction(
  "Uber para o trabalho",
  25.50
);
// {
//   categoria: "transporte",
//   confianca: 0.95,
//   subcategoria: "transporte_app"
// }
```

#### `groq.analyzeSpendingPattern`
Analisa padrões de gastos e fornece insights.

**Parâmetros:**
- `transactions`: Array de transações
- `budget`: Orçamento definido (opcional)

**Retorno:** Objeto com análise e recomendações

```typescript
const analysis = await groqService.analyzeSpendingPattern(
  transactions,
  { alimentacao: 100000, transporte: 50000 }
);
// {
//   total_gasto: 180000,
//   categoria_maior_gasto: "alimentacao",
//   alertas: [...],
//   recomendacoes: [...]
// }
```

#### `groq.financialAssistant`
Assistente financeiro conversacional.

**Parâmetros:**
- `userMessage`: Mensagem do usuário
- `conversationHistory`: Histórico da conversa (opcional)

**Retorno:** String com resposta do assistente

```typescript
const response = await groqService.financialAssistant(
  "Como posso economizar R$ 1000 por mês?",
  conversationHistory
);
```

### OCR Service

#### `ocr.extractText`
Extrai texto de uma imagem.

**Parâmetros:**
- `imagePath`: Caminho ou URL da imagem
- `preprocess`: Se deve pré-processar a imagem (padrão: true)

**Retorno:** String com texto extraído

```typescript
const text = await ocrService.extractText(
  "/path/to/image.jpg",
  true
);
```

#### `ocr.extractBoletoData`
Extrai dados de um boleto.

**Parâmetros:**
- `imagePath`: Caminho ou URL da imagem do boleto

**Retorno:** Objeto com dados do boleto

```typescript
const boleto = await ocrService.extractBoletoData(
  "/path/to/boleto.jpg"
);
// {
//   linha_digitavel: "34191.79001...",
//   valor: 150.00,
//   vencimento: "15/02/2025",
//   beneficiario: "Empresa XYZ"
// }
```

#### `ocr.extractReceiptData`
Extrai dados de um recibo/cupom fiscal.

**Parâmetros:**
- `imagePath`: Caminho ou URL da imagem do recibo

**Retorno:** Objeto com dados do recibo

```typescript
const receipt = await ocrService.extractReceiptData(
  "/path/to/receipt.jpg"
);
// {
//   estabelecimento: "Supermercado ABC",
//   valor_total: 45.90,
//   data: "15/01/2025",
//   itens: [...]
// }
```

#### `ocr.extractInvoiceData`
Extrai dados de uma nota fiscal.

**Parâmetros:**
- `imagePath`: Caminho ou URL da imagem da nota fiscal

**Retorno:** Objeto com dados da nota fiscal

```typescript
const invoice = await ocrService.extractInvoiceData(
  "/path/to/invoice.jpg"
);
// {
//   numero_nf: "123456",
//   serie: "1",
//   valor_total: 350.00,
//   chave_acesso: "3525011234567800019055001..."
// }
```

### News Service

#### `news.getTopHeadlines`
Busca principais manchetes financeiras.

**Parâmetros:**
- `category`: Categoria de notícias (padrão: "business")
- `country`: Código do país (padrão: "br")
- `pageSize`: Número de resultados (padrão: 20)

**Retorno:** Array de notícias

```typescript
const headlines = await newsService.getTopHeadlines(
  "business",
  "br",
  10
);
```

#### `news.searchNews`
Busca notícias por palavra-chave.

**Parâmetros:**
- `query`: Termo de busca
- `options`: Opções de busca (from_date, to_date, language, etc.)

**Retorno:** Array de notícias

```typescript
const news = await newsService.searchNews(
  "Ibovespa",
  { language: "pt", page_size: 15 }
);
```

#### `news.getInvestmentNews`
Busca notícias sobre investimentos.

**Parâmetros:**
- `assetType`: Tipo de ativo (acoes, fundos, cripto, renda_fixa)
- `pageSize`: Número de resultados (padrão: 20)

**Retorno:** Array de notícias

```typescript
const investmentNews = await newsService.getInvestmentNews(
  "acoes",
  15
);
```

#### `news.getSectorNews`
Busca notícias por setor econômico.

**Parâmetros:**
- `sector`: Setor (tecnologia, energia, saude, financeiro, etc.)
- `pageSize`: Número de resultados (padrão: 20)

**Retorno:** Array de notícias

```typescript
const sectorNews = await newsService.getSectorNews(
  "tecnologia",
  10
);
```

#### `news.getMarketIndicatorsNews`
Busca notícias sobre indicadores de mercado.

**Parâmetros:**
- `pageSize`: Número de resultados (padrão: 15)

**Retorno:** Array de notícias

```typescript
const indicators = await newsService.getMarketIndicatorsNews(10);
```

#### `news.analyzeNewsImpact`
Analisa o impacto de notícias no portfólio.

**Parâmetros:**
- `newsList`: Array de notícias
- `portfolioSectors`: Setores do portfólio (opcional)

**Retorno:** Objeto com análise de impacto

```typescript
const impact = await newsService.analyzeNewsImpact(
  newsList,
  ["tecnologia", "energia"]
);
// {
//   total_news: 20,
//   positive_count: 12,
//   negative_count: 5,
//   sentiment_score: 0.35,
//   relevant_to_portfolio: [...]
// }
```

## Tipos de Dados

### User
```typescript
interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}
```

### Category
```typescript
interface Category {
  id: number;
  name: string;
  type: "expense" | "income";
  icon: string | null;
  color: string | null;
  userId: number | null;
  isDefault: number;
  createdAt: Date;
}
```

### Transaction
```typescript
interface Transaction {
  id: number;
  userId: number;
  categoryId: number | null;
  amount: number; // Em centavos
  description: string;
  type: "expense" | "income";
  date: Date;
  documentUrl: string | null;
  documentType: "recibo" | "nota_fiscal" | "extrato" | "boleto" | null;
  extractedData: string | null; // JSON
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Budget
```typescript
interface Budget {
  id: number;
  userId: number;
  categoryId: number | null;
  amount: number; // Em centavos
  period: "monthly" | "weekly" | "yearly";
  startDate: Date;
  endDate: Date | null;
  alertThreshold: number; // Porcentagem
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Goal
```typescript
interface Goal {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  targetAmount: number; // Em centavos
  currentAmount: number; // Em centavos
  deadline: Date | null;
  priority: "low" | "medium" | "high";
  status: "active" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}
```

### ChatMessage
```typescript
interface ChatMessage {
  id: number;
  userId: number;
  role: "user" | "assistant" | "system";
  content: string;
  imageUrl: string | null;
  metadata: string | null; // JSON
  createdAt: Date;
}
```

### Alert
```typescript
interface Alert {
  id: number;
  userId: number;
  type: "budget_exceeded" | "goal_milestone" | "unusual_spending" | "bill_reminder";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  isRead: number;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
  createdAt: Date;
}
```

### Document
```typescript
interface Document {
  id: number;
  userId: number;
  transactionId: number | null;
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: "recibo" | "nota_fiscal" | "extrato" | "boleto" | "outro";
  ocrText: string | null;
  extractedData: string | null; // JSON
  processingStatus: "pending" | "processing" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## Códigos de Erro

### HTTP Status Codes
- `200` - Sucesso
- `400` - Bad Request (parâmetros inválidos)
- `401` - Não autenticado
- `403` - Não autorizado
- `404` - Recurso não encontrado
- `500` - Erro interno do servidor

### tRPC Error Codes
- `BAD_REQUEST` - Parâmetros inválidos
- `UNAUTHORIZED` - Usuário não autenticado
- `FORBIDDEN` - Acesso negado
- `NOT_FOUND` - Recurso não encontrado
- `INTERNAL_SERVER_ERROR` - Erro interno

## Rate Limiting

Para proteger a API, implementamos rate limiting:

- **NewsAPI:** 100 requisições/dia (plano gratuito)
- **Groq API:** Conforme limites do plano contratado
- **Upload de arquivos:** Máximo 10MB por arquivo

## Exemplos de Integração

### Frontend React

```typescript
import { trpc } from '@/lib/trpc';

function MyComponent() {
  // Query
  const { data: transactions, isLoading } = trpc.transactions.list.useQuery();
  
  // Mutation
  const createTransaction = trpc.transactions.create.useMutation({
    onSuccess: () => {
      // Invalidar cache
      trpc.useUtils().transactions.list.invalidate();
    }
  });
  
  const handleCreate = async () => {
    await createTransaction.mutateAsync({
      amount: 5000, // R$ 50,00
      description: "Almoço",
      type: "expense",
      categoryId: 1,
      date: new Date()
    });
  };
  
  return (
    <div>
      {isLoading ? "Carregando..." : transactions.map(t => ...)}
    </div>
  );
}
```

### Backend Node.js

```typescript
import { groqService } from './python-bridge';

async function processReceipt(imageUrl: string) {
  // Extrair dados com IA
  const data = await groqService.extractFinancialData(
    imageUrl,
    "recibo"
  );
  
  // Salvar no banco
  await createTransaction({
    amount: Math.round(data.valor_total * 100),
    description: data.estabelecimento,
    type: "expense",
    date: new Date(data.data),
    documentUrl: imageUrl,
    extractedData: JSON.stringify(data)
  });
}
```

## Webhooks (Futuro)

Planejamos adicionar suporte a webhooks para notificar aplicações externas sobre eventos:

- `transaction.created` - Nova transação criada
- `budget.exceeded` - Orçamento excedido
- `goal.completed` - Meta atingida
- `document.processed` - Documento processado

---

**Documentação mantida por:** FinBot Contributors  
**Última atualização:** Janeiro 2025
