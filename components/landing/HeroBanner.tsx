"use client";

import React, { useEffect, useState } from "react";
import { motion, useAnimate, stagger } from "framer-motion";
import { Sparkles, GraduationCap, ArrowRight, Briefcase, Brain, Target, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// --- Custom Components based on Aceternity/Magic UI concepts ---

const Spotlight = ({ className = "" }: { className?: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, transform: "translate(-72%, -62%) scale(0.5)" }}
      animate={{ opacity: 1, transform: "translate(-50%, -40%) scale(1)" }}
      transition={{ duration: 2, ease: "easeOut", delay: 0.75 }}
      className={`absolute z-0 pointer-events-none w-[100vw] h-[100vh] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.15)_0%,transparent_60%)] ${className}`}
      style={{ left: "50%", top: "40%" }}
    />
  );
};

const BackgroundBeams = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      
      {/* Animated Beams */}
      <motion.div
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
        }}
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(circle at center, transparent 0%, var(--background) 100%), conic-gradient(from 0deg at 50% 50%, transparent 0deg, var(--primary) 90deg, transparent 180deg)",
          backgroundSize: "200% 200%"
        }}
      />
    </div>
  );
};

const TextGenerateEffect = ({ words, className }: { words: string, className?: string }) => {
  const [scope, animate] = useAnimate();
  let wordsArray = words.split(" ");
  
  useEffect(() => {
    animate(
      "span",
      {
        opacity: 1,
        filter: "blur(0px)",
      },
      {
        duration: 0.8,
        delay: stagger(0.15),
      }
    );
  }, [animate]);

  return (
    <motion.div ref={scope as any} className={className}>
      {wordsArray.map((word, idx) => {
        return (
          <motion.span
            key={word + idx}
            className="opacity-0 blur-sm inline-block mr-3"
            initial={{ opacity: 0, filter: "blur(10px)" }}
          >
            {word}
          </motion.span>
        );
      })}
    </motion.div>
  );
};

const RainbowButton = ({ children, onClick, className = "" }: { children: React.ReactNode, onClick: () => void, className?: string }) => {
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full p-[2px] font-medium transition-all duration-300 hover:scale-105 ${className}`}
    >
      <span className="absolute inset-0 animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#D4AF37_0%,#111118_50%,#D4AF37_100%)]"></span>
      <div className="relative flex h-full w-full items-center justify-center gap-2 rounded-full bg-background px-8 text-sm text-foreground transition-all duration-300 group-hover:bg-background/80">
        {children}
      </div>
    </button>
  );
};

// --- Main Hero Component ---

const HeroBanner = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      id="hero"
      className="relative min-h-[100vh] flex flex-col items-center justify-center pt-28 pb-16 overflow-hidden bg-background"
    >
      <Spotlight />
      <BackgroundBeams />

      <div className="relative z-10 mx-auto text-center flex flex-col items-center gap-7 px-6 max-w-5xl w-full">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-card/80 border border-border backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.1)] hover:bg-card transition-all cursor-default"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[13px] font-medium text-foreground">
            The Gold Standard in AI Recruitment
          </span>
        </motion.div>

        {/* Headline using TextGenerateEffect */}
        <div className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground leading-[1.05] text-center max-w-5xl">
          <TextGenerateEffect words="The Future of AI" />
          <div className="relative inline-block mt-2">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-primary relative z-10"
            >
              Interviews is Here.
            </motion.span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 1.2, ease: "easeOut" }}
              className="absolute bottom-1 left-0 right-0 h-3 bg-primary/20 rounded-full origin-left -z-0"
            />
          </div>
        </div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 1.5,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl font-normal leading-relaxed mt-4"
        >
          Experience high-fidelity mock interviews that feel indistinguishable from human recruiters. Master your pitch, perfect your code, and land your dream role.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 1.7,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex flex-col sm:flex-row items-center gap-6 mt-6 w-full sm:w-auto"
        >
          <RainbowButton onClick={() => scrollToSection("pricing")} className="w-full sm:w-auto shadow-[0_0_30px_rgba(212,175,55,0.15)]">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-base">Start Interviewing Now</span>
            <ArrowRight className="w-5 h-5 text-primary" />
          </RainbowButton>
          
          <Button
            variant="outline"
            onClick={() => scrollToSection("college")}
            className="btn-secondary w-full sm:w-auto text-base tracking-wide rounded-full px-8 py-6 h-auto group border-border hover:border-primary/40 bg-card hover:bg-secondary"
          >
            <GraduationCap className="w-5 h-5 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
            Institutional Access
          </Button>
        </motion.div>

        {/* Why ZenAI - Stats Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 2.0 }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 py-8 border-t border-border w-full max-w-4xl"
        >
          {[
            { icon: <Brain className="w-5 h-5 text-primary" />, value: "Cognitive", label: "Real-Time AI Processing" },
            { icon: <Target className="w-5 h-5 text-primary" />, value: "98.5%", label: "Scoring Precision" },
            { icon: <TrendingUp className="w-5 h-5 text-primary" />, value: "3x", label: "Placement Velocity" },
            { icon: <Shield className="w-5 h-5 text-primary" />, value: "Zero", label: "Algorithmic Bias" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 2.2 + i * 0.1 }}
              className="text-center flex flex-col items-center gap-3 group"
            >
              <div className="p-3 rounded-xl bg-card border border-border group-hover:border-primary/40 transition-colors shadow-sm">
                {stat.icon}
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
                  {stat.label}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroBanner;
