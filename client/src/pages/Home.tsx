import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

/**
 * Página principal do Bolsinho - Assistente Financeiro Pessoal
 */
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "Você é o Bolsinho, assistente financeiro pessoal e especialista em investimentos e finanças.",
    },
  ]);

  const uploadMutation = trpc.upload.file.useMutation();
  const chatMutation = trpc.chat.send.useMutation({
    onSuccess: (response) => {
      if (response.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: response.content,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: response.content || "Desculpe, ocorreu um erro. Tente novamente.",
          },
        ]);
      }
    },
    onError: (error) => {
      console.error("Erro no chat:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
        },
      ]);
    },
  });

  const handleUploadFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          // Convert to base64
          const base64String = (reader.result as string).split(',')[1] || reader.result as string;
          
          // Upload to server
          const result = await uploadMutation.mutateAsync({
            file: base64String,
            filename: file.name,
            mimeType: file.type,
          });
          
          if (result.success && result.url) {
            resolve(result.url);
          } else {
            reject(new Error("Erro ao fazer upload do arquivo"));
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Erro desconhecido ao fazer upload"));
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = (content: string, images?: string[], audio?: string, pdfs?: string[]) => {
    // Build user message content
    let userMessageContent: Message["content"];
    
    if (images && images.length > 0 || audio) {
      // Multimodal message
      const contentParts: Array<{ type: "text" } | { type: "image_url" } | { type: "file_url" }> = [];
      
      if (content.trim()) {
        contentParts.push({
          type: "text",
          text: content,
        });
      }
      
      if (images && images.length > 0) {
        images.forEach((imgUrl) => {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: imgUrl,
            },
          });
        });
      }
      
      if (audio) {
        const audioMimeType = audio.includes('.mp3') ? 'audio/mpeg' :
                             audio.includes('.wav') ? 'audio/wav' :
                             audio.includes('.m4a') ? 'audio/mp4' :
                             audio.includes('.webm') ? 'audio/webm' :
                             audio.includes('.ogg') ? 'audio/ogg' :
                             'audio/mpeg';
        
        contentParts.push({
          type: "file_url",
          file_url: {
            url: audio,
            mime_type: audioMimeType,
          },
        });
      }
      
      userMessageContent = contentParts.length === 1 && contentParts[0].type === "text"
        ? contentParts[0].text
        : contentParts;
    } else {
      // Text-only message
      userMessageContent = content;
    }
    
    // Adiciona a mensagem do usuário
    const userMessage: Message = { role: "user", content: userMessageContent };
    setMessages((prev) => [...prev, userMessage]);

    // Prepara o histórico da conversa (sem mensagens de sistema)
    const conversationHistory = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => {
        // Normalize content for history
        if (typeof msg.content === "string") {
          return {
            role: msg.role as "user" | "assistant",
            content: msg.content,
          };
        }
        
        // For multimodal messages, keep the structure
        return {
          role: msg.role as "user" | "assistant",
          content: msg.content,
        };
      });

    // Envia para o servidor
    chatMutation.mutate({
      message: content || undefined,
      images: images && images.length > 0 ? images : undefined,
      audio: audio || undefined,
      pdfs: pdfs && pdfs.length > 0 ? pdfs : undefined,
      conversationHistory,
    });
  };

  const suggestedPrompts = [
    "Quais são as principais notícias financeiras de hoje?",
    "Me explique sobre investimentos para iniciantes",
    "Como criar um orçamento mensal?",
    "Quais são os melhores investimentos para 2025?",
    "Como analisar meus gastos?",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Bolsinho</h1>
          <p className="text-sm text-muted-foreground">
            Seu assistente financeiro pessoal - Especialista em investimentos e finanças
          </p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            onUploadFile={handleUploadFile}
            isLoading={chatMutation.isPending || uploadMutation.isPending}
            placeholder="Pergunte ao Bolsinho sobre investimentos, finanças, orçamento..."
            height="calc(100vh - 200px)"
            emptyStateMessage="Olá! Eu sou o Bolsinho, seu assistente financeiro pessoal e especialista em investimentos e finanças. Como posso ajudar você hoje? Você pode me enviar textos, imagens de recibos/documentos ou áudio."
            suggestedPrompts={suggestedPrompts}
          />
        </div>
      </main>
    </div>
  );
}
