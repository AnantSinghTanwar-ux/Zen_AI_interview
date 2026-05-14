"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, GraduationCap, ArrowRight, Briefcase, Brain, Target, TrendingUp, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import DotField from "@/components/ui/DotField";
import Link from "next/link";

const HeroBanner = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      id="hero"
      className="relative min-h-[100vh] flex flex-col items-center justify-center pt-28 pb-16 overflow-hidden bg-[#0B0B0F]"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 z-0 pointer-events-auto select-none opacity-50 mix-blend-screen">
        <DotField
          dotRadius={1.5}
          dotSpacing={16}
          bulgeStrength={40}
          glowRadius={120}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={400}
          cursorForce={0.1}
          bulgeOnly={true}
          gradientFrom="#1A1A24"
          gradientTo="#A855F7"
          glowColor="#111118"
        />
      </div>

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#A855F7]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-gradient-to-t from-[#0B0B0F] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto text-center flex flex-col items-center gap-7 px-6 max-w-5xl w-full">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#111118]/80 border border-[#1F1F2B] backdrop-blur-md shadow-sm hover:bg-[#1A1A24] transition-all cursor-default"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FACC15] opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FACC15]" />
          </span>
          <span className="text-[13px] font-medium text-[#EAEAF0]">
            🚀 AI-Powered Interview Platform — Now Live
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-[#EAEAF0] leading-[1.05] text-center max-w-5xl"
        >
          AI Interview{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-[#FACC15]">Practice</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
              className="absolute bottom-1 left-0 right-0 h-3 bg-[#FACC15]/15 rounded-full origin-left -z-0"
            />
          </span>
          <br className="hidden md:block" />
          <span className="text-[#9CA3AF] text-4xl md:text-6xl lg:text-7xl">
            That Gets You{" "}
            <span className="text-[#EAEAF0]">Hired</span>
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.3,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="text-lg md:text-xl text-[#9CA3AF] max-w-2xl font-normal leading-relaxed"
        >
          Describe your target role, take a realistic AI-powered mock interview
          with voice interaction, and receive instant, detailed feedback to ace
          your next opportunity.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.45,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full sm:w-auto"
        >
          <Button
            onClick={() => scrollToSection("pricing")}
            className="btn-primary w-full sm:w-auto text-lg tracking-wide rounded-full px-10 py-5 h-auto shadow-[0_0_30px_rgba(250,204,21,0.2)] hover:shadow-[0_0_50px_rgba(250,204,21,0.35)] transition-all"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Start Interview
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button
            variant="outline"
            onClick={() => scrollToSection("college")}
            className="btn-secondary w-full sm:w-auto text-lg tracking-wide rounded-full px-10 py-5 h-auto group"
          >
            <GraduationCap className="w-5 h-5 mr-2 group-hover:text-primary transition-colors" />
            College Plans
          </Button>
          <Button
            variant="outline"
            onClick={() => scrollToSection("recruiters")}
            className="btn-secondary w-full sm:w-auto text-lg tracking-wide rounded-full px-10 py-5 h-auto group border-[#FACC15]/20 hover:border-[#FACC15]/40"
          >
            <Briefcase className="w-5 h-5 mr-2 group-hover:text-[#FACC15] transition-colors" />
            Recruiters
          </Button>
        </motion.div>

        {/* Why ZenAI - Stats Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 py-8 border-t border-[#1F1F2B] w-full max-w-3xl"
        >
          {[
            { icon: <Brain className="w-5 h-5 text-[#FACC15]" />, value: "AI-Powered", label: "Real-Time Interviews" },
            { icon: <Target className="w-5 h-5 text-[#10B981]" />, value: "95%", label: "Accuracy Rate" },
            { icon: <TrendingUp className="w-5 h-5 text-[#8B5CF6]" />, value: "3x", label: "Faster Prep" },
            { icon: <Shield className="w-5 h-5 text-[#3B82F6]" />, value: "100%", label: "Secure & Private" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
              className="text-center flex flex-col items-center gap-2"
            >
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                {stat.icon}
              </div>
              <div className="text-xl md:text-2xl font-bold text-[#EAEAF0] tracking-tight">
                {stat.value}
              </div>
              <div className="text-xs text-[#9CA3AF] font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroBanner;
