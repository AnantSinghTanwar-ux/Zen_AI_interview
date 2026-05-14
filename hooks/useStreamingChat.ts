"use client";

import { useState, useCallback } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UseStreamingChatProps {
  onMessage?: (message: string) => void;
  onComplete?: (fullMessage: string, chatId?: string) => void;
  onError?: (error: string) => void;
  onPremiumRequired?: (message?: string) => void;
  premiumUsageKey?: string;
  endpoint?: string;
}

export function useStreamingChat({
  onMessage,
  onComplete,
  onError,
  onPremiumRequired,
  premiumUsageKey,
  endpoint = "/api/vapi/chat-stream",
}: UseStreamingChatProps = {}) {
  const [isStreaming, setIsStreaming] = useState(false);

  const sendStreamingMessage = useCallback(
    async (
      message: string,
      previousChatId?: string,
      stage?: string,
      codeContent?: string
    ): Promise<string> => {
      if (isStreaming) return "";

      setIsStreaming(true);
      let fullResponse = "";
      let currentChatId = "";

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            previousChatId,
            chatId: previousChatId,
            stage,
            premiumUsageKey,
            codeContent,
          }),
        });

        if (!response.ok) {
          if (response.status === 402) {
            const payload = await response.json().catch(() => ({}));
            onPremiumRequired?.(payload?.message);
            return "";
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No reader available");
        }

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // Extract chat ID from the first event
                if (data.id && !currentChatId) {
                  currentChatId = data.id;
                }

                // Handle streaming content
                if (data.path && data.delta) {
                  fullResponse += data.delta;
                  onMessage?.(data.delta);
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE data:", parseError);
              }
            }
          }
        }

        onComplete?.(fullResponse, currentChatId);
        return fullResponse;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Streaming error:", errorMessage);
        onError?.(errorMessage);
        return "";
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, onMessage, onComplete, onError, onPremiumRequired, premiumUsageKey, endpoint]
  );

  return {
    sendStreamingMessage,
    isStreaming,
  };
}
