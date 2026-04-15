import InterviewCard from "@/components/InterviewCard";
import { Button } from "@/components/ui/button";
import { dummyInterviews } from "@/constants";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Mic, Code, ArrowRight } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import GetStartedButton from "@/components/GetStartedButton";
import RecentCallData from "@/components/RecentCallData";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PageLayout from "@/components/PageLayout";
import HeroSection from "@/components/HeroSection";
import { FadeUp, FadeIn, StaggerParent, StaggerItem, ScaleCard } from "@/components/motion";

const HomePage = () => {
  return (
    <PageLayout fullWidth={true}>
      <HeroSection />

      {/* Content sections aligned with navbar */}
      <div className="relative z-10 bg-background text-foreground py-20">
        <div className="mx-auto px-6 max-w-7xl w-full">
          {/* CTA Section */}
          <FadeUp delay={0.1}>
            <section className="glass-card p-10 md:p-12 mb-24 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
              <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                <div className="flex-1 space-y-6">
                   <h2 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">Get Interview Ready</h2>
                   <p className="text-xl font-light text-muted-foreground leading-relaxed max-w-xl">
                     Practice on real Interview questions &amp; get instant feedback. 
                     Voice interviews now seamlessly transition into DSA coding environments with real-time text analysis.
                   </p>
                   <StaggerParent className="flex gap-4 pt-2">
                     <StaggerItem>
                       <div className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl font-medium text-sm text-foreground/80 backdrop-blur-md flex items-center gap-2 shadow-inner">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                          AI Feedback
                       </div>
                     </StaggerItem>
                     <StaggerItem>
                       <div className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl font-medium text-sm text-foreground/80 backdrop-blur-md flex items-center gap-2 shadow-inner">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#eca4ff] animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                          Real-time Voice
                       </div>
                     </StaggerItem>
                   </StaggerParent>
                </div>
                <FadeUp delay={0.2} className="flex-1 flex justify-center items-center h-[260px]">
                  <div className="relative w-[300px] h-[300px] flex items-center justify-center">
                     <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
                     <div className="relative z-10 w-48 h-48 rounded-full border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_0_50px_rgba(157,125,249,0.3)] flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 border border-t-primary/50 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
                        <Mic className="w-16 h-16 text-primary/80" strokeWidth={1} />
                     </div>
                  </div>
                </FadeUp>
              </div>
            </section>
          </FadeUp>

          {/* Recent Interview Data */}
          <FadeUp delay={0.05} className="mb-24">
            <RecentCallData />
          </FadeUp>

          <section className="flex flex-col gap-12 mt-12 pb-10">
            <FadeIn>
              <div className="flex items-center gap-6 opacity-80">
                 <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/20"></div>
                 <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-center text-muted-foreground">Premium Capabilities</h2>
                 <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/20"></div>
              </div>
            </FadeIn>
            
            <StaggerParent className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <StaggerItem>
                <ScaleCard className="h-full">
                  <div className="glass-card p-10 h-full flex flex-col relative overflow-hidden cursor-default">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] transition-all rounded-full pointer-events-none"></div>
                      <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mb-8 relative z-10">
                        <Mic className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="font-semibold text-2xl mb-4 text-foreground/90 relative z-10">Voice Interaction</h3>
                      <p className="text-muted-foreground font-light mb-8 text-lg leading-relaxed relative z-10">
                        Practice with our AI interviewer using natural voice conversations. Optimized for deep behavioral and situational assessments.
                      </p>
                      <ul className="space-y-4 mt-auto relative z-10">
                        {['Real-time latent feedback', 'Contextual follow-ups', 'Tone & cadence analysis'].map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-foreground/70 text-sm font-medium">
                             <div className="w-1 h-1 bg-primary rounded-full shadow-[0_0_5px_theme(colors.primary)]"></div>
                             {item}
                          </li>
                        ))}
                      </ul>
                  </div>
                </ScaleCard>
              </StaggerItem>

              <StaggerItem>
                <ScaleCard className="h-full">
                  <div className="glass-card p-10 h-full flex flex-col relative overflow-hidden cursor-default">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#49de50]/10 blur-[50px] transition-all rounded-full pointer-events-none"></div>
                      <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mb-8 relative z-10">
                        <Code className="w-7 h-7 text-[#49de50]" />
                      </div>
                      <h3 className="font-semibold text-2xl mb-4 text-foreground/90 relative z-10">Algorithmic Environments</h3>
                      <p className="text-muted-foreground font-light mb-8 text-lg leading-relaxed relative z-10">
                        Seamlessly transition from voice to an integrated coding environment when technical problems arrive.
                      </p>
                      <ul className="space-y-4 mt-auto relative z-10">
                         {['Syntax-aware terminal', 'Instant time-space feedback', 'Multi-language auto-detect'].map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-foreground/70 text-sm font-medium">
                             <div className="w-1 h-1 bg-[#49de50] rounded-full shadow-[0_0_5px_#49de50]"></div>
                             {item}
                          </li>
                        ))}
                      </ul>
                  </div>
                </ScaleCard>
              </StaggerItem>
            </StaggerParent>
          </section>
        </div>
      </div>
    </PageLayout>
  );
};

export default HomePage;
