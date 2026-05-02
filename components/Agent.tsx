  /* eslint-disable @typescript-eslint/no-unused-vars */
  "use client";

  import Image from "next/image";
  import React, { useEffect, useMemo, useRef, useState } from "react";
  import { cn } from "@/lib/utils";
  import { AgentProps } from "@/types";
  import { useRouter } from "next/navigation";
  import { vapi } from "@/services/vapi/vapi.sdk";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Send, MessageSquare, Code, Activity, User, Mic } from "lucide-react";
  import {
    emotionDetectionService,
    EmotionData,
    EmotionLabel,
  } from "@/services/emotion/emotion-detection.service";
  import { useCallLogs } from "@/hooks/useCallLogs";
  import { toast } from "sonner";
  import { Message } from "@/types/vapi";
  import { useEmotionDetection } from "@/hooks/useEmotionDetection";
  import ResumeUpload from "./ResumeUpload";
  import PremiumAccessPopup from "./PremiumAccessPopup";

  enum CallStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    CONNECTING = "CONNECTING",
    FINISHED = "FINISHED",
  }

  interface SavedMessage {
    role: "user" | "assistant";
    content: string;
    timestamp?: number;
    emotionData?: EmotionData;
  }

  interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    emotionData?: EmotionData;
  }

  interface DSAQuestion {
    title: string;
    difficulty: "Easy" | "Medium" | "Hard";
    problem: string;
    constraints?: string[];
    examples?: { input: string; output: string; explanation?: string }[];
  }

  const ASSISTANT = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

  const CODING_ROLE_HINTS = [
    "software",
    "developer",
    "engineer",
    "backend",
    "frontend",
    "fullstack",
    "full-stack",
    "web developer",
    "sde",
    "programming",
    "coding",
  ];

  const NON_CODING_ROLE_HINTS = [
    "graphic",
    "visual",
    "designer",
    "marketing",
    "sales",
    "hr",
    "recruiter",
    "content",
    "copywriter",
    "operations",
  ];

  function toContextText(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((item) => toContextText(item)).join(" ");
    if (value && typeof value === "object") return Object.values(value).map((item) => toContextText(item)).join(" ");
    return "";
  }

  function extractRoleContextText(rawJson?: string): string {
    if (!rawJson) return "";
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      const combined = [
        toContextText(parsed),
        toContextText(parsed.job),
        toContextText(parsed.profile),
      ]
        .filter(Boolean)
        .join(" ");
      return combined.slice(0, 3000);
    } catch {
      return String(rawJson || "").slice(0, 3000);
    }
  }

  function Agent({
    userName,
    userId,
    type,
    jobContextJson,
    practiceContextJson,
  }: AgentProps & { jobContextJson?: string; practiceContextJson?: string }) {
    const router = useRouter();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [currentInput, setCurrentInput] = useState("");
    const [showChat, setShowChat] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<DSAQuestion | null>(
      null
    );
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const [currentCallId, setCurrentCallId] = useState<string | null>(null);
    const [fullAssistantMessage, setFullAssistantMessage] = useState<string>("");
    const [isSavingCall, setIsSavingCall] = useState(false);
    const [resumeText, setResumeText] = useState("");
    const [showPremiumPopup, setShowPremiumPopup] = useState(false);
    const [premiumMessage, setPremiumMessage] = useState<string | undefined>(undefined);
    const currentCallIdRef = useRef<string | null>(null);
    const isStartingCallRef = useRef(false);
    const userIdRef = useRef<string | undefined | null>(userId);
    const saveCallLogRef = useRef<
      ((vapiCallId: string, jobContext?: string) => Promise<any>) | null
    >(null);
    const addEmotionReadingRef = useRef<
      ((text: string, timestamp?: number) => Promise<void>) | null
    >(null);
    const currentEmotionRef = useRef<EmotionData | null>(null);
    const jobContextJsonRef = useRef(jobContextJson);
    const practiceContextJsonRef = useRef(practiceContextJson);
    const isJobContextInjectedRef = useRef(false);
    const isPracticeContextInjectedRef = useRef(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    // Use emotion detection hook
    const {
      currentEmotion,
      emotionHistory,
      addEmotionReading,
      clearEmotions,
      isProcessing: isProcessingEmotion,
    } = useEmotionDetection({
      callId: currentCallId || undefined,
      enableRealTime: true,
    });

    const [showEmotionOverlay, setShowEmotionOverlay] = useState(true);
    // Add call logs hook
    const { saveCallLog } = useCallLogs(userId);

    const openPremiumPopup = (message?: string) => {
      setPremiumMessage(
        message ||
          "This feature is locked after your first free Vapi AI usage. Click Yes I am a premium user to continue."
      );
      setShowPremiumPopup(true);
    };

    const isNonFatalVapiAudioError = (
      errorLike: unknown,
      message: string
    ) => {
      const normalizedMessage = message.toLowerCase();

      if (
        normalizedMessage.includes("wasm_or_worker_not_ready") ||
        normalizedMessage.includes("audio-processor-error") ||
        normalizedMessage.includes("didiniterror") ||
        normalizedMessage.includes("krisp")
      ) {
        return true;
      }

      if (!errorLike || typeof errorLike !== "object") {
        return false;
      }

      const eventLike = errorLike as {
        type?: string;
        stage?: string;
        error?: { message?: string };
      };

      return (
        eventLike.type === "audio-processor-error" ||
        eventLike.type === "audio-processing-setup-error" ||
        eventLike.type === "audio-observer-setup-error" ||
        eventLike.stage === "audio-processing-setup" ||
        eventLike.stage === "audio-observer-setup" ||
        String(eventLike.error?.message || "")
          .toLowerCase()
          .includes("wasm_or_worker_not_ready")
      );
    };

    useEffect(() => {
      userIdRef.current = userId;
    }, [userId]);

    useEffect(() => {
      saveCallLogRef.current = saveCallLog;
    }, [saveCallLog]);

    useEffect(() => {
      addEmotionReadingRef.current = addEmotionReading;
    }, [addEmotionReading]);

    useEffect(() => {
      currentEmotionRef.current = currentEmotion;
    }, [currentEmotion]);

    useEffect(() => {
      jobContextJsonRef.current = jobContextJson;
    }, [jobContextJson]);

    useEffect(() => {
      practiceContextJsonRef.current = practiceContextJson;
    }, [practiceContextJson]);

    const setTrackedCallId = (callId: string | null) => {
      currentCallIdRef.current = callId;
      setCurrentCallId(callId);
    };

    const roleContextText = useMemo(() => {
      const fromJob = extractRoleContextText(jobContextJson);
      const fromPractice = extractRoleContextText(practiceContextJson);
      return `${fromJob} ${fromPractice}`.toLowerCase();
    }, [jobContextJson, practiceContextJson]);

    const isLikelyCodingRole = useMemo(() => {
      const hasCodingHint = CODING_ROLE_HINTS.some((hint) => roleContextText.includes(hint));
      const hasNonCodingHint = NON_CODING_ROLE_HINTS.some((hint) => roleContextText.includes(hint));

      if (hasCodingHint) return true;
      if (hasNonCodingHint) return false;
      return false;
    }, [roleContextText]);

    const isExplicitCodingTaskMessage = (text: string): boolean => {
      const normalized = String(text || "").toLowerCase();

      const hasCodeBlock = /```[\s\S]*```/.test(text);
      const hasCodingAnchor =
        /(coding|code|algorithm|data structure|leetcode|function signature|time complexity|space complexity|runtime|big o)/i.test(
          text
        );
      const hasActionVerb = /(write|implement|solve|optimize|debug|complete|return|create)/i.test(text);
      const hasNonCodingSignal =
        /(portfolio|visual design|graphic|branding|client communication|behavioral|tell me about yourself)/i.test(
          text
        );

      if (hasCodeBlock) return true;
      if (hasNonCodingSignal && !/(write code|coding challenge|implement|function)/i.test(text)) return false;
      if (hasCodingAnchor && hasActionVerb) return true;

      if (
        isLikelyCodingRole &&
        /(algorithm|data structure|complexity|function|write code|implement)/i.test(normalized)
      ) {
        return true;
      }

      return false;
    };

    const parseQuestionFromMessage = (message: string): DSAQuestion | null => {
      try {
        if (!isExplicitCodingTaskMessage(message)) {
          return null;
        }

        const lines = message.split("\n");
        let title = "";
        let difficulty: "Easy" | "Medium" | "Hard" = "Medium";
        let problem = "";
        let constraints: string[] = [];

        let currentSection = "";

        // Look for question patterns in the full message
        const questionPatterns = [
          /(?:problem|question|challenge|task):\s*(.+?)(?:\n|$)/i,
          /(?:write|implement|create|solve)\s+(?:a|an)?\s*(.+?)(?:\n|\.)/i,
        ];

        for (const pattern of questionPatterns) {
          const match = message.match(pattern);
          if (match && match[1]) {
            title =
              match[1].trim().slice(0, 80) + (match[1].length > 80 ? "..." : "");
            break;
          }
        }

        // Extract difficulty if mentioned
        const difficultyMatch = message.match(
          /(easy|medium|hard|beginner|intermediate|advanced)/i
        );
        if (difficultyMatch) {
          const diff = difficultyMatch[1].toLowerCase();
          if (diff === "easy" || diff === "beginner") difficulty = "Easy";
          else if (diff === "hard" || diff === "advanced") difficulty = "Hard";
          else difficulty = "Medium";
        }

        // Use the full message as problem description, cleaned up
        problem = message
          .replace(/^(problem|question|challenge|task):\s*/i, "")
          .replace(/\b(easy|medium|hard|beginner|intermediate|advanced)\b/gi, "")
          .trim();

        // Look for constraints
        const constraintMatch = message.match(/constraints?:\s*(.+?)(?:\n\n|$)/i);
        if (constraintMatch) {
          constraints = constraintMatch[1]
            .split(/[•\-\n]/)
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
            .slice(0, 5);
        }

        // If we have a meaningful title and problem, return the question
        if (title && problem.length > 20) {
          return {
            title: title || "Coding Problem",
            difficulty,
            problem: problem.slice(0, 500) + (problem.length > 500 ? "..." : ""),
            constraints: constraints.length > 0 ? constraints : undefined,
          };
        }

        return null;
      } catch (error) {
        console.error("Error parsing question:", error);
        return null;
      }
    };

    const sendChatMessage = async (message: string) => {
      if (!message.trim() || isLoadingChat) return;

      setIsLoadingChat(true);
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, userMessage]);
      setCurrentInput("");

      try {
        // When call is active, inject the solution into the conversation
        if (callStatus === CallStatus.ACTIVE) {
          // Add the solution to the conversation context that the assistant can see
          const solutionPrompt = `USER PROVIDED CODING ANSWER VIA TEXT: "${message}". Store this answer and continue the screening flow. Do not provide evaluation feedback during the live session.`;

          try {
            // Try to send via Vapi's message system
            vapi.send({
              type: "add-message",
              message: {
                role: "user",
                content: solutionPrompt,
              },
            });
          } catch (vapiError) {
            console.log(
              "Direct Vapi send failed, solution logged locally:",
              vapiError
            );
          }

          // Add success message to chat
          const successMessage: ChatMessage = {
            role: "assistant",
            content:
              "✅ Solution submitted. The interviewer will continue with the next step.",
            timestamp: new Date(),
          };
          setChatMessages((prev) => [...prev, successMessage]);

          // Store the solution in the component state for potential later use
          setMessages((prev) => [
            ...prev,
            {
              role: "user",
              content: `[TEXT SOLUTION]: ${message}`,
            },
          ]);
        } else {
          // When call is not active, just acknowledge
          const offlineMessage: ChatMessage = {
            role: "assistant",
            content:
              "✅ Solution noted. Start the live session to continue the screening.",
            timestamp: new Date(),
          };
          setChatMessages((prev) => [...prev, offlineMessage]);
        }
      } catch (error) {
        console.error("Error processing solution:", error);
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: "✅ Solution recorded successfully.",
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoadingChat(false);
      }
    };

    const getDifficultyColor = (difficulty: "Easy" | "Medium" | "Hard") => {
      switch (difficulty) {
        case "Easy":
          return "text-green-600 bg-green-100";
        case "Medium":
          return "text-orange-600 bg-orange-100";
        case "Hard":
          return "text-red-600 bg-red-100";
      }
    };

    const scrollToBottom = () => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
      scrollToBottom();
    }, [chatMessages]);

    // Global error handler to suppress Vapi meeting end errors
    useEffect(() => {
      const originalConsoleError = console.error;

      const filteredConsoleError = (...args: any[]) => {
        const message = args.join(" ");

        // Filter out Vapi meeting end errors
        if (
          message.includes("Meeting ended due to ejection") ||
          message.includes("Meeting has ended") ||
          message.includes("call-end") ||
          message.includes("ejection")
        ) {
          // Don't log these errors as they're expected behavior
          return;
        }

        // Log all other errors normally
        originalConsoleError.apply(console, args);
      };

      // Handle unhandled promise rejections from Vapi
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const message = event.reason?.message || event.reason || "";

        if (
          message.includes("Meeting ended due to ejection") ||
          message.includes("Meeting has ended") ||
          message.includes("call-end") ||
          message.includes("ejection")
        ) {
          // Prevent the error from being logged
          event.preventDefault();
          return;
        }
      };

      console.error = filteredConsoleError;
      window.addEventListener("unhandledrejection", handleUnhandledRejection);

      return () => {
        // Restore original console.error when component unmounts
        console.error = originalConsoleError;
        window.removeEventListener(
          "unhandledrejection",
          handleUnhandledRejection
        );
      };
    }, []);

    useEffect(() => {
      const onCallStart = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vapiCall = (vapi as any)?._call;
        const emittedCallId = vapiCall?.id || vapiCall?.callId;
        const activeJobContextJson = jobContextJsonRef.current;
        const activePracticeContextJson = practiceContextJsonRef.current;

        if (emittedCallId) {
          setTrackedCallId(emittedCallId);
          console.log("Call ID captured from call-start event:", emittedCallId);
        }

        setCallStatus(CallStatus.ACTIVE);
        console.log("Call started - will try to get call ID from Vapi");

        try {
          vapi.send({
            type: "add-message",
            message: {
              role: "system",
              content:
                "Run this as a live screening conversation. Do not provide answer-by-answer feedback, scoring, strengths, weaknesses, or hiring recommendation during the call. Do not mention any fixed interview duration (for example 30 minutes) unless the candidate explicitly asks. Ask one question at a time and wait for candidate response. Only use coding questions when coding skill is explicitly being tested for the role/context. For non-coding roles, avoid coding tasks. If coding is required, give a concrete coding prompt with function signature and constraints, then wait for the candidate's solution.",
            },
          });
        } catch (error) {
          console.warn("Failed to inject global screening instruction", error);
        }

        if (activeJobContextJson && !isJobContextInjectedRef.current) {
          try {
            vapi.send({
              type: "add-message",
              message: {
                role: "system",
                content:
                  `Use this job details JSON to tailor the interview questions, follow-up depth, and evaluation rubric. ` +
                  `Prioritize role requirements and missing skills while interviewing. ` +
                  `Do not ask the candidate to restate role title, company, level, or skills if those fields already exist in JOB_DETAILS_JSON. ` +
                  `Only ask clarifying questions when a critical field is missing or empty.\n\nJOB_DETAILS_JSON:\n${activeJobContextJson}`,
              },
            });
            isJobContextInjectedRef.current = true;
            toast.success("Job context shared with interviewer");
          } catch (error) {
            console.warn("Failed to inject job context at call start", error);
          }
        }

        if (!activeJobContextJson && activePracticeContextJson && !isPracticeContextInjectedRef.current) {
          try {
            vapi.send({
              type: "add-message",
              message: {
                role: "system",
                content:
                  `Use this PRACTICE_PROFILE_JSON to tailor interview style, topic emphasis, and follow-up depth. ` +
                  `Prefer company-specific question framing while keeping responses concise. ` +
                  `Do not ask the candidate to provide or upload any additional JSON file; use the provided JSON only. ` +
                  `Do not ask for role/company/background again when PRACTICE_PROFILE_JSON already contains it.\n\nPRACTICE_PROFILE_JSON:\n${activePracticeContextJson}`,
              },
            });
            isPracticeContextInjectedRef.current = true;
            toast.success("Practice profile shared with interviewer");
          } catch (error) {
            console.warn("Failed to inject practice context at call start", error);
          }
        }
      };

      const onCallEnd = async () => {
        setCallStatus(CallStatus.FINISHED);
        setShowChat(false);
        setChatMessages([]);
        setFullAssistantMessage("");
        isJobContextInjectedRef.current = false;
        isPracticeContextInjectedRef.current = false;

        // Use the stored call ID from when the call started
        let callId = currentCallIdRef.current;

        // If no stored call ID, try to get it from Vapi's internal state
        if (!callId) {
          try {
            // Try to access the call ID from Vapi's internal state
            const vapiCall = (vapi as any)?._call;
            callId = vapiCall?.id || vapiCall?.callId;
            console.log("Retrieved call ID from Vapi internal state:", callId);
          } catch (error) {
            console.warn("Could not retrieve call ID from Vapi state:", error);
          }
        }

        if (!callId) {
          console.log("NO CALL ID AVAILABLE - currentCallId is:", currentCallIdRef.current);
          toast.error("No call ID available for saving");
          setTrackedCallId(null);
          isStartingCallRef.current = false;
          return;
        }

        // Save call log when call ends
        if (callId && userIdRef.current) {
          setIsSavingCall(true);
          toast.info("Saving call data...", { duration: 2000 });

          try {
            // Keep this short to avoid blocking UI while still allowing Vapi artifacts to settle.
            await new Promise((resolve) => setTimeout(resolve, 800));

            if (!saveCallLogRef.current) {
              throw new Error("Call log service is not ready");
            }

            let saveError: unknown = null;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
              try {
                await saveCallLogRef.current(
                  callId,
                  jobContextJsonRef.current || undefined
                );
                saveError = null;
                break;
              } catch (error) {
                saveError = error;
                if (attempt < 3) {
                  await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
                }
              }
            }

            if (saveError) {
              throw saveError;
            }

            console.log(`Call log saved for call: ${callId}`);
            toast.success("Call data saved successfully!");
          } catch (error) {
            console.error("Error saving call log:", error);
            toast.error("Failed to save call data. Please try again.");
          } finally {
            setIsSavingCall(false);
            setTrackedCallId(null); // Clear the call ID after processing
            isStartingCallRef.current = false;
          }
        } else {
          setTrackedCallId(null); // Clear even if not saving
          isStartingCallRef.current = false;
        }
      };

      const onMessage = async (message: Message) => {
        if (message.type === "transcript" && message.transcriptType === "final") {
          const timestamp = Date.now();

          // Process emotion detection for user messages using the hook
          if (message.role === "user" && message.transcript.trim().length > 10) {
            void addEmotionReadingRef
              .current?.(message.transcript, timestamp)
              .catch((error) => {
                console.error("Error processing emotion:", error);
              });
          }

          const newMessage: SavedMessage = {
            role: message.role as "user" | "assistant",
            content: message.transcript,
            timestamp,
            emotionData: currentEmotionRef.current || undefined,
          };

          setMessages((prev) => [...prev, newMessage]);

          // Build full assistant message by concatenating messages
          if (message.role === "assistant") {
            setFullAssistantMessage((prev) => {
              const updated = prev + " " + message.transcript;

              // Check if the combined message contains DSA-related keywords
              const containsCodingTask = isExplicitCodingTaskMessage(updated);

              if (containsCodingTask) {
                setShowChat(true);
                // Try to parse question from the full message
                const questionData = parseQuestionFromMessage(updated);
                if (questionData) {
                  setCurrentQuestion(questionData);
                }
              }

              return updated;
            });
          } else {
            // Reset full message when user speaks
            setFullAssistantMessage("");
          }
        }
      };

      const onSpeechStart = () => setIsSpeaking(true);
      const onSpeechEnd = () => setIsSpeaking(false);

      const onErr = (e: Error | { message?: string; error?: { message?: string } } | string) => {
        const candidate =
          typeof e === "string"
            ? null
            : (e as {
                message?: string;
                type?: string;
                stage?: string;
                error?: { message?: string };
              });

        const message =
          typeof e === "string"
            ? e
            : candidate?.message || candidate?.error?.message || "Unknown Vapi connection error";

        // Filter out unnecessary "Meeting ended due to ejection" errors
        if (message.includes("Meeting ended due to ejection")) {
          // This is a normal call end event, don't log as error
          console.log("Call ended normally");
          return;
        }

        if (isNonFatalVapiAudioError(e, message)) {
          console.warn("Vapi non-fatal audio setup warning:", message, e);
          return;
        }

        const hasTrackedCall = Boolean(currentCallIdRef.current);
        if (isStartingCallRef.current || !hasTrackedCall) {
          isStartingCallRef.current = false;
          setCallStatus(CallStatus.INACTIVE);
        }

        // Only log actual errors that need attention
        console.error("Vapi Error:", message, e);
        toast.error(message);
      };

      vapi.on("call-start", onCallStart);
      vapi.on("call-end", onCallEnd);
      vapi.on("message", onMessage);
      vapi.on("speech-start", onSpeechStart);
      vapi.on("speech-end", onSpeechEnd);
      vapi.on("error", onErr);

      return () => {
        vapi.off("call-start", onCallStart);
        vapi.off("call-end", onCallEnd);
        vapi.off("message", onMessage);
        vapi.off("speech-start", onSpeechStart);
        vapi.off("speech-end", onSpeechEnd);
        vapi.off("error", onErr);
      };
    }, []);

    useEffect(() => {
      if (callStatus === CallStatus.FINISHED && !isSavingCall) {
        // Add a small delay before redirecting to allow cleanup
        const timer = setTimeout(() => {
          router.push("/");
        }, 2000);

        return () => clearTimeout(timer);
      }
    }, [callStatus, isSavingCall, router]);

    const handleResumeUpload = (text: string) => {
      setResumeText(text);

      if (callStatus === CallStatus.ACTIVE) {
        vapi.send({
          type: "add-message",
          message: {
            role: "system",
            content: `Here is the user's resume content. Use this to personalize interview questions and context:\n\n${text}`,
          },
        });
        // Optional: Nudge the assistant to acknowledge
        vapi.send({
          type: "add-message",
          message: {
            role: "user",
            content: "I have uploaded my resume. Please use it to tailor the interview.",
          },
        });
        toast.success("Resume sent to interviewer!");
      } else {
        toast.success("Resume attached! It will be used when the interview starts.");
      }
    };

    const handleCall = async () => {
      if (
        isStartingCallRef.current ||
        callStatus === CallStatus.CONNECTING ||
        callStatus === CallStatus.ACTIVE
      ) {
        return;
      }

      isStartingCallRef.current = true;
      setCallStatus(CallStatus.CONNECTING);

      try {
        // Premium check removed — all authenticated users have full access

        const callData = await vapi.start(ASSISTANT, {
          variableValues: {
            username: userName,
            userId: userId,
            dsaChatEnabled: "true",
            resumeContent: resumeText,
            jobDetailsJson: jobContextJson || "",
            jobContextJson: jobContextJson || "",
            practiceProfileJson: practiceContextJson || "",
            practiceContextJson: practiceContextJson || "",
            jobPrepContextJson: practiceContextJson || "",
          },
        });

        // Try to extract call ID from the response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const callId = callData?.id || (callData as any)?.call?.id;
        if (callId) {
          setTrackedCallId(callId);
          console.log("Call started with ID captured:", callId);
        } else {
          console.warn("No call ID in start response:", callData);
          // Set a timeout to try to get the call ID after the call is established
          setTimeout(() => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const vapiCall = (vapi as any)?._call;
              const fallbackCallId = vapiCall?.id || vapiCall?.callId;
              if (fallbackCallId && !currentCallIdRef.current) {
                setTrackedCallId(fallbackCallId);
                console.log(
                  "Call ID captured via fallback method:",
                  fallbackCallId
                );
              }
            } catch (error) {
              console.warn("Failed to capture call ID via fallback:", error);
            }
          }, 1000);
        }
      } catch (error) {
        console.error("Failed to start call:", error);
        setCallStatus(CallStatus.INACTIVE);
        toast.error("Failed to start call. Please try again.");
      } finally {
        isStartingCallRef.current = false;
      }
    };

    const handleDisconnect = async () => {
      try {
        if (callStatus !== CallStatus.ACTIVE && callStatus !== CallStatus.CONNECTING) {
          return;
        }

        // Gracefully stop the call
        await vapi.stop();
      } catch (error) {
        // Suppress expected disconnection errors
        if (error instanceof Error && !error.message.includes("Meeting ended")) {
          console.log("Disconnect error:", error.message);
        }
      }
    };

    const latestMsg = messages[messages.length - 1]?.content;

    const isInativeOrFinished =
      callStatus === CallStatus.FINISHED || callStatus === CallStatus.INACTIVE;

    return (
      <div className="w-full min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] flex flex-col lg:flex-row bg-background text-foreground relative z-0 lg:overflow-hidden">
        {/* Interview Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-transparent relative overflow-hidden p-6 z-10">
          {/* Cinematic Background Gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(157,125,249,0.1),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(14,14,17,1),transparent_50%)] pointer-events-none"></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
          
          {/* Resume Upload */}
          <div className="absolute top-6 right-6 z-20">
            <ResumeUpload onUploadSuccess={handleResumeUpload} />
          </div>
          
          <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row gap-12 items-center justify-center mb-12">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className={cn("w-32 h-32 rounded-full flex items-center justify-center overflow-hidden transition-all duration-500", callStatus === CallStatus.ACTIVE ? "glass-card shadow-[0_0_50px_rgba(157,125,249,0.3)] border-primary/50" : "bg-white/5 border border-white/10")}>
                    <span className="text-4xl font-black bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent tracking-tighter z-10">AI</span>
                    {isSpeaking && (
                      <div className="absolute inset-0 border border-primary/50 rounded-full animate-pulse shadow-[inset_0_0_30px_rgba(157,125,249,0.4)]"></div>
                    )}
                    {callStatus === CallStatus.ACTIVE && !isSpeaking && (
                      <div className="absolute inset-0 border border-t-primary/50 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDuration: '4s' }}></div>
                    )}
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md text-foreground/90 border border-white/10 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                  ZenAI
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 bg-white/5 backdrop-blur-xl border border-white/10 shadow-inner rounded-full flex items-center justify-center overflow-hidden">
                  <User className="w-16 h-16 text-foreground/50" />
                </div>
                <div className="bg-white/5 backdrop-blur-md text-foreground/90 border border-white/10 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                  {userName || "Candidate"}
                </div>
              </div>
            </div>

            {messages?.length > 0 && (
              <div className="w-full max-w-2xl mb-8 animate-slideUpFade">
                <div className="glass-card rounded-3xl p-8 relative overflow-hidden group hover:border-primary/30 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] "></div>
                  <p className="text-foreground/90 font-medium text-xl text-center leading-relaxed italic relative z-10">
                    "{latestMsg}"
                  </p>
                </div>
              </div>
            )}

            {currentEmotion &&
              showEmotionOverlay &&
              callStatus === CallStatus.ACTIVE && (
                <div className="w-full max-w-2xl mb-6">
                  <div className="glass-card rounded-2xl p-5 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground/90 capitalize tracking-wide">
                            {currentEmotion.emotion}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">
                            Confidence:{" "}
                            {Math.round(currentEmotion.confidence * 100)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-primary animate-pulse" />
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            currentEmotion.intensity === "high" &&
                              "bg-red-500/10 text-red-400 border-red-500/20",
                            currentEmotion.intensity === "medium" &&
                              "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                            currentEmotion.intensity === "low" &&
                              "bg-green-500/10 text-green-400 border-green-500/20"
                          )}
                        >
                          {currentEmotion.intensity}
                        </span>
                        <button
                          onClick={() => setShowEmotionOverlay(false)}
                          className="ml-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Emotion metrics bar */}
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Stress Analysis</span>
                        <span className="text-foreground/80 font-mono">
                          {Math.round(
                            (currentEmotion.additionalMetrics?.stress_level || 0) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                        <div
                          className="bg-gradient-to-r from-green-500/80 via-yellow-500/80 to-red-500/80 h-full transition-all duration-500"
                          style={{
                            width: `${
                              (currentEmotion.additionalMetrics?.stress_level ||
                                0) * 100
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Emotion History Toggle */}
            {emotionHistory.length > 0 && (
              <div className="w-full max-w-2xl mb-4 text-center">
                <button
                  onClick={() => setShowEmotionOverlay(!showEmotionOverlay)}
                  className="text-sm text-primary font-bold hover:underline transition-all flex items-center gap-2 justify-center mx-auto"
                >
                  <Activity className="w-4 h-4" />
                  {showEmotionOverlay ? "Hide" : "Show"} Emotion Detection (
                  {emotionHistory.length} readings)
                </button>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex flex-col justify-center items-center gap-4 mt-6">
              {callStatus !== CallStatus.ACTIVE ? (
                <button
                  className="bg-primary/90 hover:bg-primary text-white shadow-[0_0_30px_rgba(157,125,249,0.3)] hover:shadow-[0_0_40px_rgba(157,125,249,0.5)] border border-primary/50 px-12 py-4 rounded-full font-bold text-lg relative overflow-hidden group transition-all duration-300"
                  onClick={handleCall}
                  disabled={callStatus === CallStatus.CONNECTING}
                >
                  {callStatus === CallStatus.CONNECTING && (
                    <span className="absolute inset-0 bg-white/20 animate-pulse"></span>
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Mic className="w-5 h-5" />
                    {isInativeOrFinished ? "Start Interview" : "Connecting..."}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
                </button>
              ) : (
                <button
                  className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)] px-12 py-4 rounded-full font-bold text-lg transition-all duration-300 flex items-center gap-2"
                  onClick={handleDisconnect}
                >
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  End Interview
                </button>
              )}

              {/* Saving Indicator */}
              {isSavingCall && (
                <div className="flex items-center gap-2 text-black font-bold animate-pulse mt-4 bg-[#f5f5f7]  text-foreground px-4 py-2 rounded-full border border-none">
                  <div className="w-4 h-4 border border-none border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Saving call data...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code Editor Panel — only shown when a coding question is detected */}
        {showChat && (
        <div className="w-full lg:w-[550px] h-[52vh] md:h-[46vh] lg:h-full bg-background/50 backdrop-blur-3xl border-t border-t-white/10 lg:border-t-0 lg:border-l lg:border-l-white/10 flex flex-col z-20 shadow-2xl relative">
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent hidden lg:block"></div>
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center shadow-inner">
                <Code className="w-5 h-5 text-primary" />
              </div>
              <span className="text-foreground font-semibold text-lg tracking-wide">
                Coding Environment
              </span>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            {/* Problem Statement */}
            {currentQuestion && (
              <div className="mb-6 glass-card p-5 rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-foreground/90 font-semibold tracking-wide text-lg">
                    {currentQuestion.title}
                  </h4>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ml-3 flex-shrink-0 border",
                      currentQuestion.difficulty === "Easy" &&
                        "bg-green-500/10 text-green-400 border-green-500/20",
                      currentQuestion.difficulty === "Medium" &&
                        "bg-orange-500/10 text-orange-400 border-orange-500/20",
                      currentQuestion.difficulty === "Hard" &&
                        "bg-red-500/10 text-red-400 border-red-500/20"
                    )}
                  >
                    {currentQuestion.difficulty}
                  </span>
                </div>

                <div className="text-muted-foreground text-sm leading-relaxed mb-4 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 font-light">
                  {currentQuestion.problem}
                </div>

                {currentQuestion.constraints &&
                  currentQuestion.constraints.length > 0 && (
                    <div className="pt-4 border-t border-white/5">
                      <p className="text-foreground/70 text-[10px] uppercase tracking-wider font-semibold mb-2">
                        Rules & Constraints:
                      </p>
                      <ul className="text-muted-foreground text-xs space-y-1.5 font-mono">
                        {currentQuestion.constraints
                          .slice(0, 4)
                          .map((constraint, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5 flex-shrink-0">
                                •
                              </span>
                              <span className="leading-relaxed opacity-80">
                                {constraint}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* Previous Solutions */}
            {chatMessages.length > 0 && (
              <div className="mb-5 bg-black/40 border border-white/5 rounded-2xl p-4 shadow-inner">
                <p className="text-foreground/50 text-[10px] uppercase font-bold tracking-wider mb-3">
                  Chat & Solutions:
                </p>
                <div className="max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 space-y-3 pr-2">
                  {chatMessages.map(
                    (msg, index) =>
                      msg.role === "user" && (
                        <div
                          key={index}
                          className="bg-white/5 border border-white/10 rounded-xl p-3"
                        >
                          <div className="font-mono text-[11px] text-foreground/80 leading-relaxed">
                            {msg.content}
                          </div>
                          <div className="text-muted-foreground text-[9px] mt-2 font-mono flex items-center justify-between opacity-50">
                            <span>// User Input</span>
                            {msg.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      )
                  )}
                </div>
              </div>
            )}

            {/* Code Editor */}
            <div className="flex-1 flex flex-col min-h-[350px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-foreground/80 text-xs font-semibold tracking-wide flex items-center gap-2">
                  <Code className="w-3 h-3 text-primary" /> Integrated Environment
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  <span>Ln {currentInput.split("\n").length}</span>
                  <span className="opacity-50">|</span>
                  <span>Ch {currentInput.length}</span>
                </div>
              </div>

              <div className="flex-1 relative group overflow-hidden rounded-2xl border border-white/10 shadow-[inner_0_0_20px_rgba(0,0,0,0.5)]">
                <textarea
                  ref={textareaRef}
                  onScroll={() => {
                    if (lineNumbersRef.current && textareaRef.current) {
                      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
                    }
                  }}
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      sendChatMessage(currentInput);
                    }
                  }}
                  placeholder={`// Write your algorithm here...
  function solution() {
      // Your code here
      return result;
  }`}
                  disabled={isLoadingChat}
                  className="w-full h-full bg-[#0a0a0c] text-[#e2e2e3] border-none placeholder:text-gray-600 p-5 pl-14 font-mono text-[13px] leading-relaxed resize-none focus:outline-none transition-all"
                  style={{ minHeight: "350px" }}
                  spellCheck="false"
                />

                {/* Line numbers overlay */}
                <div 
                  ref={lineNumbersRef}
                  className="absolute top-0 left-0 w-12 h-full overflow-hidden pt-5 bg-black/40 text-gray-600/80 text-[11px] font-mono select-none text-right pr-3 border-r border-white/10 pointer-events-none"
                >
                  {Array.from(
                    { length: Math.max(30, currentInput.split("\n").length) },
                    (_, i) => (
                      <div
                        key={i}
                        className="h-[21px] flex items-center justify-end"
                      >
                        {i + 1}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Submit Controls */}
              <div className="mt-5 flex flex-col sm:flex-row items-center gap-4">
                <Button
                  onClick={() => sendChatMessage(currentInput)}
                  disabled={
                    isLoadingChat ||
                    !currentInput.trim() ||
                    callStatus !== CallStatus.ACTIVE
                  }
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(157,125,249,0.2)] rounded-xl px-6 py-4 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
                >
                  {isLoadingChat ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Solution
                    </>
                  )}
                </Button>

                <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[10px] border border-white/10">Ctrl+Enter</kbd>
                  {callStatus === CallStatus.ACTIVE
                    ? "to submit solution"
                    : "Start interview to engage code"}
                </div>
              </div>

              {/* Status Messages */}
              {chatMessages.length > 0 && (
                <div className="mt-4 animate-slideUpFade">
                  {chatMessages.slice(-1).map(
                    (msg, index) =>
                      msg.role === "assistant" && (
                        <div
                          key={index}
                          className="flex items-center gap-3 text-sm p-3 bg-green-500/10 border border-green-500/20 rounded-xl"
                        >
                          <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]"></div>
                          <span className="text-green-400 font-medium text-xs">{msg.content}</span>
                        </div>
                      )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {callStatus === CallStatus.ACTIVE && (
          <div className="lg:hidden fixed top-[96px] right-4 z-[80]">
            <button
              className="bg-red-500/90 text-white border border-red-300/30 shadow-[0_0_20px_rgba(239,68,68,0.35)] px-4 py-2 rounded-full font-semibold text-sm transition-all duration-300"
              onClick={handleDisconnect}
            >
              End Interview
            </button>
          </div>
        )}

        <PremiumAccessPopup
          open={showPremiumPopup}
          message={premiumMessage}
          onClose={() => setShowPremiumPopup(false)}
          onActivated={() => {
            toast.success("Premium access enabled");
          }}
        />
      </div>
    );
  }

  export default Agent;
