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
        className="absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.8) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.8) 2px, transparent 2px)",
          backgroundSize: "40px 40px",
        }}
      ></div>

      {/* Interactive Grid Overlay (Revealed on Hover) */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.8) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.8) 2px, transparent 2px)",
          backgroundSize: "40px 40px",
          opacity: 0.15,
          maskImage: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
        }}
      />

      {/* Hero content aligned with navbar width */}
      <div className="relative z-10 mx-auto text-center flex flex-col items-center gap-6 px-6 max-w-7xl w-full">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-base font-bold">New: DSA Interview Support</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-black uppercase leading-[0.9] text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          Better Ways to{" "}
          <span className="text-primary underline decoration-4 underline-offset-4">
            Prepare
          </span>
          <br />
          Smarter Ways to{" "}
          <span className="text-primary underline decoration-4 underline-offset-4">
            Hired
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-700 max-w-2xl font-medium mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
          ZenAI helps you break into your dream career with AI-led mock
          interviews and career prep tools.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <GetStartedButton />
          <Button className="btn-secondary !h-auto !py-4 !px-8 !text-lg">
            Learn More
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
