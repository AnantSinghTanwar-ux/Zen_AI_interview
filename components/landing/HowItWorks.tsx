"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  UserCircle,
  Mic,
  Brain,
  BarChart3,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    step: "01",
    icon: UserCircle,
    title: "Describe Your Role",
    description:
      "Tell us the position you're targeting — SDE, PM, analyst, or any role. Our AI crafts interview questions tailored to your exact job description and industry.",
    color: "#FACC15",
    bgGlow: "from-[#FACC15]/10",
  },
  {
    step: "02",
    icon: Mic,
    title: "Take the AI Interview",
    description:
      "Engage in a realistic voice-powered mock interview with our AI interviewer. It adapts follow-ups in real-time, simulating pressure and depth of a real interview.",
    color: "#A855F7",
    bgGlow: "from-[#A855F7]/10",
  },
  {
    step: "03",
    icon: Brain,
    title: "AI Analyzes Responses",
    description:
      "Every answer is processed through advanced AI models that evaluate clarity, structure, technical accuracy, and communication effectiveness.",
    color: "#3B82F6",
    bgGlow: "from-[#3B82F6]/10",
  },
  {
    step: "04",
    icon: BarChart3,
    title: "Get Detailed Feedback",
    description:
      "Receive a comprehensive scorecard with category-wise analysis, improvement suggestions, and actionable tips to level up your interview performance.",
    color: "#10B981",
    bgGlow: "from-[#10B981]/10",
  },
];

const HowItWorks = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="relative py-28 bg-[#0B0B0F]">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#1F1F2B] to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#A855F7]/3 rounded-full blur-[200px]" />
      </div>

      <div
        ref={containerRef}
        className="mx-auto px-6 max-w-7xl w-full relative z-10"
      >
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#111118] border border-[#1F1F2B] text-[#9CA3AF] text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7] animate-pulse" />
            HOW IT WORKS
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#EAEAF0] tracking-tight mb-5">
            Ready in{" "}
            <span className="text-[#FACC15]">4 Simple Steps</span>
          </h2>
          <p className="text-lg text-[#9CA3AF] max-w-xl mx-auto font-normal leading-relaxed">
            From describing your dream role to receiving AI-powered feedback —
            get interview-ready in minutes, not months.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
                }
                transition={{
                  duration: 0.6,
                  delay: index * 0.12,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group relative"
              >
                <div className="relative bg-[#111118] border border-[#1F1F2B] rounded-2xl p-8 h-full flex flex-col transition-all duration-500 hover:border-[#2A2A3A] hover:bg-[#151520] hover:-translate-y-2 overflow-hidden">
                  {/* Hover glow */}
                  <div
                    className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl ${step.bgGlow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2`}
                  />

                  {/* Step number */}
                  <span
                    className="text-[80px] font-black absolute top-4 right-6 leading-none opacity-[0.04] select-none pointer-events-none"
                    style={{ color: step.color }}
                  >
                    {step.step}
                  </span>

                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 relative z-10 transition-all duration-300 group-hover:scale-110"
                    style={{
                      backgroundColor: `${step.color}15`,
                      border: `1px solid ${step.color}25`,
                    }}
                  >
                    <Icon
                      className="w-7 h-7"
                      style={{ color: step.color }}
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-[#EAEAF0] mb-3 relative z-10">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#9CA3AF] leading-relaxed relative z-10 flex-1">
                    {step.description}
                  </p>

                  {/* Connector arrow (not on last) */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                      <ArrowRight
                        className="w-5 h-5 text-[#2A2A3A]"
                        strokeWidth={2}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
