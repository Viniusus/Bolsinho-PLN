import { invokeLLM } from "../_core/llm";

export type ExtractedMemory = {
  memoryType:
    | "financial_goal"
    | "financial_preference"
    | "spending_habit"
    | "restriction"
    | "risk_profile"
    | "income_context"
    | "recurring_expense"
    | "personal_context";
  content: string;
  importance?: number;
  confidence?: number;
};

export type MemoryExtractionResult = {
  memories: ExtractedMemory[];
};

function clampScore(value: unknown, fallback: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(0, Math.min(100, numeric));
}

export function normalizeMemoryContent(content: string) {
  return content.toLowerCase().trim().replace(/\s+/g, " ");
}

export function shouldSaveMemory(memory: ExtractedMemory, existingMemories: Array<Pick<ExtractedMemory, "memoryType" | "content">>) {
  const normalizedContent = normalizeMemoryContent(memory.content);

  if (!normalizedContent) {
    return false;
  }

  return !existingMemories.some((existing) => {
    if (existing.memoryType !== memory.memoryType) {
      return false;
    }

    const existingNormalized = normalizeMemoryContent(existing.content);
    if (!existingNormalized) {
      return false;
    }

    return existingNormalized === normalizedContent
      || existingNormalized.includes(normalizedContent)
      || normalizedContent.includes(existingNormalized);
  });
}

function parseExtractionPayload(rawContent: string | Array<{ type: string; text?: string }>) {
  const text = Array.isArray(rawContent)
    ? rawContent.map((part) => (part.type === "text" ? part.text || "" : "")).join("\n")
    : rawContent;

  try {
    const parsed = JSON.parse(text) as Partial<MemoryExtractionResult>;
    const memories = Array.isArray(parsed.memories) ? parsed.memories : [];

    return {
      memories: memories
        .filter((memory): memory is ExtractedMemory => Boolean(memory?.memoryType && memory?.content))
        .map((memory) => ({
          memoryType: memory.memoryType,
          content: String(memory.content).trim(),
          importance: clampScore(memory.importance, 50),
          confidence: clampScore(memory.confidence, 80),
        })),
    } satisfies MemoryExtractionResult;
  } catch {
    return { memories: [] } satisfies MemoryExtractionResult;
  }
}

function fallbackExtractMemories(userMessage: string, assistantResponse: string): MemoryExtractionResult {
  const memories: ExtractedMemory[] = [];
  const normalizedUserMessage = normalizeMemoryContent(userMessage);
  const normalizedAssistantResponse = normalizeMemoryContent(assistantResponse);
  const combinedText = `${normalizedUserMessage} ${normalizedAssistantResponse}`;

  const goalMatch = userMessage.match(/(quero|preciso|meta|objetivo).{0,80}(juntar|economizar|guardar).{0,80}(r\$\s?[\d\.,]+)/i);
  if (goalMatch) {
    memories.push({
      memoryType: "financial_goal",
      content: `Usuário quer juntar ${goalMatch[3].trim()}.`,
      importance: 88,
      confidence: 86,
    });
  }

  if (combinedText.includes("não gosto de investimento arriscado") || combinedText.includes("nao gosto de investimento arriscado") || combinedText.includes("evitar investimentos arriscados") || combinedText.includes("não gosto de risco")) {
    memories.push({
      memoryType: "risk_profile",
      content: "Usuário prefere evitar investimentos arriscados.",
      importance: 82,
      confidence: 84,
    });
  }

  if (combinedText.includes("prefiro") || combinedText.includes("gosto de") || combinedText.includes("quero receber")) {
    memories.push({
      memoryType: "financial_preference",
      content: assistantResponse.trim().slice(0, 240),
      importance: 55,
      confidence: 50,
    });
  }

  return { memories };
}

export async function extractUsefulUserMemories(input: {
  userMessage: string;
  assistantResponse: string;
  existingMemories?: Array<Pick<ExtractedMemory, "memoryType" | "content">>;
}): Promise<MemoryExtractionResult> {
  const existingMemories = input.existingMemories || [];

  try {
    const prompt = `Analise a mensagem do usuário e a resposta do assistente.
Extraia somente informações persistentes e úteis para futuras decisões financeiras.
Não salve informação temporária.
Não salve dado sensível desnecessário.
Não salve opinião vaga.
Não salve informação incerta.
Retorne apenas JSON válido no formato:
{
  "memories": [
    {
      "memoryType": "...",
      "content": "...",
      "importance": 0-100,
      "confidence": 0-100
    }
  ]
}

Tipos válidos de memoryType:
- financial_goal
- financial_preference
- spending_habit
- restriction
- risk_profile
- income_context
- recurring_expense
- personal_context

Memórias já existentes:
${JSON.stringify(existingMemories.slice(0, 20), null, 2)}

Mensagem do usuário:
${input.userMessage}

Resposta do assistente:
${input.assistantResponse}`;

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Você é um extrator rigoroso de memórias persistentes para um assistente financeiro. Responda somente com JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 2048,
    });

    const rawContent = result.choices[0]?.message?.content;
    if (!rawContent) {
      return fallbackExtractMemories(input.userMessage, input.assistantResponse);
    }

    const parsed = parseExtractionPayload(rawContent);
    const filteredMemories = parsed.memories.filter((memory) => shouldSaveMemory(memory, existingMemories));

    if (filteredMemories.length > 0) {
      return { memories: filteredMemories };
    }

    return fallbackExtractMemories(input.userMessage, input.assistantResponse);
  } catch (error) {
    console.warn("[Memory] Failed to extract memories with model, using fallback:", error);
    return fallbackExtractMemories(input.userMessage, input.assistantResponse);
  }
}