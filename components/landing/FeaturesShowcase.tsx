"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion, useInView, useAnimation } from "framer-motion";
import { Mic, Code, BarChart3, Globe, Shield, Terminal, MessageSquare } from "lucide-react";

// --- Micro-Interaction Components ---

const NumberTicker = ({ value, duration = 2 }: { value: number, duration?: number }) => {
  const [count, setCount] = useState(0);
  const nodeRef = useRef(null);
  const isInView = useInView(nodeRef, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = value;
      const incrementTime = (duration * 1000) / end;
      
      const timer = setInterval(() => {
        start += 1;
        setCount(start);
        if (start === end) clearInterval(timer);
      }, incrementTime);
      return () => clearInterval(timer);
    }
  }, [isInView, value, duration]);

  return <span ref={nodeRef}>{count}</span>;
};

const AnimatedBeam = () => {
  return (
    <svg width="100%" height="100%" className="absolute inset-0 z-0 pointer-events-none opacity-40">
      <motion.path
        d="M 0 50 Q 50 10 100 50 T 200 50 T 300 50"
        stroke="var(--primary)"
        strokeWidth="2"
        fill="transparent"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
    </svg>
  );
};

const Marquee = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex overflow-x-hidden border-t border-b border-white/5 py-3">
      <motion.div
        className="flex whitespace-nowrap gap-10 px-4"
        animate={{ x: [0, -1000] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
};

const TerminalEffect = () => {
  const codeLines = [
    "function evaluateCandidate(audio) {",
    "  const transcript = vapi.transcribe(audio);",
    "  const metrics = ai.analyze(transcript);",
    "  return score(metrics);",
    "}"
  ];

  return (
    <div className="bg-background rounded-lg border border-border p-4 font-mono text-xs text-muted-foreground w-full h-full flex flex-col shadow-inner overflow-hidden">
      <div className="flex gap-1.5 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
      </div>
      {codeLines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.2 }}
          viewport={{ once: true }}
          className="my-0.5"
        >
          {line.replace("function", "<span class='text-[#D4AF37]'>function</span>")
               .replace("return", "<span class='text-[#D4AF37]'>return</span>")
               .replace("const", "<span class='text-[#A855F7]'>const</span>")}
        </motion.div>
      ))}
    </div>
  );
};

// --- Main Bento Grid Component ---

const FeaturesShowcase = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  const bentoItems = [
    {
      colSpan: "md:col-span-2",
      rowSpan: "md:row-span-2",
      title: "Real-Time Voice Architecture",
      description: "Our proprietary AI engine processes audio streams with ultra-low latency, enabling natural interruptions, contextual follow-ups, and human-like conversational flow.",
      icon: <Mic className="w-5 h-5 text-primary" />,
      visual: (
        <div className="w-full h-32 mt-6 relative flex items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-black/20">
          <AnimatedBeam />
          <div className="flex gap-2 z-10">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                animate={{ height: ["20%", "80%", "20%"] }}
                transition={{ duration: 0.8 + Math.random(), repeat: Infinity, delay: i * 0.1 }}
                className="w-3 bg-primary rounded-full opacity-80"
              />
            ))}
          </div>
        </div>
      )
    },
    {
      colSpan: "md:col-span-1",
      rowSpan: "md:row-span-1",
      title: "Syntax-Aware Environment",
      description: "Integrated terminal for live DSA solving.",
      icon: <Code className="w-5 h-5 text-primary" />,
      visual: (
        <div className="w-full h-24 mt-4 relative">
          <TerminalEffect />
        </div>
      )
    },
    {
      colSpan: "md:col-span-1",
      rowSpan: "md:row-span-1",
      title: "Precision Scoring",
      description: "Multi-dimensional candidate evaluation.",
      icon: <BarChart3 className="w-5 h-5 text-primary" />,
      visual: (
        <div className="mt-4 flex items-baseline gap-1 text-3xl font-bold text-foreground">
          <NumberTicker value={98} duration={1.5} />
          <span className="text-primary">%</span>
          <span className="text-xs text-muted-foreground ml-2 font-normal uppercase">Accuracy</span>
        </div>
      )
    },
    {
      colSpan: "md:col-span-3",
      rowSpan: "md:row-span-1",
      title: "Enterprise Grade Ecosystem",
      description: "Built for scale, security, and global accessibility. Compliant with strict data residency requirements.",
      icon: <Globe className="w-5 h-5 text-primary" />,
      visual: (
        <div className="mt-6">
          <Marquee>
            <span className="text-muted-foreground font-mono text-sm">SOC2 COMPLIANT • END-TO-END ENCRYPTION • 99.9% UPTIME • GLOBAL EDGE NETWORK • GDPR READY • </span>
          </Marquee>
        </div>
      )
    }
  ];

  return (
    <section className="relative py-28 bg-background">
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div ref={containerRef} className="mx-auto px-6 max-w-6xl w-full relative z-10">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            A Cognitive Engine, Not a Chatbot
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            ZenAI utilizes a component-driven architecture designed to minimize latency and maximize conversational realism.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 auto-rows-[minmax(200px,auto)] gap-4 md:gap-6">
          {bentoItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={isInView ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`group relative flex flex-col p-6 rounded-3xl bg-card border border-border overflow-hidden hover:border-primary/30 transition-all duration-300 shadow-sm ${item.colSpan} ${item.rowSpan}`}
            >
              {/* Subtle hover glow inside card */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-500 pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div className="p-2 rounded-lg bg-background border border-border shadow-sm">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-lg text-foreground tracking-tight">{item.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed relative z-10">
                {item.description}
              </p>
              
              <div className="mt-auto relative z-10">
                {item.visual}
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default FeaturesShowcase;
