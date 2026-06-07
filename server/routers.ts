import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { groqService, ocrService, newsService } from "./python-bridge";
import { storagePut } from "./storage";
import { invokeLLM, type Message } from "./_core/llm";
import { ENV } from "./_core/env";
import { processFileForPython } from "./_core/tempFiles";
import {
  createChatMessage,
  disableUserMemory,
  getUserMemories,
  getUserProfile,
  getUserRagContext,
  saveUserMemory,
  upsertUserProfile,
} from "./db";
import { extractUsefulUserMemories, shouldSaveMemory } from "./services/memory_service";

/**
 * Detecta se a mensagem do usuário está pedindo notícias financeiras
 */
function detectNewsRequest(message: string): { isNewsRequest: boolean; queryType?: 'headlines' | 'search' | 'investment' | 'sector' | 'indicators'; query?: string; category?: string; sector?: string } {
  const lowerMessage = message.toLowerCase();
  
  // Palavras-chave para detectar solicitações de notícias
  const newsKeywords = [
    'notícias', 'noticia', 'noticias', 'news',
    'manchetes', 'manchete',
    'últimas notícias', 'ultimas noticias',
    'o que está acontecendo', 'o que esta acontecendo',
    'o que aconteceu', 'o que aconteceu hoje',
    'notícias de hoje', 'noticias de hoje',
    'atualidades', 'atualidade'
  ];
  
  // Verifica se é uma solicitação de notícias
  const isNewsRequest = newsKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (!isNewsRequest) {
    return { isNewsRequest: false };
  }
  
  // Detecta tipo específico de notícia
  if (lowerMessage.includes('manchetes') || lowerMessage.includes('principais') || lowerMessage.includes('top')) {
    return { isNewsRequest: true, queryType: 'headlines' };
  }
  
  if (lowerMessage.includes('investimento') || lowerMessage.includes('ações') || lowerMessage.includes('bolsa') || 
      lowerMessage.includes('cripto') || lowerMessage.includes('bitcoin') || lowerMessage.includes('fundo')) {
    return { isNewsRequest: true, queryType: 'investment' };
  }
  
  if (lowerMessage.includes('ibovespa') || lowerMessage.includes('dólar') || lowerMessage.includes('dolar') || 
      lowerMessage.includes('selic') || lowerMessage.includes('inflação') || lowerMessage.includes('inflacao') || 
      lowerMessage.includes('ipca') || lowerMessage.includes('pib')) {
    return { isNewsRequest: true, queryType: 'indicators' };
  }
  
  if (lowerMessage.includes('setor') || lowerMessage.includes('tecnologia') || lowerMessage.includes('energia') || 
      lowerMessage.includes('saúde') || lowerMessage.includes('saude') || lowerMessage.includes('financeiro') || 
      lowerMessage.includes('varejo') || lowerMessage.includes('agronegócio') || lowerMessage.includes('agronegocio')) {
    // Tenta extrair o setor específico
    const sectors: Record<string, string> = {
      'tecnologia': 'tecnologia',
      'tech': 'tecnologia',
      'energia': 'energia',
      'petróleo': 'energia',
      'petroleo': 'energia',
      'saúde': 'saude',
      'saude': 'saude',
      'farmacêutica': 'saude',
      'farmaceutica': 'saude',
      'financeiro': 'financeiro',
      'banco': 'financeiro',
      'fintech': 'financeiro',
      'varejo': 'varejo',
      'e-commerce': 'varejo',
      'agronegócio': 'agronegocio',
      'agronegocio': 'agronegocio',
      'agricultura': 'agronegocio'
    };
    
    for (const [keyword, sector] of Object.entries(sectors)) {
      if (lowerMessage.includes(keyword)) {
        return { isNewsRequest: true, queryType: 'sector', sector };
      }
    }
    
    return { isNewsRequest: true, queryType: 'sector' };
  }
  
  // Se não for um tipo específico, usa busca geral
  // Tenta extrair termos de busca da mensagem
  const searchTerms = message.match(/(?:sobre|sobre o|sobre a|de|do|da)\s+([a-záêçõúã]+(?:\s+[a-záêçõúã]+)*)/gi);
  if (searchTerms && searchTerms.length > 0) {
    const query = searchTerms[0].replace(/(?:sobre|sobre o|sobre a|de|do|da)\s+/i, '').trim();
    return { isNewsRequest: true, queryType: 'search', query };
  }
  
  return { isNewsRequest: true, queryType: 'headlines' };
}

