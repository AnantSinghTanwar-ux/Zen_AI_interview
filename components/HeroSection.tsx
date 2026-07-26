
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import GetStartedButton from "@/components/GetStartedButton";
import { FaAws, FaGoogle, FaMeta, FaMicrosoft, FaApple } from "react-icons/fa6";

import DotField from "@/components/ui/DotField";

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-12 overflow-hidden bg-[#0B0B0F]">
      
      {/* Subtle DotField background */}
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

      <div className="relative z-10 mx-auto text-center flex flex-col items-center gap-8 px-6 max-w-5xl w-full pointer-events-none">
        
        {/* Top Badge */}
        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-[#111118] border border-[#1F1F2B] backdrop-blur-md mb-2 shadow-sm transition-all pointer-events-auto hover:bg-[#1A1A24]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FACC15] opacity-50"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FACC15]"></span>
          </span>
          <span className="text-[13px] font-medium text-[#EAEAF0]">ZenAI 2.0 is Live</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#EAEAF0] leading-[1.1] text-center max-w-4xl">
          Better ways to prepare.
          <br className="hidden md:block" />
          <span className="text-[#9CA3AF]">
            Smarter ways to get <span className="text-[#FACC15]">hired.</span>
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-[#9CA3AF] max-w-2xl font-normal leading-relaxed">
          ZenAI acts as your high-fidelity mock interviewer. Seamlessly transition from conversational AI to advanced algorithmic environments with real-time feedback.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 w-full sm:w-auto pointer-events-auto">
          <GetStartedButton />
          <Button variant="outline" className="btn-secondary w-full sm:w-auto text-lg tracking-wide rounded-full px-10 py-4 h-auto">
            Read the Docs
          </Button>
        </div>

        {/* Social Proof */}
        <div className="mt-28 py-10 border-t border-[#1F1F2B] w-full flex flex-col items-center pointer-events-auto">
          <p className="text-sm font-medium text-[#9CA3AF] mb-8">Trusted by engineers from top-tier teams</p>
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
             {/* Using simple text placeholders instead of SVGs for minimal SaaS look */}
             <span className="font-bold text-2xl tracking-tighter text-[#EAEAF0]">stripe</span>
             <span className="font-bold text-2xl tracking-widest uppercase text-[#EAEAF0]">Linear</span>
             <span className="font-bold text-2xl tracking-tight text-[#EAEAF0]">vercel</span>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;


