
"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import GetStartedButton from "@/components/GetStartedButton";
import { FaAws, FaGoogle, FaMeta, FaMicrosoft, FaApple } from "react-icons/fa6"; // if available, or just SVGs. I will use raw SVGs to be safe

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-12 overflow-hidden border-b border-transparent">
      
      {/* Central fading radial gradient for depth */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[800px] bg-gradient-to-tr from-[#a3e635]/10 via-[#a855f7]/5 to-transparent rounded-full blur-[100px] opacity-40"></div>
      </div>

      <div className="relative z-10 mx-auto text-center flex flex-col items-center gap-6 px-6 max-w-6xl w-full">
        
        {/* Top Badge */}
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md mb-4 shadow-sm transition-all hover:bg-white/[0.05]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
          </span>
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">ZenAI 2.0 is Live</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tighter text-foreground leading-[1.05] text-center max-w-5xl">
          <span className="mesh-text relative">
            <span className="absolute inset-0 blur-lg opacity-30 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-lime-400">BETTER WAYS TO PREPARE.</span>
            BETTER WAYS TO PREPARE.
          </span>
          <br />
          <span className="text-white/90">
            SMARTER WAYS TO GET HIRED.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl font-normal mt-2 leading-relaxed">
          ZenAI acts as your high-fidelity mock interviewer. Seamlessly transition from conversational AI to advanced algorithmic environments with real-time latent feedback.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto">
          <GetStartedButton />
          <Button variant="outline" className="btn-secondary w-full sm:w-auto h-auto py-4 px-10 rounded-full font-semibold text-lg border-white/10 text-white hover:bg-white/5 transition-all">
            Read the Docs
          </Button>
        </div>

        {/* Social Proof */}
        <div className="mt-20 pt-8 border-t border-white/[0.05] w-full max-w-3xl flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#888888] mb-6">Prepared candidates recruited by</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-14 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
             {/* Simple inline SVGs for tech logos */}
             <svg width="100" height="32" viewBox="0 0 100 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M43.9 16.7c0-4.6-3.4-8-8.2-8S27.5 12.1 27.5 16.7c0 4.6 3.4 8.1 8.2 8.1s8.2-3.5 8.2-8.1zm-13.3 0c0-3 1.9-5.1 5.1-5.1s5.1 2 5.1 5.1c0 3-1.9 5.1-5.1 5.1s-5.1-2.1-5.1-5.1zm43.3-8.8v16.1h-2.9v-2.1h-.1c-.8 1.4-2.5 2.5-4.8 2.5-4.2 0-7.3-3.6-7.3-8 0-4.5 3.1-8 7.3-8 2.3 0 4 1.1 4.8 2.4h.1V7.9h3.1zm-3.1 9c0-3-1.8-5.1-4.8-5.1-3 0-4.9 2.1-4.9 5.1 0 3 1.8 5.1 4.9 5.1 3.1 0 4.8-2.1 4.8-5.1zm19.2 6.5c-3 0-5-2-5.1-5h13.2v-1c0-4.6-3.1-7.8-7.7-7.8-4.6 0-8 3.5-8 8.1 0 4.7 3.4 8.1 8.2 8.1 3.8 0 6.6-2.1 7.6-5.5h-3.1c-.8 1.8-2.5 2.6-5.1 2.6zM82 14c0 1.9 1.4 5.1 4.6 5.1v1.9c-2.4 0-4.6-1.5-4.6-4.9V14zm-64.6-5c-4.4 0-8.1 3.2-8.1 8 0 4.7 3.5 8.1 8.2 8.1 2.8 0 4.8-1.1 6.1-3l-2.4-1.8c-.9 1.3-2.1 2-3.6 2-2.5 0-4.3-1.6-4.8-3.9h11.2v-.8c.1-4.7-3-8.6-6.6-8.6z" /></svg>
             <svg width="24" height="28" viewBox="0 0 24 28" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M23.9 11.2c-.3-2.2-1.7-4.1-3.6-5.1.7-2.1 0-4.4-1.5-5.9-1.5-1.5-3.8-2.2-5.9-1.5C11.9.8 10 2.2 7.8 2.5c-2.2.3-4.5 1.5-5.9 3.2-1.4 1.7-1.8 4-1.2 6.1C0 14-.3 16.3 1.1 18c1.4 1.7 3.7 2.4 5.8 1.8 1 .8 2.3 1.4 3.6 1.4 1.4 0 2.8-.5 3.9-1.5 1.9.4 4 .2 5.6-1.1 1.6-1.3 2.5-3.3 2.5-5.4 0-2.2-.6-3.9-1.4-5z" opacity="0.8"/></svg>
             <span className="font-bold text-xl tracking-tighter">stripe</span>
             <span className="font-bold text-xl tracking-widest uppercase">Linear</span>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;