/**
 * Busca notícias baseado no tipo de solicitação detectado
 */
async function fetchRelevantNews(detection: { queryType: string; query?: string; category?: string; sector?: string }): Promise<string | null> {
  try {
    let newsResult;
    
    switch (detection.queryType) {
      case 'headlines':
        newsResult = await newsService.getTopHeadlines('business', 'br', 10);
        break;
      
      case 'investment':
        newsResult = await newsService.getInvestmentNews(undefined, 10);
        break;
      
      case 'indicators':
        newsResult = await newsService.getMarketIndicatorsNews(10);
        break;
      
      case 'sector':
        const sector = detection.sector || 'tecnologia';
        newsResult = await newsService.getSectorNews(sector, 10);
        break;
      
      case 'search':
        const query = detection.query || 'economia financeiro';
        newsResult = await newsService.searchNews(query, { language: 'pt', page_size: 10 });
        break;
      
      default:
        newsResult = await newsService.getTopHeadlines('business', 'br', 10);
    }
    
    if (!newsResult.success || !newsResult.data) {
      console.warn('[Chat] Erro ao buscar notícias:', newsResult.error);
      return null;
    }
    
    const news = Array.isArray(newsResult.data) ? newsResult.data : [];
    
    // Verifica se há erro na resposta
    if (news.length > 0 && news[0].error) {
      console.warn('[Chat] Erro nas notícias:', news[0].error);
      return null;
    }
    
    if (news.length === 0) {
      console.warn('[Chat] Nenhuma notícia encontrada');
      return null;
    }
    
    // Formata as notícias para incluir no contexto
    const newsText = news.slice(0, 5).map((article: any, index: number) => {
      return `${index + 1}. ${article.title || 'Sem título'}
${article.description ? `   ${article.description.substring(0, 200)}...` : ''}
   Fonte: ${article.source || 'Desconhecida'} | Publicado: ${article.published_at || 'Data desconhecida'}
   URL: ${article.url || 'N/A'}`;
    }).join('\n\n');
    
    return `\n\n--- NOTÍCIAS FINANCEIRAS ATUAIS ---\n${newsText}\n--- FIM DAS NOTÍCIAS ---\n`;
  } catch (error) {
    console.error('[Chat] Erro ao buscar notícias:', error);
    return null;
  }
}

function normalizeAssistantContent(content: unknown): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part && part.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim();
  }

  return String(content);
}

