  "use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import GetStartedButton from "@/components/GetStartedButton";

const HeroSection = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLElement>(null);
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-[85vh] flex items-center justify-center pt-24 pb-12 overflow-hidden border-b border-none"
    >
      {/* Simple Grid Pattern Background (Static Base) */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      ></div>
      
      {/* Cinematic Glowing Orbs - reduced opacity for softer look */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen opacity-40"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#eca4ff]/5 rounded-full blur-[150px] pointer-events-none translate-x-1/4 translate-y-1/4 mix-blend-screen opacity-30"></div>

      {/* Interactive Grid Overlay (Revealed on Hover) */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(157,125,249,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(157,125,249,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.8,
          maskImage: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
        }}
      />

      {/* Hero content aligned with navbar width */}
      <div className="relative z-10 mx-auto text-center flex flex-col items-center gap-8 px-6 max-w-7xl w-full">
        <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-slideUpFade shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/70 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </span>
          <span className="text-xs sm:text-sm font-medium tracking-wide text-foreground/80 uppercase pr-1">New: DSA Interview Support</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-foreground leading-[1.1] text-center animate-slideUpFade delay-100 max-w-5xl">
          Better ways to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary/90 to-[#b59af8]">
            prepare.
          </span>
          <br />
          Smarter ways to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary/90 to-[#b59af8]">
            get hired.
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl font-light mt-6 animate-slideUpFade delay-200 leading-relaxed">
          ZenAI helps you break into your dream career with professional, AI-led mock
          interviews and deeply analytical career prep tools.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-6 mt-12 animate-slideUpFade delay-300">
          <GetStartedButton />
          <Button className="bg-transparent hover:bg-white/5 text-foreground border border-white/10 hover:border-white/20 h-auto py-4 px-10 rounded-full font-semibold text-lg transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]">
            Learn More
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
