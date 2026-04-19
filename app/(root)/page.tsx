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
import { getCurrentUser } from "@/lib/actions/auth.actions";

const HomePage = async () => {
  const user = await getCurrentUser();

  return (
    <PageLayout fullWidth={true}>
      <HeroSection />

      {/* Content sections aligned with navbar */}
      <div className="relative z-10 bg-background text-foreground py-20">
        <div className="mx-auto px-6 max-w-7xl w-full">
          {/* CTA Section */}
          <FadeUp delay={0.1}>
            <section className="bg-[#111118] border border-[#1F1F2B] p-10 md:p-12 mb-24 rounded-2xl overflow-hidden relative shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              {/* Subtle accent highlight behind CTA */}
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-[#A855F7]/10 to-transparent blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none rounded-full"></div>
              
              <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                <div className="flex-1 space-y-6">
                   <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#EAEAF0]">Get Interview Ready</h2>
                   <p className="text-lg font-normal text-[#9CA3AF] leading-relaxed max-w-xl">
                     Practice on real Interview questions &amp; get instant feedback. 
                     Voice interviews now seamlessly transition into DSA coding environments with real-time text analysis.
                   </p>
                   <StaggerParent className="flex flex-wrap gap-4 pt-2">
                     <StaggerItem>
                       <div className="bg-[#1A1A24] border border-[#2A2A3A] px-5 py-2.5 rounded-full font-medium text-sm text-[#EAEAF0] flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FACC15] animate-pulse"></div>
                          AI Feedback
                       </div>
                     </StaggerItem>
                     <StaggerItem>
                       <div className="bg-[#1A1A24] border border-[#2A2A3A] px-5 py-2.5 rounded-full font-medium text-sm text-[#EAEAF0] flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#A855F7] animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                          Real-time Voice
                       </div>
                     </StaggerItem>
                   </StaggerParent>
                </div>
                <FadeUp delay={0.2} className="flex-1 flex justify-center items-center h-[260px]">
                  <div className="relative w-[300px] h-[300px] flex items-center justify-center">
                     <div className="absolute inset-0 bg-[#A855F7]/5 rounded-full blur-2xl transition-opacity duration-700"></div>
                     <div className="relative z-10 w-48 h-48 rounded-full border border-[#2A2A3A] bg-[#0B0B0F]/80 backdrop-blur-xl shadow-inner flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 border border-t-[#FACC15]/40 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDuration: '6s' }}></div>
                        <Mic className="w-12 h-12 text-[#9CA3AF]" strokeWidth={1.5} />
                     </div>
                  </div>
                </FadeUp>
              </div>
            </section>
          </FadeUp>

          {/* Recent Interview Data */}
          <FadeUp delay={0.05} className="mb-24">
            <RecentCallData userId={user?.id ?? null} />
          </FadeUp>

          <section className="flex flex-col gap-12 mt-12 pb-10">
            <FadeIn>
              <div className="flex items-center gap-6 opacity-80">
                 <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#1F1F2B]"></div>
                 <h2 className="text-xs font-semibold tracking-[0.1em] uppercase text-center text-[#9CA3AF]">Premium Capabilities</h2>
                 <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#1F1F2B]"></div>
              </div>
            </FadeIn>
            
            <StaggerParent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StaggerItem>
                <ScaleCard className="h-full">
                  <div className="bg-[#111118] border border-[#1F1F2B] p-10 rounded-2xl h-full flex flex-col relative overflow-hidden cursor-default transition-all duration-300 hover:border-[#2A2A3A] hover:bg-[#151520] hover:-translate-y-1 shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
                      <div className="w-12 h-12 bg-[#1A1A24] border border-[#2A2A3A] rounded-xl flex items-center justify-center mb-8 relative z-10 transition-colors">
                        <Mic className="w-6 h-6 text-[#EAEAF0]" strokeWidth={1.5} />
                      </div>
                      <h3 className="font-semibold text-2xl mb-4 text-[#EAEAF0] relative z-10">Voice Interaction</h3>
                      <p className="text-[#9CA3AF] font-normal mb-8 text-base leading-relaxed relative z-10">
                        Practice with our AI interviewer using natural voice conversations. Optimized for deep behavioral and situational assessments.
                      </p>
                      <ul className="space-y-4 mt-auto relative z-10 border-t border-[#1F1F2B] pt-6">
                        {['Real-time latent feedback', 'Contextual follow-ups', 'Tone & cadence analysis'].map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-[#EAEAF0] text-sm font-medium">
                             <div className="w-1.5 h-1.5 bg-[#A855F7] rounded-full"></div>
                             {item}
                          </li>
                        ))}
                      </ul>
                  </div>
                </ScaleCard>
              </StaggerItem>

              <StaggerItem>
                <ScaleCard className="h-full">
                  <div className="bg-[#111118] border border-[#1F1F2B] p-10 rounded-2xl h-full flex flex-col relative overflow-hidden cursor-default transition-all duration-300 hover:border-[#2A2A3A] hover:bg-[#151520] hover:-translate-y-1 shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
                      <div className="w-12 h-12 bg-[#1A1A24] border border-[#2A2A3A] rounded-xl flex items-center justify-center mb-8 relative z-10 transition-colors">
                        <Code className="w-6 h-6 text-[#EAEAF0]" strokeWidth={1.5} />
                      </div>
                      <h3 className="font-semibold text-2xl mb-4 text-[#EAEAF0] relative z-10">Algorithmic Environments</h3>
                      <p className="text-[#9CA3AF] font-normal mb-8 text-base leading-relaxed relative z-10">
                        Seamlessly transition from voice to an integrated coding environment when technical problems arrive.
                      </p>
                      <ul className="space-y-4 mt-auto relative z-10 border-t border-[#1F1F2B] pt-6">
                         {['Syntax-aware terminal', 'Instant time-space feedback', 'Multi-language auto-detect'].map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-[#EAEAF0] text-sm font-medium">
                             <div className="w-1.5 h-1.5 bg-[#FACC15] rounded-full"></div>
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
