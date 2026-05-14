"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Code, Send, Shuffle, ChevronDown, ChevronUp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageLayout from "@/components/PageLayout";
import PremiumAccessPopup from "@/components/PremiumAccessPopup";
import { cn } from "@/lib/utils";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import {
  POPULAR_DSA_QUESTIONS,
  PRACTICE_COMPANY_PROFILES,
  PracticeCompanyKey,
} from "@/constants/practice";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface DSAQuestion {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  problem: string;
  topic?: string;
}

const difficultyOptions = ["Any", "Easy", "Medium", "Hard"] as const;

// --- Minimal Code Editor Component ---
const CodeEditor = ({
  value,
  onChange,
  language = "javascript",
}: {
  value: string;
  onChange: (val: string) => void;
  language?: string;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCountRef = useRef<HTMLDivElement>(null);
  const lines = value.split("\n");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);
      // Set cursor position after the tab
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  const handleScroll = () => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-white/10 bg-[#0a0a0f] overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-muted-foreground ml-2 font-mono">solution.{language === "python" ? "py" : language === "java" ? "java" : "js"}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs bg-transparent border border-white/10 rounded px-2 py-0.5 text-muted-foreground"
            defaultValue={language}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Line Numbers */}
        <div
          ref={lineCountRef}
          className="flex flex-col items-end py-3 px-3 bg-[#0d0d12] text-muted-foreground/40 font-mono text-xs select-none overflow-hidden border-r border-white/5 min-w-[3rem]"
        >
          {lines.map((_, i) => (
            <div key={i} className="leading-[1.6rem] h-[1.6rem]">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          className="flex-1 bg-transparent text-[#e8e8ed] font-mono text-sm p-3 resize-none outline-none leading-[1.6rem] overflow-auto placeholder:text-muted-foreground/30"
          placeholder={`// Write or paste your solution here...\n// The AI will review your code alongside your chat messages.\n\nfunction solution(input) {\n  // Your approach here\n}`}
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#111118] border-t border-white/10 text-xs text-muted-foreground/50 font-mono">
        <span>Ln {lines.length}, Col {(value.split("\n").pop() || "").length + 1}</span>
        <span>{value.length} chars</span>
      </div>
    </div>
  );
};

export default function DSAInterviewPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<DSAQuestion | null>(null);
  const [interviewStage, setInterviewStage] = useState<"greeting" | "question" | "solution" | "feedback">("greeting");
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState<string | undefined>(undefined);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [codeContent, setCodeContent] = useState("");
  const [showCodeEditor, setShowCodeEditor] = useState(true);

  const SESSION_TIME_LIMIT = 30 * 60; // 30 minutes in seconds

  const [selectedCompany, setSelectedCompany] = useState<PracticeCompanyKey>("microsoft");
  const [selectedDifficulty, setSelectedDifficulty] = useState<(typeof difficultyOptions)[number]>("Any");
  const [selectedTopic, setSelectedTopic] = useState("Any");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const premiumUsageKeyRef = useRef(`dsa-practice:${Date.now()}`);

  const availableTopics = useMemo(() => {
    const topics = new Set<string>();
    POPULAR_DSA_QUESTIONS.forEach((q) => {
      if (q.companies.includes(selectedCompany) || q.companies.includes("generic")) {
        topics.add(q.topic);
      }
    });
    return ["Any", ...Array.from(topics).sort()];
  }, [selectedCompany]);

  const companyName = useMemo(() => {
    return PRACTICE_COMPANY_PROFILES.find((company) => company.key === selectedCompany)?.name || "General Tech";
  }, [selectedCompany]);

  const filteredQuestions = useMemo(() => {
    return POPULAR_DSA_QUESTIONS.filter((q) => {
      const companyOk = q.companies.includes(selectedCompany) || q.companies.includes("generic");
      const difficultyOk = selectedDifficulty === "Any" || q.difficulty === selectedDifficulty;
      const topicOk = selectedTopic === "Any" || q.topic === selectedTopic;
      return companyOk && difficultyOk && topicOk;
    });
  }, [selectedCompany, selectedDifficulty, selectedTopic]);

  const pickQuestion = () => {
    const pool = filteredQuestions.length > 0 ? filteredQuestions : POPULAR_DSA_QUESTIONS;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // FIX: Scroll only the chat container, not the whole page
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => {
          const next = prev + 1;
          // Enforce 30-minute hard limit
          if (next >= SESSION_TIME_LIMIT) {
            setTimerActive(false);
            setSessionExpired(true);
          }
          return next;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive]);

  useEffect(() => {
    if (!availableTopics.includes(selectedTopic)) {
      setSelectedTopic("Any");
    }
  }, [availableTopics, selectedTopic]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Using OpenRouter endpoint instead of Vapi for cost optimization
  const { sendStreamingMessage, isStreaming } = useStreamingChat({
    premiumUsageKey: premiumUsageKeyRef.current,
    endpoint: "/api/dsa/chat-stream",
    onMessage: (delta) => setStreamingMessage((prev) => prev + delta),
    onPremiumRequired: (message) => {
      setPremiumMessage(
        message ||
          "Premium is required to continue using this Vapi AI feature."
      );
      setShowPremiumPopup(true);
    },
    onComplete: (fullMessage, newChatId) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: fullMessage,
          timestamp: new Date(),
        },
      ]);
      setStreamingMessage("");

      if (newChatId) setChatId(newChatId);

      if (/feedback|analysis|score/i.test(fullMessage)) {
        setInterviewStage("feedback");
        setTimerActive(false);
      }
    },
    onError: (error) => {
      console.error("Streaming error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I hit an error while generating the response. Please try again.",
          timestamp: new Date(),
        },
      ]);
      setStreamingMessage("");
    },
  });

  const sendMessage = async (message: string) => {
    if (!message.trim() || isStreaming) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: message,
        timestamp: new Date(),
      },
    ]);
    setCurrentInput("");

    // Pass code content so the AI can review both chat + code
    await sendStreamingMessage(message, chatId || undefined, interviewStage, codeContent || undefined);
  };

  const startInterview = async () => {
    try {
      const interviewUsageKey = `dsa-practice:${Date.now()}`;
      premiumUsageKeyRef.current = interviewUsageKey;

      const premiumCheck = await fetch("/api/premium/vapi-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feature: "dsa-practice",
          usageKey: interviewUsageKey,
          quotaKind: "interview",
        }),
      });

      const premiumPayload = await premiumCheck.json().catch(() => ({}));

      const requiresPremiumUpgrade =
        premiumCheck.status === 402 ||
        premiumCheck.status === 429 ||
        premiumPayload?.allowed === false ||
        premiumPayload?.code === "PREMIUM_REQUIRED" ||
        premiumPayload?.code === "PREMIUM_DAILY_LIMIT_REACHED";

      if (requiresPremiumUpgrade) {
        setPremiumMessage(
          premiumPayload?.message ||
            "Premium is required to continue using this Vapi AI feature."
        );
        setShowPremiumPopup(true);
        return;
      }

      if (!premiumCheck.ok) {
        throw new Error("Failed to validate premium access");
      }

      const picked = pickQuestion();
      setCurrentQuestion({
        title: picked.title,
        difficulty: picked.difficulty,
        problem: picked.prompt,
        topic: picked.topic,
      });
      setInterviewStage("question");
      setTimerActive(true);
      setTimeElapsed(0);
      setCodeContent("");

      const kickoff = [
        `Start a ${companyName}-style DSA round.`,
        `Use this selected popular question as the main problem: ${picked.title}.`,
        `Difficulty: ${picked.difficulty}. Topic: ${picked.topic}.`,
        `Problem statement: ${picked.prompt}`,
        "Act like a real interviewer: ask clarifying questions, evaluate approach, then discuss optimal solution and trade-offs.",
        "Keep answers concise and practical.",
      ].join(" ");

      await sendMessage(kickoff);
    } catch (error) {
      console.error("Failed to start DSA interview:", error);
    }
  };

  const getDifficultyColor = (difficulty: "Easy" | "Medium" | "Hard") => {
    if (difficulty === "Easy") return "text-green-300 bg-green-500/20 border border-green-500/30";
    if (difficulty === "Medium") return "text-amber-300 bg-amber-500/20 border border-amber-500/30";
    return "text-red-300 bg-red-500/20 border border-red-500/30";
  };

  return (
    <PageLayout>
      <div className="h-screen bg-background text-foreground flex flex-col pt-24 overflow-hidden">
        {/* Top Bar */}
        <div className="border-b border-white/10 px-4 py-3 bg-background/95 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between max-w-[1600px] mx-auto gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </Link>
              <div className="h-6 w-px bg-white/15" />
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-semibold text-foreground">Company-Focused DSA Practice</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCodeEditor(!showCodeEditor)}
                className="text-xs gap-1.5"
              >
                <Code className="w-3.5 h-3.5" />
                {showCodeEditor ? "Hide" : "Show"} Editor
              </Button>
              {timerActive && (
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/90">
                  <Clock className="w-4 h-4" />
                  {formatTime(timeElapsed)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-[1600px] mx-auto w-full px-4 pt-4 shrink-0">
          <div className="glass-card p-4 rounded-2xl border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value as PracticeCompanyKey)}
                className="h-10 rounded-md border border-input bg-background px-3 text-foreground"
              >
                {PRACTICE_COMPANY_PROFILES.map((company) => (
                  <option key={company.key} value={company.key}>
                    {company.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as (typeof difficultyOptions)[number])}
                className="h-10 rounded-md border border-input bg-background px-3 text-foreground"
              >
                {difficultyOptions.map((option) => (
                  <option key={option} value={option}>
                    Difficulty: {option}
                  </option>
                ))}
              </select>

              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-foreground"
              >
                {availableTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    Topic: {topic}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <Button onClick={startInterview} disabled={isStreaming} className="flex-1">
                  Start
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const picked = pickQuestion();
                    setCurrentQuestion({
                      title: picked.title,
                      difficulty: picked.difficulty,
                      problem: picked.prompt,
                      topic: picked.topic,
                    });
                  }}
                  className="px-3"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Question pool: {filteredQuestions.length} popular DSA problems for {companyName}
            </p>
          </div>
        </div>

        {/* Main Content: Chat + Code Editor */}
        <div className="flex-1 flex max-w-[1600px] mx-auto w-full px-4 pb-4 pt-4 gap-4 min-h-0 overflow-hidden">
          {/* Chat Panel */}
          <div className="flex-1 flex flex-col glass-card rounded-2xl border border-white/10 overflow-hidden min-w-0">
            {/* Chat Messages — scrolls only within this container */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/25">
                    <Code className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Ready for targeted DSA prep?</h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Select your company and filters, then start. Write your solution in the code editor and discuss your approach in the chat.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-2xl px-4 py-3 rounded-2xl",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 text-foreground border border-white/10"
                      )}
                    >
                      <div className="whitespace-pre-wrap text-sm md:text-base">{message.content}</div>
                      <div
                        className={cn(
                          "text-xs mt-2 opacity-80",
                          message.role === "user" ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {streamingMessage && (
                <div className="flex justify-start">
                  <div className="max-w-2xl px-4 py-3 rounded-2xl bg-white/5 text-foreground border border-white/10">
                    <div className="whitespace-pre-wrap text-sm md:text-base">{streamingMessage}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" />
                        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                      <span className="text-xs text-muted-foreground">AI is typing...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-white/10 bg-background/70 p-4 shrink-0">
              {sessionExpired && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 text-center">
                  ⏱ Session time limit reached (30 min). Purchase another session to continue.
                </div>
              )}
              <div className="flex gap-3">
                <textarea
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder={
                    sessionExpired
                      ? "Session expired — purchase another to continue"
                      : "Share your approach or paste your solution..."
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(currentInput);
                    }
                  }}
                  disabled={isStreaming || sessionExpired}
                  rows={2}
                  className="flex-1 bg-background border border-input rounded-xl px-4 py-3 text-sm text-foreground resize-none outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
                />
                <Button
                  onClick={() => sendMessage(currentInput)}
                  disabled={isStreaming || !currentInput.trim() || sessionExpired}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Code Editor Panel */}
          {showCodeEditor && (
            <div className="w-[500px] xl:w-[600px] flex flex-col gap-4 min-h-0 hidden lg:flex">
              {/* Code Editor */}
              <div className="flex-1 min-h-0">
                <CodeEditor value={codeContent} onChange={setCodeContent} />
              </div>

              {/* Problem Sidebar */}
              {currentQuestion && (
                <div className="glass-card rounded-2xl border border-white/10 p-4 overflow-y-auto max-h-[250px] shrink-0">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Current Problem</h3>
                    <span className={cn("px-2 py-1 rounded text-xs font-medium", getDifficultyColor(currentQuestion.difficulty))}>
                      {currentQuestion.difficulty}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">{currentQuestion.title}</h4>
                  {currentQuestion.topic && (
                    <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">Topic: {currentQuestion.topic}</p>
                  )}
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{currentQuestion.problem}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PremiumAccessPopup
        open={showPremiumPopup}
        message={premiumMessage}
        suggestedProduct="dsa_practice"
        onClose={() => setShowPremiumPopup(false)}
        onActivated={() => {
          setShowPremiumPopup(false);
        }}
      />
    </PageLayout>
  );
}
