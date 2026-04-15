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
      className="relative min-h-screen flex items-center justify-center pt-24 pb-12 overflow-hidden"
    >
      {/* Cinematic Background Glows */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse"
          style={{ transition: 'transform 0.5s ease-out' }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px] animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Subtle Interactive Grid */}
      <div
        className="absolute inset-0 z-0 opacity-[0.05]"
        style={{
          backgroundImage: "linear-gradient(rgba(186,158,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(186,158,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
        }}
      />

      {/* Hero Content */}
      <div className="relative z-10 mx-auto text-center flex flex-col items-center gap-6 px-6 max-w-7xl w-full">
        <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
          <span className="text-sm font-bold tracking-widest uppercase text-primary">ZenAI Intelligence Platform</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-display font-black tracking-tighter text-white leading-[0.85] text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          EVOLVE YOUR<br />
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">CAREER PATH</span>
        </h1>

        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl font-light mt-6 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
          The elite AI-led simulation platform for technical dominance. 
          Master high-stakes interviews with real-time DSA neural analysis.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <GetStartedButton />
          <Button variant="outline" className="h-auto py-5 px-10 text-lg rounded-xl border-white/10 bg-white/5 backdrop-blur-lg hover:bg-white/10 transition-all">
            Explore System
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
