"use client";

import React, { useEffect, useState } from "react";
import { motion, useAnimate, stagger } from "framer-motion";
import { Sparkles, GraduationCap, ArrowRight, Briefcase, Brain, Target, TrendingUp, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// --- Custom Components based on Aceternity/Magic UI concepts ---

const StarryBackground = ({ className = "" }: { className?: string }) => {
  const [stars, setStars] = useState<{id: number, top: string, left: string, size: number, delay: number, duration: number}[]>([]);

  useEffect(() => {
    setStars(Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    })));
  }, []);

  return (
    <div className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${className}`}>
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-[#DAA520]"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            boxShadow: `0 0 ${star.size * 2}px #DAA520`,
          }}
          animate={{ opacity: [0.1, 0.7, 0.1] }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        />
      ))}
      
      {/* Subtle Shooting Star */}
      <motion.div
        className="absolute top-0 left-[10%] w-[1px] h-32 bg-gradient-to-b from-transparent via-[#FFD89B] to-transparent shadow-[0_0_8px_#DAA520]"
        style={{ rotate: "-45deg", transformOrigin: "top left" }}
        initial={{ y: -200, x: -200, opacity: 0 }}
        animate={{ y: 1200, x: 1200, opacity: [0, 1, 0] }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          repeatDelay: 6,
          ease: "linear",
        }}
      />
    </div>
  );
};

const BackgroundBeams = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
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

const NumberTicker = ({ value, duration = 2 }: { value: number, duration?: number }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) return;
    const incrementTime = (duration * 1000) / end;
    const timer = setInterval(() => {
      start += Math.ceil(end / 40);
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, incrementTime);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
};

const LShapedBorders = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative inline-block p-4 md:p-8">
      {/* Top Left */}
      <motion.div 
        animate={{ opacity: [0.15, 0.5, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-0 w-4 h-4 md:w-8 md:h-8 border-t border-l border-[#DAA520]/60"
      />
      {/* Top Right */}
      <motion.div 
        animate={{ opacity: [0.15, 0.5, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-0 right-0 w-4 h-4 md:w-8 md:h-8 border-t border-r border-[#DAA520]/60"
      />
      {/* Bottom Left */}
      <motion.div 
        animate={{ opacity: [0.15, 0.5, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-0 left-0 w-4 h-4 md:w-8 md:h-8 border-b border-l border-[#DAA520]/60"
      />
      {/* Bottom Right */}
      <motion.div 
        animate={{ opacity: [0.15, 0.5, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute bottom-0 right-0 w-4 h-4 md:w-8 md:h-8 border-b border-r border-[#DAA520]/60"
      />
      {children}
    </div>
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
      className="relative min-h-[100vh] flex flex-col items-center justify-center pt-28 pb-16 overflow-hidden bg-[#0D0D0D]"
    >
      <StarryBackground />
      <BackgroundBeams />

      <div className="relative z-10 mx-auto text-center flex flex-col items-center gap-7 px-6 max-w-5xl w-full mt-10">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#111118]/80 border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(218,165,32,0.1)] hover:bg-[#111118] transition-all cursor-default"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DAA520] opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#DAA520]" />
          </span>
          <span className="text-[13px] font-medium text-[#F5F5F5]">
            The Gold Standard in AI Recruitment
          </span>
        </motion.div>

        {/* Headline using TextGenerateEffect & LShapedBorders */}
        <LShapedBorders>
          <div className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] text-center max-w-4xl mx-auto">
            <div className="text-[#F5F5F5]">
              <TextGenerateEffect words="Better ways to prepare." />
            </div>
            <div className="relative inline-block mt-2">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="text-transparent bg-clip-text bg-gradient-to-r from-[#DAA520] to-[#FFD89B] relative z-10"
              >
                Smarter ways to get hired.
              </motion.span>
            </div>
          </div>
        </LShapedBorders>

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

        {/* Why ZenAI - Stats Row with Number Tickers */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 2.0 }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 py-8 border-t border-border w-full max-w-4xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 2.2 }}
            className="text-center flex flex-col items-center gap-3 group"
          >
            <div className="p-3 rounded-xl bg-card border border-border group-hover:border-primary/40 transition-colors shadow-sm">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight flex items-center justify-center gap-1">
                <NumberTicker value={10000} duration={1.5} />+
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Interviews Taken
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 2.3 }}
            className="text-center flex flex-col items-center gap-3 group"
          >
            <div className="p-3 rounded-xl bg-card border border-border group-hover:border-primary/40 transition-colors shadow-sm">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight flex items-center justify-center gap-1">
                <NumberTicker value={95} duration={2} />%
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Satisfaction Rate
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 2.4 }}
            className="text-center flex flex-col items-center gap-3 group"
          >
            <div className="p-3 rounded-xl bg-card border border-border group-hover:border-primary/40 transition-colors shadow-sm">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight flex items-center justify-center gap-1">
                <NumberTicker value={3} duration={1.5} />x
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Placement Velocity
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 2.5 }}
            className="text-center flex flex-col items-center gap-3 group"
          >
            <div className="p-3 rounded-xl bg-card border border-border group-hover:border-primary/40 transition-colors shadow-sm">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight flex items-center justify-center gap-1">
                <NumberTicker value={0} duration={1} />
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Algorithmic Bias
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroBanner;