function serializeMetadata(data: Record<string, unknown>) {
  return JSON.stringify(data);
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  userMemory: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(100).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        return getUserMemories(userId, input?.limit ?? 20);
      }),

    create: protectedProcedure
      .input(z.object({
        memoryType: z.enum([
          "financial_goal",
          "financial_preference",
          "spending_habit",
          "restriction",
          "risk_profile",
          "income_context",
          "recurring_expense",
          "personal_context",
        ]),
        content: z.string().min(1),
        importance: z.number().int().min(0).max(100).optional(),
        confidence: z.number().int().min(0).max(100).optional(),
        source: z.string().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await saveUserMemory({
          userId: ctx.user.id,
          memoryType: input.memoryType,
          content: input.content,
          importance: input.importance,
          confidence: input.confidence,
          source: input.source,
          isActive: 1,
        });

        return { success: true as const };
      }),

    disable: protectedProcedure
      .input(z.object({
        memoryId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        await disableUserMemory(ctx.user.id, input.memoryId);
        return { success: true as const };
      }),

    context: protectedProcedure.query(async ({ ctx }) => {
      return getUserRagContext(ctx.user.id);
    }),

    profile: router({
      get: protectedProcedure.query(async ({ ctx }) => {
        return getUserProfile(ctx.user.id);
      }),

      upsert: protectedProcedure
        .input(z.object({
          monthlyIncome: z.number().int().nonnegative().optional(),
          monthlyExpenseLimit: z.number().int().nonnegative().optional(),
          riskProfile: z.enum(["conservative", "moderate", "aggressive", "unknown"]).optional(),
          financialMoment: z.enum(["debt_control", "emergency_reserve", "investing_beginner", "investing_advanced", "unknown"]).optional(),
          preferredCurrency: z.string().max(12).optional(),
          preferredLanguage: z.string().max(12).optional(),
          notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          await upsertUserProfile({
            userId: ctx.user.id,
            ...input,
          });
          return { success: true as const };
        }),
    }),
  }),

  // Upload de arquivos (imagens e áudio)
  upload: router({
    file: publicProcedure
      .input(z.object({
        file: z.string(), // base64 encoded file
        filename: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Validate file type
          const isImage = input.mimeType.startsWith('image/');
          const isAudio = input.mimeType.startsWith('audio/');
          const isPdf = input.mimeType === 'application/pdf';
          
          if (!isImage && !isAudio && !isPdf) {
            throw new Error('Tipo de arquivo não suportado. Apenas imagens, áudio e PDFs são permitidos.');
          }
          
          // Try to use storage if configured, otherwise use data URL
          try {
            // Decode base64 to buffer
            const buffer = Buffer.from(input.file, 'base64');
            
            // Determine file type and path
            let filePath: string;
            if (isImage) {
              const ext = input.mimeType.split('/')[1] || 'png';
              filePath = `chat/images/${Date.now()}-${input.filename || `image.${ext}`}`;
            } else if (isAudio) {
              const ext = input.mimeType.split('/')[1] || 'mp3';
              filePath = `chat/audio/${Date.now()}-${input.filename || `audio.${ext}`}`;
            } else if (isPdf) {
              filePath = `chat/pdfs/${Date.now()}-${input.filename || 'document.pdf'}`;
            } else {
              throw new Error('Tipo de arquivo não reconhecido.');
            }
            
            // Try to upload to storage
            const { url } = await storagePut(filePath, buffer, input.mimeType);
            
            return {
              success: true,
              url,
            };
          } catch (storageError) {
            // If storage is not configured, use data URL as fallback
            // This works for multimodal models that accept data URLs
            console.warn("[Upload] Storage não configurado, usando data URL:", storageError instanceof Error ? storageError.message : String(storageError));
            
            // Create data URL from base64
            const dataUrl = `data:${input.mimeType};base64,${input.file}`;
            
            return {
              success: true,
              url: dataUrl,
              isDataUrl: true, // Flag to indicate this is a data URL
            };
          }
        } catch (error) {
          console.error("[Upload] Erro ao processar arquivo:", error);
          throw new Error(error instanceof Error ? error.message : "Erro desconhecido ao processar arquivo");
        }
      }),
  }),

  // Chatbot financeiro com suporte multimodal
  chat: router({
    send: publicProcedure
      .input(z.object({
        message: z.string().optional(),
        images: z.array(z.string()).optional(), // URLs das imagens
        audio: z.string().optional(), // URL do áudio
        pdfs: z.array(z.string()).optional(), // URLs dos PDFs
        conversationHistory: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.union([
            z.string(),
            z.object({
              type: z.literal("text"),
              text: z.string(),
            }),
            z.object({
              type: z.literal("image_url"),
              image_url: z.object({
                url: z.string(),
              }),
            }),
            z.object({
              type: z.literal("file_url"),
              file_url: z.object({
                url: z.string(),
                mime_type: z.string().optional(),
              }),
            }),
            z.array(z.union([
              z.object({
                type: z.literal("text"),
                text: z.string(),
              }),
              z.object({
                type: z.literal("image_url"),
                image_url: z.object({
                  url: z.string(),
                }),
              }),
              z.object({
                type: z.literal("file_url"),
                file_url: z.object({
                  url: z.string(),
                  mime_type: z.string().optional(),
                }),
              }),
            ])),
          ]),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Process PDFs first - extract text from PDFs and add to message
          let pdfTexts: string[] = [];
          const tempFileCleanups: Array<() => Promise<void>> = [];
          
          if (input.pdfs && input.pdfs.length > 0) {
            for (const pdfUrl of input.pdfs) {
              let tempFilePath: string | null = null;
              let cleanup: (() => Promise<void>) | null = null;
              try {
                // Save to temp file if needed (data URL or very long URL)
                const fileInfo = await processFileForPython(pdfUrl, 'pdf');
                tempFilePath = fileInfo.path;
                cleanup = fileInfo.cleanup;
                tempFileCleanups.push(cleanup);
                
                console.log(`[Chat] Processando PDF: ${tempFilePath.length > 50 ? tempFilePath.substring(0, 50) + '...' : tempFilePath}`);
                
                // Extract text from PDF
                const result = await ocrService.extractTextFromPdf(tempFilePath);
                
                console.log(`[Chat] Resultado do OCR:`, result.success ? 'Sucesso' : `Erro: ${result.error}`);
                
                if (result.success && result.data) {
                  // OCR service returns string directly, check if it's an error message
                  const extractedText = typeof result.data === 'string' ? result.data : String(result.data);
                  
                  // Check if the returned string is actually an error message
                  const isError = extractedText.toLowerCase().startsWith('erro') || 
                                 extractedText.toLowerCase().startsWith('error') ||
                                 extractedText.toLowerCase().includes('erro ao extrair') ||
                                 extractedText.toLowerCase().includes('não foi possível extrair') ||
                                 extractedText.toLowerCase().includes('bibliotecas de pdf não disponíveis') ||
                                 (extractedText.length < 50 && extractedText.toLowerCase().includes('não foi possível'));
                  
                  if (!isError && extractedText.trim().length > 50) {
                    // Success - we got actual text content
                    pdfTexts.push(`\n\n--- Conteúdo extraído do PDF ---\n${extractedText}`);
                    console.log(`[Chat] Texto extraído do PDF com sucesso (${extractedText.length} caracteres)`);
                  } else {
                    // Error or empty result
                    console.warn(`[Chat] PDF processado mas resultado indica erro ou vazio. Resultado: ${extractedText.substring(0, 300)}`);
                    
                    // Provide helpful error message based on the error type
                    if (extractedText.toLowerCase().includes('poppler') || 
                        extractedText.toLowerCase().includes('is poppler installed')) {
                      pdfTexts.push(`\n\n--- ⚠️ Poppler não está instalado. Para processar PDFs escaneados, é necessário instalar o Poppler:\n\nWindows: Baixe em https://github.com/oschwartz10612/poppler-windows/releases/ e adicione a pasta 'bin' ao PATH do sistema.\n\nLinux: sudo apt-get install poppler-utils\n\nmacOS: brew install poppler\n\nAlternativamente, tente usar um PDF com texto selecionável (não escaneado). ---`);
                    } else if (extractedText.toLowerCase().includes('bibliotecas de pdf não disponíveis') || 
                        extractedText.toLowerCase().includes('instale pypdf2')) {
                      pdfTexts.push(`\n\n--- Erro: Bibliotecas Python necessárias não estão instaladas. Execute: pip install PyPDF2 pdf2image ---`);
                    } else if (extractedText.toLowerCase().includes('imagem escaneada') || 
                              extractedText.toLowerCase().includes('baixa qualidade')) {
                      pdfTexts.push(`\n\n--- Aviso: O PDF parece ser uma imagem escaneada de baixa qualidade. Não foi possível extrair texto. Tente usar um PDF com texto selecionável ou descreva o conteúdo em texto. ---`);
                    } else if (extractedText.toLowerCase().includes('vazio') || 
                              extractedText.toLowerCase().includes('empty')) {
                      pdfTexts.push(`\n\n--- Aviso: O PDF parece estar vazio ou não contém texto extraível. ---`);
                    } else {
                      // Generic error - extract the error message if available
                      const errorMatch = extractedText.match(/erro[:\s]+(.+)/i);
                      const errorDetail = errorMatch ? errorMatch[1].substring(0, 200) : 'Erro desconhecido';
                      pdfTexts.push(`\n\n--- Não foi possível extrair texto do PDF: ${errorDetail}. Tente usar um PDF com texto selecionável ou descreva o conteúdo do PDF em texto. ---`);
                    }
                  }
                } else {
                  // Python process failed
                  console.error(`[Chat] Erro ao processar PDF:`, result.error || 'Erro desconhecido');
                  const errorMsg = result.error || 'Erro desconhecido ao processar PDF';
                  pdfTexts.push(`\n\n--- Erro ao processar PDF: ${errorMsg}. Verifique se o arquivo está íntegro e se as bibliotecas Python estão instaladas (pip install PyPDF2 pdf2image). ---`);
                }
              } catch (error) {
                console.error(`[Chat] Exceção ao extrair texto do PDF:`, error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                pdfTexts.push(`\n\n--- Erro ao processar PDF: ${errorMessage} ---`);
              } finally {
                // Don't cleanup immediately - Python might still be using the file
                // The cleanup will happen later or on next server restart
                // This prevents ENOENT errors when Python is still reading the file
              }
            }
          }
          
          // Build multimodal message content
          const contentParts: Array<
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string } }
            | { type: "file_url"; file_url: { url: string; mime_type?: string } }
          > = [];
          const userId = ctx.user?.id ?? null;
          
          // Detect if user is asking for news
          const userMessage = input.message || "";
          const newsDetection = detectNewsRequest(userMessage);
          let newsContext = "";
          
          if (newsDetection.isNewsRequest) {
            console.log(`[Chat] Solicitação de notícias detectada: tipo=${newsDetection.queryType}, query=${newsDetection.query || 'N/A'}`);
            const fetchedNews = await fetchRelevantNews(newsDetection);
            if (fetchedNews) {
              newsContext = fetchedNews;
              console.log(`[Chat] Notícias encontradas e adicionadas ao contexto`);
            } else {
              console.log(`[Chat] Nenhuma notícia disponível ou erro ao buscar`);
            }
          }
          
          // Combine original message with extracted PDF texts and news context
          let combinedText = userMessage;
          if (pdfTexts.length > 0) {
            combinedText += pdfTexts.join("\n");
          }
          if (newsContext) {
            combinedText = newsContext + "\n\n" + combinedText;
          }
          
          // Add text if provided (now including PDF content)
          if (combinedText.trim()) {
            contentParts.push({
              type: "text",
              text: combinedText.trim(),
            });
          }
          
          // Add images if provided
          if (input.images && input.images.length > 0) {
            input.images.forEach((imageUrl) => {
              contentParts.push({
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              });
            });
          }
          
          // Add audio if provided
          if (input.audio) {
            // Determine mime type from URL or data URL
            let audioMimeType = 'audio/mpeg'; // default
            if (input.audio.startsWith('data:')) {
              // Extract mime type from data URL: data:audio/mpeg;base64,...
              const match = input.audio.match(/^data:([^;]+)/);
              if (match && match[1]) {
                audioMimeType = match[1];
              }
            } else {
              // Determine from file extension
              audioMimeType = input.audio.includes('.mp3') ? 'audio/mpeg' :
                             input.audio.includes('.wav') ? 'audio/wav' :
                             input.audio.includes('.m4a') ? 'audio/mp4' :
                             input.audio.includes('.webm') ? 'audio/webm' :
                             input.audio.includes('.ogg') ? 'audio/ogg' :
                             'audio/mpeg';
            }
            
            contentParts.push({
              type: "file_url",
              file_url: {
                url: input.audio,
                mime_type: audioMimeType as "audio/mpeg" | "audio/wav" | "audio/mp4" | "audio/webm" | "audio/ogg",
              },
            });
          }

          const usedPersistentContext = false;

          const persistConversation = async (assistantResponse: string) => {
            if (!userId) {
              return;
            }

            try {
              const userContentForStorage = userMessage.trim() || (contentParts.length > 0 ? "Mensagem multimodal sem texto" : "Mensagem vazia");
              const userMetadata = serializeMetadata({
                hasImages: Boolean(input.images?.length),
                hasAudio: Boolean(input.audio),
                hasPdfs: Boolean(input.pdfs?.length),
                newsRequest: newsDetection.isNewsRequest,
                usedPersistentContext,
              });
              const assistantMetadata = serializeMetadata({
                usedPersistentContext,
              });

              await createChatMessage({
                userId,
                role: "user",
                content: userContentForStorage,
                metadata: userMetadata,
              });

              await createChatMessage({
                userId,
                role: "assistant",
                content: assistantResponse,
                metadata: assistantMetadata,
              });

              void (async () => {
                try {
                  const existingMemories = (await getUserMemories(userId, 20)).map((memory) => ({
                    memoryType: memory.memoryType,
                    content: memory.content,
                  }));

                  const extractedMemories = await extractUsefulUserMemories({
                    userMessage: userContentForStorage,
                    assistantResponse,
                    existingMemories,
                  });

                  for (const memory of extractedMemories.memories) {
                    if (!shouldSaveMemory(memory, existingMemories)) {
                      continue;
                    }

                    await saveUserMemory({
                      userId,
                      memoryType: memory.memoryType,
                      content: memory.content,
                      importance: memory.importance,
                      confidence: memory.confidence,
                      source: "chat",
                      isActive: 1,
                    });

                    existingMemories.push({
                      memoryType: memory.memoryType,
                      content: memory.content,
                    });
                  }
                } catch (memoryError) {
                  console.warn("[Chat] Erro ao extrair/salvar memórias persistentes:", memoryError);
                }
              })();
            } catch (storageError) {
              console.warn("[Chat] Erro ao salvar histórico de conversa:", storageError);
            }
          };
          
          // If no content at all, return error
          if (contentParts.length === 0 && !input.pdfs?.length) {
            return {
              success: false,
              content: "Por favor, envie uma mensagem de texto, imagem, áudio ou PDF.",
            };
          }
          
          // If only PDFs were sent and text extraction failed, inform user
          if (input.pdfs && input.pdfs.length > 0 && contentParts.length === 0) {
            return {
              success: false,
              content: "Não foi possível extrair texto dos PDFs enviados. Tente novamente ou envie junto com uma mensagem de texto.",
            };
          }
          
          // Determine if we should use Groq or invokeLLM
          const hasAudio = contentParts.some(part => part.type === "file_url");
          const groqApiKey = process.env.GROQ_API_KEY;
          
          // Prefer Groq for text and images (Groq supports images but audio support is limited)
          // Use invokeLLM for audio or when Groq is not available
          // Only use Groq if there's no audio and Groq is configured
          if (groqApiKey && !hasAudio) {
            // Use Groq (preferred for text and images)
            try {
              // Build user content for Groq
              // Process images - save to temp files if needed to avoid ENAMETOOLONG
              const processedContentParts = await Promise.all(
                contentParts.map(async (part) => {
                  if (part.type === "text") {
                    return { type: "text", text: part.text };
                  } else if (part.type === "image_url") {
                    // Save image to temp file if it's a data URL or very long
                    const { path: imagePath, cleanup } = await processFileForPython(part.image_url.url, 'jpg');
                    tempFileCleanups.push(cleanup);
                    return { type: "image_url", image_url: { url: imagePath } };
                  }
                  // Skip audio for Groq
                  return null;
                })
              );
              
              const userContentForGroq = processedContentParts.length === 1 && processedContentParts[0]?.type === "text"
                ? processedContentParts[0].text
                : processedContentParts.length > 1 || processedContentParts.some(p => p && p.type !== "text")
                ? processedContentParts.filter(Boolean)
                : processedContentParts[0]?.text || "";
              
              // Prepare conversation history for Groq
              const groqHistory = input.conversationHistory?.map(msg => {
                // Convert multimodal history to Groq format
                if (typeof msg.content === "string") {
                  return { role: msg.role, content: msg.content };
                }
                // For multimodal content, try to preserve structure
                return { role: msg.role, content: msg.content };
              });
              
              // Call Groq multimodal assistant
              const response = await groqService.financialAssistantMultimodal(
                userContentForGroq,
                groqHistory
              );

              const responseText = normalizeAssistantContent(response);
              await persistConversation(responseText);
              
              // Schedule cleanup after a delay to ensure Python has finished
              setTimeout(async () => {
                await Promise.all(tempFileCleanups.map(cleanup => cleanup().catch(() => {})));
              }, 5000); // Wait 5 seconds to ensure Python processes are done
              
              return {
                success: true,
                content: responseText,
              };
            } catch (groqError) {
              // Schedule cleanup even on error
              setTimeout(async () => {
                await Promise.all(tempFileCleanups.map(cleanup => cleanup().catch(() => {})));
              }, 5000);
              console.error("[Chat] Erro ao usar Groq, tentando fallback:", groqError);
              // Fall through to invokeLLM if Groq fails
            }
          }
          
          // Use invokeLLM for audio or as fallback when Groq is not available
          // Check if Forge API is configured (required for audio or when Groq is not available)
          if (!ENV.forgeApiKey) {
            // If we reach here, Groq either failed or is not configured
            if (hasAudio) {
              return {
                success: false,
                content: "Áudio requer configuração do serviço Forge (BUILT_IN_FORGE_API_KEY). Para texto e imagens, configure GROQ_API_KEY no arquivo .env",
              };
            }
            // Groq should have been used, but if we're here, it failed or wasn't configured
            return {
              success: false,
              content: "Erro ao processar mensagem. Verifique se GROQ_API_KEY está configurada no arquivo .env, ou configure BUILT_IN_FORGE_API_KEY para usar o serviço Forge.",
            };
          }
          
          // Build messages array for invokeLLM
          const messages: Message[] = [
            {
              role: "system",
              content: "Você é o Bolsinho, assistente financeiro pessoal e especialista em investimentos e finanças. Você é especializado em educação financeira, planejamento de orçamento, análise de gastos, investimentos e mercado financeiro, e economia. Seja sempre prestativo, claro e forneça conselhos práticos. Use linguagem acessível e exemplos quando apropriado. Quando falar sobre investimentos, sempre mencione os riscos envolvidos.",
            },
          ];
          
          // Add conversation history if provided
          if (input.conversationHistory) {
            input.conversationHistory.forEach((msg) => {
              if (msg.role !== "system") {
                messages.push({
                  role: msg.role,
                  content: msg.content as any,
                });
              }
            });
          }
          
          // Add current user message
          // Convert contentParts to the format expected by MessageContent
          const userMessageContent: Message["content"] = contentParts.length === 1 && contentParts[0].type === "text"
            ? contentParts[0].text
            : contentParts as Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } } | { type: "file_url"; file_url: { url: string; mime_type?: string } }>;
          
          messages.push({
            role: "user",
            content: userMessageContent,
          });
          
          // Call multimodal LLM
          const result = await invokeLLM({
            messages,
            max_tokens: 32768,
          });
          
          // Extract response content
          const responseContent = result.choices[0]?.message?.content;
          
          if (!responseContent) {
            return {
              success: false,
              content: "Desculpe, não recebi uma resposta do modelo.",
            };
          }
          
          // Handle both string and array responses
          const responseText = typeof responseContent === "string"
            ? responseContent
            : Array.isArray(responseContent)
            ? responseContent
                .filter((part: any) => part.type === "text")
                .map((part: any) => part.text)
                .join("\n")
            : String(responseContent);

          await persistConversation(responseText);
          
          return {
            success: true,
            content: responseText,
          };
        } catch (error) {
          console.error("[Chat] Erro ao processar mensagem:", error);
          const fallbackContent = "No momento estou com instabilidade nos serviços de IA externos. Sua mensagem foi registrada, e você pode tentar novamente em instantes.";

          try {
            await persistConversation(fallbackContent);
          } catch (persistError) {
            console.warn("[Chat] Falha ao salvar conversa após erro principal:", persistError);
          }

          return {
            success: true,
            content: fallbackContent,
            warning: error instanceof Error ? error.message : "Erro desconhecido",
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
