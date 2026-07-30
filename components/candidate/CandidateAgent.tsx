"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getVapiInstance } from "@/services/vapi/vapi.sdk";
import { Button } from "@/components/ui/button";
import { Mic, Activity, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const ASSISTANT = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "fb5af732-a8a6-4213-9318-37a3d92d5d93";

export interface CandidateContext {
  candidateId: string;
  name: string;
  resumeText: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  requiredSkills: string[];
}

export default function CandidateAgent({ context }: { context: CandidateContext }) {
  const vapi = useMemo(() => getVapiInstance("student"), []);
  const [callStatus, setCallStatus] = useState<"INACTIVE" | "CONNECTING" | "ACTIVE" | "FINISHED">("INACTIVE");
  const [isScoring, setIsScoring] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const currentCallIdRef = useRef<string | null>(null);
  
  // Track messages for transcript building
  const messagesRef = useRef<any[]>([]);
  const transcriptRef = useRef("");

  useEffect(() => {
    if (!vapi) return;

    const onCallStart = () => {
      setCallStatus("ACTIVE");
      messagesRef.current = [];
      transcriptRef.current = "";
      setTranscript("");
    };

    const onCallEnd = async () => {
      // If the call drops before any real conversation happens, allow them to retry
      if (transcriptRef.current.trim().length < 10) {
        setCallStatus("INACTIVE");
        toast.error("The interview disconnected before starting. Please try again.");
        return;
      }

      setCallStatus("FINISHED");
      await submitScore();
    };

    const onMessage = (message: any) => {
      messagesRef.current.push(message);
      
      // If we got a final transcript, append to our running text
      if (message.type === "transcript" && message.transcriptType === "final") {
        transcriptRef.current += `\nCandidate: ${message.transcript}`;
        setTranscript(transcriptRef.current);
      } else if (message.role === "assistant" && message.message) {
        transcriptRef.current += `\nInterviewer: ${message.message}`;
        setTranscript(transcriptRef.current);
      }
    };

    const onError = (e: any) => {
      console.error("[Vapi Error]", e);
      if (callStatus === "CONNECTING") {
        setCallStatus("INACTIVE");
        toast.error("Failed to start the interview. Please try again or check microphone permissions.");
      }
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("error", onError);
      
      if (callStatus === "ACTIVE" || callStatus === "CONNECTING") {
        vapi.stop();
      }
    };
  }, [vapi, callStatus]);

  const submitScore = async () => {
    setIsScoring(true);
    try {
      const response = await fetch("/api/v2/screening/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: context.candidateId,
          jobId: context.jobId,
          transcript: transcriptRef.current,
          callId: currentCallIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      setIsCompleted(true);
      toast.success("Interview completed and scored successfully!");
    } catch (err) {
      console.error("Scoring failed:", err);
      toast.error("Failed to save interview score. Please contact support.");
    } finally {
      setIsScoring(false);
    }
  };

  const startCall = async () => {
    if (!vapi) return;
    setCallStatus("CONNECTING");

    try {
      // Build dynamic context for the AI
      const jobContextJson = JSON.stringify({
        title: context.jobTitle,
        company: context.companyName,
        description: context.jobDescription,
        skills: context.requiredSkills,
      });

      const callData = await vapi.start(ASSISTANT, {
        variableValues: {
          username: context.name,
          userId: context.candidateId,
          dsaChatEnabled: "false",
          resumeContent: context.resumeText.slice(0, 5000), // Vapi var limit
          jobDetailsJson: jobContextJson.slice(0, 5000),
          jobContextJson: jobContextJson.slice(0, 5000),
          practiceProfileJson: "",
          practiceContextJson: "",
          jobPrepContextJson: "",
          role: "Technical Recruiter",
        },
      });

      // Try to extract call ID
      const callId = callData?.id || (callData as any)?.call?.id;
      if (callId) {
        currentCallIdRef.current = callId;
      }
    } catch (err) {
      console.error("[CandidateAgent] Failed to start:", err);
      setCallStatus("INACTIVE");
      toast.error("Microphone access is required to start the interview.");
    }
  };

  const stopCall = () => {
    if (!vapi) return;
    vapi.stop();
  };

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-border shadow-lg space-y-6 text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold">Interview Complete!</h2>
        <p className="text-muted-foreground text-lg max-w-md">
          Thank you for completing the AI interview for {context.jobTitle} at {context.companyName}.
          The recruiting team has received your results and will be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-card rounded-2xl border border-border shadow-lg space-y-8 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">AI Interview</h2>
        <p className="text-muted-foreground">
          {context.jobTitle} at {context.companyName}
        </p>
      </div>

      <div className="p-6 bg-muted/50 rounded-xl border border-border">
        <h3 className="font-semibold text-lg mb-4">Before you begin:</h3>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
            Find a quiet place with a stable internet connection.
          </li>
          <li className="flex items-start gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
            Ensure your microphone is connected and working.
          </li>
          <li className="flex items-start gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
            The AI recruiter will introduce itself and ask questions based on your resume and the job requirements.
          </li>
          <li className="flex items-start gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
            The interview typically takes 10-15 minutes.
          </li>
        </ul>
      </div>

      <div className="flex flex-col items-center pt-6 pb-2 space-y-6">
        {callStatus === "INACTIVE" && (
          <Button onClick={startCall} size="lg" className="w-full sm:w-auto text-lg px-12 py-6 rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all">
            <Mic className="w-5 h-5 mr-2" />
            Start Interview
          </Button>
        )}

        {callStatus === "CONNECTING" && (
          <Button disabled size="lg" variant="secondary" className="w-full sm:w-auto text-lg px-12 py-6 rounded-full">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Connecting to AI...
          </Button>
        )}

        {callStatus === "ACTIVE" && (
          <div className="flex flex-col items-center space-y-6">
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
              <Activity className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h4 className="font-semibold text-lg text-primary">Interview in Progress</h4>
              <p className="text-sm text-muted-foreground">Speak clearly into your microphone.</p>
            </div>
            <Button onClick={stopCall} variant="destructive" size="lg" className="px-12 py-6 rounded-full">
              End Interview
            </Button>
          </div>
        )}

        {callStatus === "FINISHED" && (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="font-medium text-lg text-muted-foreground">
              {isScoring ? "Evaluating your performance..." : "Finalizing interview..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
