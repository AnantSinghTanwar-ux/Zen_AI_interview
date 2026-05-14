"use client";

import React, { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { UserCircle, Mic, Brain, BarChart3 } from "lucide-react";

// --- Custom Micro-Interactions for Bento Grid ---

const SpotlightEffect = ({ children }: { children: React.ReactNode }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  return (
    <div
      className="relative w-full h-full overflow-hidden group"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(212,175,55,0.15), transparent 80%)`,
        }}
      />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
};

const ConnectionBeam = () => {
  return (
    <svg width="100%" height="100%" className="absolute inset-0 z-0 pointer-events-none opacity-50">
      <motion.path
        d="M 20 80 Q 50 10 100 50 T 200 50 T 300 50"
        stroke="var(--primary)"
        strokeWidth="3"
        fill="transparent"
        strokeDasharray="5 5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      <motion.circle
        cx="20" cy="80" r="5" fill="var(--primary)"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.circle
        cx="300" cy="50" r="5" fill="var(--primary)"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
      />
    </svg>
  );
};

const RadarSkeleton = () => {
  return (
    <div className="w-full h-full flex items-center justify-center relative p-4">
      <div className="w-24 h-24 rounded-full border border-primary/20 relative">
        <div className="absolute inset-2 rounded-full border border-primary/40" />
        <div className="absolute inset-6 rounded-full border border-primary/60" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-primary/20" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-primary/20" />
        {/* Animated radar sweep */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-r-2 border-t-2 border-primary origin-center opacity-50"
          style={{ clipPath: "polygon(50% 50%, 100% 0, 100% 50%)" }}
        />
        {/* Data points */}
        <div className="absolute top-4 left-16 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(212,175,55,1)]" />
        <div className="absolute bottom-6 left-6 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(212,175,55,1)]" />
        <div className="absolute top-10 right-4 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(212,175,55,1)]" />
      </div>
    </div>
  );
};

const HowItWorks = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  const steps = [
    {
      colSpan: "md:col-span-1",
      icon: <UserCircle className="w-8 h-8 group-hover:text-primary transition-colors" />,
      title: "1. Describe Your Role",
      description: "Define the position, seniority, and specific skills you want to be tested on. The AI configures itself instantly.",
      visual: (
        <div className="mt-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center group-hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all duration-500 relative">
            <UserCircle className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors z-10" />
            <div className="absolute inset-0 rounded-full bg-primary/0 group-hover:bg-primary/20 transition-colors duration-500 animate-pulse" />
          </div>
        </div>
      )
    },
    {
      colSpan: "md:col-span-2",
      icon: <Mic className="w-8 h-8 group-hover:text-primary transition-colors" />,
      title: "2. Take the AI Interview",
      description: "Engage in a realistic voice-powered mock interview. Our agent adapts follow-ups in real-time, simulating the pressure of a real technical or behavioral screen.",
      visual: (
        <div className="w-full h-32 mt-6 relative flex items-center justify-between px-8 rounded-xl bg-background/50 border border-white/5 overflow-hidden">
          <ConnectionBeam />
          <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center z-10 shadow-lg">
            <UserCircle className="w-6 h-6 text-foreground" />
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/50 flex items-center justify-center z-10 shadow-[0_0_20px_rgba(212,175,55,0.3)]">
            <Brain className="w-6 h-6 text-primary" />
          </div>
        </div>
      )
    },
    {
      colSpan: "md:col-span-2",
      icon: <Brain className="w-8 h-8 group-hover:text-primary transition-colors" />,
      title: "3. AI Analyzes Responses",
      description: "Hover to reveal hidden insights. Every answer is processed through advanced neural models evaluating clarity, technical accuracy, and cognitive structure.",
      visual: (
        <div className="w-full h-32 mt-6 relative rounded-xl border border-white/5 bg-background overflow-hidden group/visual">
          {/* Scanning Line Animation */}
          <div className="absolute left-0 top-0 w-full h-1 bg-primary/40 shadow-[0_0_15px_rgba(212,175,55,0.8)] animate-[scan_3s_ease-in-out_infinite]" />
          
          <SpotlightEffect>
            <div className="p-4 w-full h-full flex flex-col justify-center opacity-60 group-hover/visual:opacity-100 transition-opacity">
               <div className="h-2 bg-primary/30 rounded-full mb-3 overflow-hidden">
                 <div className="h-full bg-primary/60 w-3/4 animate-[shimmer_2s_infinite]" />
               </div>
               <div className="h-2 bg-primary/30 rounded-full mb-3 overflow-hidden">
                 <div className="h-full bg-primary/60 w-1/2 animate-[shimmer_2s_infinite_0.5s]" />
               </div>
               <div className="h-2 bg-primary/30 rounded-full overflow-hidden">
                 <div className="h-full bg-primary/60 w-5/6 animate-[shimmer_2s_infinite_1s]" />
               </div>
            </div>
          </SpotlightEffect>
        </div>
      )
    },
    {
      colSpan: "md:col-span-1",
      icon: <BarChart3 className="w-8 h-8 group-hover:text-primary transition-colors" />,
      title: "4. Get Detailed Feedback",
      description: "Receive a comprehensive scorecard with category-wise analysis and actionable tips to level up.",
      visual: (
        <div className="w-full h-32 mt-6 relative rounded-xl border border-white/5 bg-background overflow-hidden flex items-center justify-center">
          <RadarSkeleton />
        </div>
      )
    }
  ];

  return (
    <section id="how-it-works" className="relative py-28 bg-background">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div ref={containerRef} className="mx-auto px-6 max-w-6xl w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border text-muted-foreground text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            HOW IT WORKS
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-5">
            Ready in <span className="text-primary">4 Simple Steps</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-normal leading-relaxed">
            From describing your dream role to receiving AI-powered feedback — get interview-ready in minutes.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className={`group relative flex flex-col p-8 rounded-3xl bg-card border border-border transition-all duration-500 hover:border-primary/40 hover:-translate-y-1 shadow-sm overflow-hidden ${step.colSpan}`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <h3 className="text-xl font-bold text-foreground mb-3 relative z-10 group-hover:text-primary transition-colors">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed relative z-10">
                {step.description}
              </p>
              
              <div className="mt-auto relative z-10 w-full">
                {step.visual}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
