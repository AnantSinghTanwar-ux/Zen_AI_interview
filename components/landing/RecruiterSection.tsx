"use client";

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Briefcase,
  Mail,
  CalendarCheck,
  ArrowRight,
  Users,
  Trophy,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const RecruiterSection = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  const benefits = [
    {
      icon: Users,
      title: "Pre-screened Candidates",
      description:
        "Access students who have been rigorously assessed through AI-powered interviews with detailed performance scorecards.",
    },
    {
      icon: Trophy,
      title: "Quality Over Quantity",
      description:
        "Our scoring system identifies top performers across communication, technical skills, and problem-solving ability.",
    },
    {
      icon: Target,
      title: "Role-Matched Talent",
      description:
        "Candidates are evaluated on role-specific criteria, ensuring you find the exact fit for your open positions.",
    },
  ];

  return (
    <section id="recruiters" className="relative py-28 bg-[#0B0B0F]">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#1F1F2B] to-transparent" />
        <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-[#3B82F6]/3 rounded-full blur-[200px]" />
      </div>

      <div
        ref={containerRef}
        className="mx-auto px-6 max-w-7xl w-full relative z-10"
      >
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#111118] border border-[#1F1F2B] text-[#9CA3AF] text-xs font-medium mb-6">
            <Briefcase className="w-3.5 h-3.5" />
            FOR RECRUITERS
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#EAEAF0] tracking-tight mb-5">
            Hire Our <span className="text-[#3B82F6]">Top Candidates</span>
          </h2>
          <p className="text-lg text-[#9CA3AF] max-w-xl mx-auto font-normal leading-relaxed">
            Looking to hire pre-assessed, interview-ready talent? Connect with
            us to access our pool of rigorously evaluated candidates.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                }
                transition={{
                  duration: 0.5,
                  delay: 0.15 + index * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="bg-[#111118] border border-[#1F1F2B] rounded-2xl p-7 hover:border-[#2A2A3A] hover:bg-[#151520] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-[#3B82F6]/10 border border-[#3B82F6]/20">
                  <Icon
                    className="w-6 h-6 text-[#3B82F6]"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="text-lg font-semibold text-[#EAEAF0] mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">
                  {benefit.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          id="contact"
          className="relative overflow-hidden"
        >
          <div className="absolute -inset-px bg-gradient-to-r from-[#3B82F6]/20 via-transparent to-[#A855F7]/20 rounded-[1.1rem]" />
          <div className="relative bg-[#111118] rounded-2xl p-10 md:p-14 flex flex-col md:flex-row items-center gap-10">
            {/* Decorative glow */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-b from-[#3B82F6]/5 to-transparent blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none rounded-full" />

            <div className="flex-1 relative z-10">
              <h3 className="text-3xl md:text-4xl font-bold text-[#EAEAF0] mb-4">
                Ready to Hire Top Talent?
              </h3>
              <p className="text-[#9CA3AF] text-base leading-relaxed max-w-lg">
                Get in touch to discuss your hiring needs. We'll connect you
                with pre-assessed candidates who match your role requirements
                and have demonstrated strong interview performance.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 relative z-10 shrink-0">
              <a href="mailto:anantsinghtanwar@gmail.com">
                <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-full px-8 h-14 text-base font-semibold shadow-[0_0_25px_rgba(59,130,246,0.2)] hover:shadow-[0_0_40px_rgba(59,130,246,0.35)] transition-all group">
                  <Mail className="w-5 h-5 mr-2" />
                  Contact Us
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
              <a
                href="https://calendly.com/anantsinghtanwar/30min"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="border-[#2A2A3A] bg-[#1A1A24] text-[#EAEAF0] hover:bg-[#252530] hover:border-[#3A3A4A] rounded-full px-8 h-14 text-base font-semibold transition-all group"
                >
                  <CalendarCheck className="w-5 h-5 mr-2 text-[#A855F7]" />
                  Book a Meeting
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default RecruiterSection;
