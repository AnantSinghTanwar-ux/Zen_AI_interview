"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Code, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import PageLayout from "@/components/PageLayout";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface DSAQuestion {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  problem: string;
  constraints?: string[];
  examples?: { input: string; output: string; explanation?: string }[];
}

export default function DSAInterviewPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<DSAQuestion | null>(null);
  const [interviewStage, setInterviewStage] = useState<"greeting" | "question" | "solution" | "feedback">("greeting");
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const { sendStreamingMessage, isStreaming } = useStreamingChat({
    onMessage: (delta) => {
      setStreamingMessage(prev => prev + delta);
    },
    onComplete: (fullMessage, newChatId) => {
      // Add the complete message to chat history
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: fullMessage,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingMessage("");
      
      if (newChatId) {
        setChatId(newChatId);
      }

      // Parse response for question data and stage updates
      const questionData = parseQuestionFromResponse(fullMessage);
      if (questionData) {
        setCurrentQuestion(questionData);
        setInterviewStage("question");
        setTimerActive(true);
        setTimeElapsed(0);
      } else if (fullMessage.includes("feedback") || fullMessage.includes("analysis")) {
        setInterviewStage("feedback");
        setTimerActive(false);
      }
    },
    onError: (error) => {
      console.error("Streaming error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setStreamingMessage("");
    },
  });

  const sendMessage = async (message: string) => {
    if (!message.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentInput("");

    // Start streaming response
    await sendStreamingMessage(message, chatId || undefined, interviewStage);
  };

  const startInterview = () => {
    sendMessage("I'm ready to start the DSA interview. Please give me a coding problem to solve.");
  };

  const getDifficultyColor = (difficulty: "Easy" | "Medium" | "Hard") => {
    switch (difficulty) {
      case "Easy": return "text-green-600 bg-green-100";
      case "Medium": return "text-orange-600 bg-orange-100";
      case "Hard": return "text-red-600 bg-red-100";
    }
  };

  const parseQuestionFromResponse = (response: string): DSAQuestion | null => {
    try {
      const lines = response.split('\n');
      let title = "";
      let difficulty: "Easy" | "Medium" | "Hard" = "Medium";
      let problem = "";
      let constraints: string[] = [];
      let examples: { input: string; output: string; explanation?: string }[] = [];

      let currentSection = "";
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.includes("**Problem:**") || trimmedLine.includes("Problem:")) {
          currentSection = "problem";
          title = trimmedLine.replace(/\*\*Problem:\*\*|Problem:/, "").trim();
        } else if (trimmedLine.includes("**Difficulty:**") || trimmedLine.includes("Difficulty:")) {
          const diffMatch = trimmedLine.match(/(Easy|Medium|Hard)/i);
          if (diffMatch) {
            difficulty = diffMatch[1] as "Easy" | "Medium" | "Hard";
          }
        } else if (trimmedLine.includes("**Examples:**") || trimmedLine.includes("Examples:")) {
          currentSection = "examples";
        } else if (trimmedLine.includes("**Constraints:**") || trimmedLine.includes("Constraints:")) {
          currentSection = "constraints";
        } else if (currentSection === "problem" && trimmedLine) {
          problem += trimmedLine + "\n";
        } else if (currentSection === "constraints" && (trimmedLine.startsWith("-") || trimmedLine.startsWith("•"))) {
          constraints.push(trimmedLine.replace(/^[-•]\s*/, ""));
        }
      }

      if (title && problem) {
        return {
          title: title || "Coding Problem",
          difficulty,
          problem: problem.trim(),
          constraints: constraints.length > 0 ? constraints : undefined,
          examples: examples.length > 0 ? examples : undefined,
        };
      }

      return null;
    } catch (error) {
      console.error("Error parsing question:", error);
      return null;
    }
  };

  return (
    <PageLayout>
    <div className="min-h-screen bg-[#f5f5f7]  border border-none flex flex-col pt-24">
      {/* Header */}
      <div className="bg-[#f5f5f7]  text-black border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-600" />
              <h1 className="text-black text-black text-lg font-semibold text-gray-900">DSA Interview</h1>
            </div>
          </div>
          
          {timerActive && (
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Clock className="w-4 h-4" />
              {formatTime(timeElapsed)}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Chat Section */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Code className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-black text-black text-xl font-semibold text-gray-900 mb-2">
                  Ready for your DSA Interview?
                </h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  I'll give you coding problems to solve. You can type your solution and approach, 
                  and I'll provide feedback and guidance.
                </p>
                <Button onClick={startInterview} className="bg-blue-600 hover:bg-blue-700" disabled={isStreaming}>
                  Start Interview
                </Button>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-2xl px-4 py-3 rounded-2xl",
                      message.role === "user"
                        ? "bg-blue-600 text-black"
                        : "bg-[#f5f5f7]  text-black border border-gray-200"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div
                      className={cn(
                        "text-xs mt-2 opacity-70",
                        message.role === "user" ? "text-blue-100" : "text-gray-500"
                      )}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Streaming message */}
            {streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-2xl px-4 py-3 rounded-2xl bg-[#f5f5f7]  text-black border border-gray-200">
                  <div className="whitespace-pre-wrap">{streamingMessage}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                    <span className="text-xs text-gray-500">AI is typing...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-[#f5f5f7]  text-black p-4">
            <div className="flex gap-3">
              <Input
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder={
                  interviewStage === "greeting" 
                    ? "Say hello to start the interview..."
                    : interviewStage === "question"
                    ? "Describe your approach or paste your solution..."
                    : "Ask questions or discuss the solution..."
                }
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(currentInput);
                  }
                }}
                disabled={isStreaming}
                className="flex-1"
              />
              <Button
                onClick={() => sendMessage(currentInput)}
                disabled={isStreaming || !currentInput.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </div>

        {/* Question Panel */}
        {currentQuestion && (
          <div className="w-96 border-l border-gray-200 bg-[#f5f5f7]  text-black p-4 overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-black text-black font-semibold text-gray-900">Current Problem</h3>
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  getDifficultyColor(currentQuestion.difficulty)
                )}>
                  {currentQuestion.difficulty}
                </span>
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-3">
                {currentQuestion.title}
              </h4>
            </div>

            <div className="space-y-4">
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Problem Statement</h5>
                <div className="text-sm text-gray-600 whitespace-pre-wrap">
                  {currentQuestion.problem}
                </div>
              </div>

              {currentQuestion.examples && currentQuestion.examples.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-700 mb-2">Examples</h5>
                  {currentQuestion.examples.map((example, index) => (
                    <div key={index} className="bg-[#f5f5f7]  border border-none rounded p-3 mb-2 text-sm">
                      <div className="mb-1">
                        <span className="font-medium">Input:</span> {example.input}
                      </div>
                      <div className="mb-1">
                        <span className="font-medium">Output:</span> {example.output}
                      </div>
                      {example.explanation && (
                        <div className="text-gray-600">
                          <span className="font-medium">Explanation:</span> {example.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {currentQuestion.constraints && currentQuestion.constraints.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-700 mb-2">Constraints</h5>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {currentQuestion.constraints.map((constraint, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-gray-400 mt-1">•</span>
                        {constraint}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </PageLayout>
  );
}
