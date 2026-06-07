import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Send, User, Sparkles, Image as ImageIcon, Mic, X, FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

/**
 * Message content types for multimodal support
 */
export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export type AudioContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type: "audio/mpeg" | "audio/wav" | "audio/mp4" | "audio/webm" | "audio/ogg";
  };
};

export type MessageContent = string | TextContent | ImageContent | AudioContent | Array<TextContent | ImageContent | AudioContent>;

/**
 * Message type matching server-side LLM Message interface with multimodal support
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: MessageContent;
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Can receive text, images, audio files, or PDFs.
   */
  onSendMessage: (content: string, images?: string[], audio?: string, pdfs?: string[]) => void;
  
  /**
   * Callback to upload files (images/audio) to storage.
   * Should return the URL of the uploaded file.
   */
  onUploadFile?: (file: File) => Promise<string>;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
  onUploadFile,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [selectedPdfs, setSelectedPdfs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Filter out system messages and normalize content for display
  type DisplayMessage = {
    role: "user" | "assistant";
    content: string;
    images?: string[];
    audio?: string | null;
  };
  
  const displayMessages: DisplayMessage[] = messages.filter((msg) => msg.role !== "system").map((msg) => {
    // Normalize content to always have a text representation
    if (typeof msg.content === "string") {
      return { role: msg.role as "user" | "assistant", content: msg.content, images: [], audio: null };
    }
    
    if (Array.isArray(msg.content)) {
      const textParts: string[] = [];
      const images: string[] = [];
      let audio: string | null = null;
      
      msg.content.forEach((part) => {
        if (typeof part === "string") {
          textParts.push(part);
        } else if (part.type === "text") {
          textParts.push(part.text);
        } else if (part.type === "image_url") {
          images.push(part.image_url.url);
        } else if (part.type === "file_url" && part.file_url.mime_type?.startsWith("audio/")) {
          audio = part.file_url.url;
        }
      });
      
      return {
        role: msg.role as "user" | "assistant",
        content: textParts.join("\n") || (images.length > 0 ? "📷 Imagem enviada" : audio ? "🎤 Áudio enviado" : ""),
        images,
        audio,
      };
    }
    
    // Handle single content object
    if (typeof msg.content === "object" && msg.content !== null && "type" in msg.content) {
      if (msg.content.type === "text") {
        return { role: msg.role as "user" | "assistant", content: msg.content.text, images: [], audio: null };
      } else if (msg.content.type === "image_url") {
        return { role: msg.role as "user" | "assistant", content: "📷 Imagem enviada", images: [msg.content.image_url.url], audio: null };
      } else if (msg.content.type === "file_url" && msg.content.file_url.mime_type?.startsWith("audio/")) {
        return { role: msg.role as "user" | "assistant", content: "🎤 Áudio enviado", images: [], audio: msg.content.file_url.url };
      }
    }
    
    return { role: msg.role as "user" | "assistant", content: String(msg.content), images: [], audio: null };
  });

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;

      // Reserve space for:
      // - padding (p-4 = 32px top+bottom)
      // - user message: 40px (item height) + 16px (margin-top from space-y-4) = 56px
      // Note: margin-bottom is not counted because it naturally pushes the assistant message down
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;

      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    if (!onUploadFile) {
      throw new Error("onUploadFile callback is required for file uploads");
    }
    return onUploadFile(file);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      // Create preview URLs first
      const previewUrls = files.map((file) => URL.createObjectURL(file));
      setSelectedImages((prev) => [...prev, ...previewUrls]);
      
      // Upload files
      const uploadedUrls = await Promise.all(
        files.map((file) => handleFileUpload(file))
      );
      
      // Replace preview URLs with actual uploaded URLs
      setSelectedImages((prev) => {
        const newImages = [...prev];
        // Remove preview URLs
        previewUrls.forEach((previewUrl) => {
          const index = newImages.indexOf(previewUrl);
          if (index !== -1) {
            URL.revokeObjectURL(previewUrl);
            newImages.splice(index, 1);
          }
        });
        // Add uploaded URLs
        return [...newImages, ...uploadedUrls];
      });
    } catch (error) {
      console.error("Erro ao fazer upload de imagem:", error);
      // Remove any preview URLs that might have been added
      setSelectedImages((prev) => {
        const newImages = prev.filter((url) => {
          if (url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
            return false;
          }
          return true;
        });
        return newImages;
      });
    } finally {
      setUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      setSelectedAudio(previewUrl);
      
      const uploadedUrl = await handleFileUpload(file);
      setSelectedAudio(uploadedUrl);
    } catch (error) {
      console.error("Erro ao fazer upload de áudio:", error);
      setSelectedAudio(null);
    } finally {
      setUploading(false);
      if (audioInputRef.current) {
        audioInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => {
      const newImages = [...prev];
      const url = newImages[index];
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const removeAudio = () => {
    if (selectedAudio && selectedAudio.startsWith("blob:")) {
      URL.revokeObjectURL(selectedAudio);
    }
    setSelectedAudio(null);
  };

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map((file) => handleFileUpload(file));
      const uploadedUrls = await Promise.all(uploadPromises);
      setSelectedPdfs((prev) => [...prev, ...uploadedUrls]);
    } catch (error) {
      console.error("Erro ao fazer upload de PDF:", error);
    } finally {
      setUploading(false);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }
    }
  };

  const removePdf = (index: number) => {
    setSelectedPdfs((prev) => {
      const newPdfs = [...prev];
      newPdfs.splice(index, 1);
      return newPdfs;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    
    // Allow sending even without text if there are images, audio, or PDFs
    if ((!trimmedInput && selectedImages.length === 0 && !selectedAudio && selectedPdfs.length === 0) || isLoading || uploading) {
      return;
    }

    // Send message with attachments
    onSendMessage(
      trimmedInput || "", 
      selectedImages.length > 0 ? selectedImages : undefined, 
      selectedAudio || undefined,
      selectedPdfs.length > 0 ? selectedPdfs : undefined
    );
    
    // Clear inputs
    setInput("");
    setSelectedImages([]);
    setSelectedAudio(null);
    setSelectedPdfs([]);

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index: number) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {/* Display images if present */}
                      {message.images && message.images.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {message.images.map((imgUrl: string, imgIndex: number) => (
                            <img
                              key={imgIndex}
                              src={imgUrl}
                              alt={`Upload ${imgIndex + 1}`}
                              className="max-w-[200px] max-h-[200px] rounded object-cover"
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Display audio if present */}
                      {message.audio && (
                        <div className="mb-2">
                          <audio controls src={message.audio} className="max-w-full">
                            Seu navegador não suporta áudio.
                          </audio>
                        </div>
                      )}
                      
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Selected Images Preview */}
      {selectedImages.length > 0 && (
        <div className="px-4 pt-2 border-t bg-background/50">
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedImages.map((imgUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={imgUrl}
                  alt={`Preview ${index + 1}`}
                  className="w-20 h-20 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Audio Preview */}
      {selectedAudio && (
        <div className="px-4 pt-2 border-t bg-background/50">
          <div className="flex items-center gap-2 mb-2">
            <audio controls src={selectedAudio} className="flex-1 max-w-md">
              Seu navegador não suporta áudio.
            </audio>
            <button
              type="button"
              onClick={removeAudio}
              className="bg-destructive text-destructive-foreground rounded-full p-1"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Selected PDFs Preview */}
      {selectedPdfs.length > 0 && (
        <div className="px-4 pt-2 border-t bg-background/50">
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedPdfs.map((pdfUrl, index) => (
              <div key={index} className="flex items-center gap-2 bg-muted rounded px-3 py-1.5">
                <FileText className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">PDF {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removePdf(index)}
                  className="text-destructive hover:text-destructive/80"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex gap-2 p-4 border-t bg-background/50 items-end"
      >
        <div className="flex-1 flex flex-col gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 max-h-32 resize-none min-h-9"
            rows={1}
          />
          <div className="flex gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioSelect}
              className="hidden"
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handlePdfSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading || uploading}
              className="h-8 w-8"
              title="Adicionar imagem"
            >
              <ImageIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => audioInputRef.current?.click()}
              disabled={isLoading || uploading || !!selectedAudio}
              className="h-8 w-8"
              title="Adicionar áudio"
            >
              <Mic className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => pdfInputRef.current?.click()}
              disabled={isLoading || uploading}
              className="h-8 w-8"
              title="Adicionar PDF"
            >
              <FileText className="size-4" />
            </Button>
          </div>
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={(!input.trim() && selectedImages.length === 0 && !selectedAudio && selectedPdfs.length === 0) || isLoading || uploading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading || uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
