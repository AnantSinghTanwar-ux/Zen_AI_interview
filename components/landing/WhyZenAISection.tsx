"use client";

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Mic, Code, Brain, BarChart3, Clock, Shield, MessageSquare, Lightbulb, FileText } from "lucide-react";

const features = [
  {
    icon: <Mic className="w-6 h-6" />,
    title: "Voice-Based AI Interviews",
    description: "Conduct realistic mock interviews with our AI interviewer that speaks, listens, and responds in real time — just like a human interviewer.",
    color: "#FACC15",
  },
  {
    icon: <Code className="w-6 h-6" />,
    title: "Live DSA Problem Solving",
    description: "Practice data structures & algorithms with an AI that guides you through problems, checks your approach, and teaches optimal solutions.",
    color: "#10B981",
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: "Adaptive Difficulty",
    description: "Our AI adjusts question complexity based on your responses. Struggle with system design? It focuses there. Ace behavioral? It pushes harder.",
    color: "#8B5CF6",
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Detailed Performance Scorecard",
    description: "Get a comprehensive breakdown after each session: technical accuracy, communication clarity, problem-solving approach, and areas to improve.",
    color: "#3B82F6",
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: "Resume Fit Insights",
    description: "Upload your resume for a role-fit score, gap analysis, and interview questions tailored to what matters most for that role.",
    color: "#A855F7",
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: "Flexible Session Lengths",
    description: "Choose 10 or 30-minute sessions so you can practice fast or go deep — both mirror real interview timing.",
    color: "#F97316",
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: "Natural Follow-Up Questions",
    description: "Unlike static question banks, our AI asks follow-up questions, challenges your assumptions, and probes deeper — just like a real interviewer.",
    color: "#EC4899",
  },
  {
    icon: <Lightbulb className="w-6 h-6" />,
    title: "Personalized Improvement Plan",
    description: "After each session, receive a tailored roadmap highlighting exactly what to study and practice to improve your weakest areas.",
    color: "#06B6D4",
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Company-Specific Prep",
    description: "Practice for Google, Amazon, Microsoft, Meta, and more. Each company profile adjusts interview style, question patterns, and evaluation criteria.",
    color: "#EF4444",
  },
];

const WhyZenAISection = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  return (
    <section
      id="why-zenai"
      ref={containerRef}
      className="relative py-24 px-6 bg-background overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border mb-6">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground/80">Why Choose ZenAI</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Everything You Need to{" "}
            <span className="text-primary">Crack Interviews</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built by engineers who&apos;ve been through the grind. ZenAI gives you the closest thing to a real interview — without the rejection anxiety.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.06 }}
              className="group relative p-6 rounded-2xl bg-card border border-border hover:border-primary/20 transition-all duration-300 hover:translate-y-[-2px] shadow-sm"
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 border border-border bg-background shadow-sm"
              >
                {React.cloneElement(feature.icon as React.ReactElement, { className: "w-6 h-6 text-primary" })}
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyZenAISection;
