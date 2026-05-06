"use client";

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Mic, Code, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const FeaturesShowcase = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  return (
    <section className="relative py-28 bg-[#0B0B0F]">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#1F1F2B] to-transparent" />
      </div>

      <div
        ref={containerRef}
        className="mx-auto px-6 max-w-7xl w-full relative z-10"
      >
        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="bg-[#111118] border border-[#1F1F2B] p-10 md:p-12 mb-20 rounded-2xl overflow-hidden relative shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
            {/* Glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-[#A855F7]/10 to-transparent blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none rounded-full" />

            <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
              <div className="flex-1 space-y-6">
                <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#EAEAF0]">
                  Get Interview Ready
                </h2>
                <p className="text-lg font-normal text-[#9CA3AF] leading-relaxed max-w-xl">
                  Practice on real interview questions & get instant feedback.
                  Voice interviews now seamlessly transition into DSA coding
                  environments with real-time text analysis.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {[
                    { label: "AI Feedback", color: "#FACC15" },
                    { label: "Real-time Voice", color: "#A855F7" },
                    { label: "DSA Coding", color: "#3B82F6" },
                  ].map((tag) => (
                    <div
                      key={tag.label}
                      className="bg-[#1A1A24] border border-[#2A2A3A] px-5 py-2.5 rounded-full font-medium text-sm text-[#EAEAF0] flex items-center gap-2"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.label}
                    </div>
                  ))}
                </div>
                <Link href="/sign-up">
                  <Button className="mt-4 bg-primary hover:bg-primary/90 text-black rounded-full px-8 h-12 font-semibold shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:shadow-[0_0_30px_rgba(250,204,21,0.35)] transition-all group">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Try It Free
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <div className="flex-1 flex justify-center items-center h-[260px]">
                <div className="relative w-[300px] h-[300px] flex items-center justify-center">
                  <div className="absolute inset-0 bg-[#A855F7]/5 rounded-full blur-2xl transition-opacity duration-700" />
                  <div className="relative z-10 w-48 h-48 rounded-full border border-[#2A2A3A] bg-[#0B0B0F]/80 backdrop-blur-xl shadow-inner flex items-center justify-center overflow-hidden">
                    <div
                      className="absolute inset-0 border border-t-[#FACC15]/40 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"
                      style={{ animationDuration: "6s" }}
                    />
                    <Mic
                      className="w-12 h-12 text-[#9CA3AF]"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Section Label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-6 opacity-80 mb-12"
        >
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#1F1F2B]" />
          <h2 className="text-xs font-semibold tracking-[0.1em] uppercase text-center text-[#9CA3AF]">
            Premium Capabilities
          </h2>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#1F1F2B]" />
        </motion.div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon: Mic,
              title: "Voice Interaction",
              description:
                "Practice with our AI interviewer using natural voice conversations. Optimized for deep behavioral and situational assessments.",
              features: [
                "Real-time latent feedback",
                "Contextual follow-ups",
                "Tone & cadence analysis",
              ],
              color: "#A855F7",
            },
            {
              icon: Code,
              title: "Algorithmic Environments",
              description:
                "Seamlessly transition from voice to an integrated coding environment when technical problems arrive.",
              features: [
                "Syntax-aware terminal",
                "Instant time-space feedback",
                "Multi-language auto-detect",
              ],
              color: "#FACC15",
            },
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                }
                transition={{
                  duration: 0.5,
                  delay: 0.3 + index * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div className="bg-[#111118] border border-[#1F1F2B] p-10 rounded-2xl h-full flex flex-col relative overflow-hidden cursor-default transition-all duration-300 hover:border-[#2A2A3A] hover:bg-[#151520] hover:-translate-y-1 shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
                  <div className="w-12 h-12 bg-[#1A1A24] border border-[#2A2A3A] rounded-xl flex items-center justify-center mb-8 relative z-10">
                    <Icon
                      className="w-6 h-6 text-[#EAEAF0]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="font-semibold text-2xl mb-4 text-[#EAEAF0] relative z-10">
                    {feature.title}
                  </h3>
                  <p className="text-[#9CA3AF] font-normal mb-8 text-base leading-relaxed relative z-10">
                    {feature.description}
                  </p>
                  <ul className="space-y-4 mt-auto relative z-10 border-t border-[#1F1F2B] pt-6">
                    {feature.features.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 text-[#EAEAF0] text-sm font-medium"
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: feature.color }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesShowcase;
