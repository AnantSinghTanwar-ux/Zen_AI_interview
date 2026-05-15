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
  GraduationCap,
  Sparkles,
  Shield,
  TrendingUp,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const RecruiterSection = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  const forRecruiters = [
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
        "Filter candidates by role — SDE, Data Analyst, PM, and more. Only see talent that fits your open positions.",
    },
  ];

  const forStudents = [
    {
      icon: Eye,
      title: "Get Discovered by Top Recruiters",
      description:
        "Opt-in for just ₹30 and your interview performance gets showcased to active recruiters looking to hire.",
    },
    {
      icon: TrendingUp,
      title: "Prove Your Skills — Not Just Your Resume",
      description:
        "Your AI-scored interview becomes a live portfolio piece. Recruiters see your communication, technical depth, and problem-solving ability.",
    },
    {
      icon: Shield,
      title: "Privacy-First Visibility",
      description:
        "Only your performance scores and role info are shared. Your personal data stays protected unless a recruiter reaches out.",
    },
  ];

  return (
    <section id="recruiters" className="relative py-28 bg-[#0B0B0F]">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#1F1F2B] to-transparent" />
        <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-[#3B82F6]/3 rounded-full blur-[200px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-[#A855F7]/3 rounded-full blur-[200px]" />
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
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#111118] border border-[#1F1F2B] text-[#9CA3AF] text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#DAA520]" />
            STUDENTS × RECRUITERS
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#EAEAF0] tracking-tight mb-5">
            One Platform. <span className="text-[#3B82F6]">Two Wins.</span>
          </h2>
          <p className="text-lg text-[#9CA3AF] max-w-2xl mx-auto font-normal leading-relaxed">
            Students practice and prove their skills. Recruiters discover pre-assessed,
            interview-ready talent. ZenAI bridges the gap between preparation and hiring.
          </p>
        </motion.div>

        {/* Demo Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mb-20 w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(59,130,246,0.1)] bg-black/40 backdrop-blur-sm"
        >
          <div className="py-3 px-6 border-b border-white/10 bg-white/5 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            <span className="ml-4 text-xs font-medium text-[#9CA3AF]">ZenAI Recruiter Dashboard</span>
          </div>

          {/* Scrolling Marquee */}
          <div className="flex overflow-hidden relative w-full h-[280px] md:h-[420px]">
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{
                duration: 40,
                repeat: Infinity,
                ease: "linear",
              }}
              className="flex items-center min-w-max gap-4 p-4"
              style={{ paddingRight: '1rem' }}
            >
              {/* Set 1 */}
              {["/demo/2.jpg", "/demo/3.png", "/demo/4.png", "/demo/5.png"].map((src, i) => (
                <div key={`a-${i}`} className="relative h-[240px] md:h-[380px] w-[430px] md:w-[650px] rounded-xl overflow-hidden shadow-lg border border-white/10 group">
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors z-10"></div>
                  <img src={src} className="w-full h-full object-cover" alt={`Recruiter Dashboard ${i + 1}`} />
                </div>
              ))}
              {/* Set 2 (seamless loop) */}
              {["/demo/2.jpg", "/demo/3.png", "/demo/4.png", "/demo/5.png"].map((src, i) => (
                <div key={`b-${i}`} className="relative h-[240px] md:h-[380px] w-[430px] md:w-[650px] rounded-xl overflow-hidden shadow-lg border border-white/10 group">
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors z-10"></div>
                  <img src={src} className="w-full h-full object-cover" alt={`Recruiter Dashboard ${i + 1}`} />
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Two-column: For Recruiters | For Students */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          {/* FOR RECRUITERS */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <h3 className="text-2xl font-bold text-[#EAEAF0]">For Recruiters</h3>
            </div>

            <div className="space-y-4">
              {forRecruiters.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 15 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    className="bg-[#111118] border border-[#1F1F2B] rounded-2xl p-6 hover:border-[#3B82F6]/30 hover:bg-[#151520] transition-all duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#3B82F6]/10 border border-[#3B82F6]/20 shrink-0">
                        <Icon className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-[#EAEAF0] mb-1">{item.title}</h4>
                        <p className="text-sm text-[#9CA3AF] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* FOR STUDENTS */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#A855F7]/15 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#A855F7]" />
              </div>
              <h3 className="text-2xl font-bold text-[#EAEAF0]">For Students</h3>
            </div>

            <div className="space-y-4">
              {forStudents.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 15 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
                    transition={{ delay: 0.35 + idx * 0.1 }}
                    className="bg-[#111118] border border-[#1F1F2B] rounded-2xl p-6 hover:border-[#A855F7]/30 hover:bg-[#151520] transition-all duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#A855F7]/10 border border-[#A855F7]/20 shrink-0">
                        <Icon className="w-5 h-5 text-[#A855F7]" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-[#EAEAF0] mb-1">{item.title}</h4>
                        <p className="text-sm text-[#9CA3AF] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* How It Works — Collaborative Flow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-16"
        >
          <h3 className="text-center text-2xl font-bold text-[#EAEAF0] mb-8">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: "01", title: "Student Practices", desc: "Take an AI-powered mock interview for ₹149–399", color: "#A855F7" },
              { step: "02", title: "Opt-in for ₹30", desc: "Choose to make your scores visible to recruiters", color: "#DAA520" },
              { step: "03", title: "AI Scores & Ranks", desc: "Performance is analyzed and ranked automatically", color: "#3B82F6" },
              { step: "04", title: "Recruiters Hire", desc: "Top talent gets discovered and contacted directly", color: "#10B981" },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className="relative bg-[#111118] border border-[#1F1F2B] rounded-2xl p-6 text-center hover:border-[#2A2A3A] transition-all"
              >
                <div className="text-3xl font-black mb-3" style={{ color: item.color }}>{item.step}</div>
                <h4 className="text-base font-semibold text-[#EAEAF0] mb-2">{item.title}</h4>
                <p className="text-sm text-[#9CA3AF]">{item.desc}</p>
                {idx < 3 && (
                  <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-[#2A2A3A]" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
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
                Get in touch to discuss your hiring needs. We&apos;ll connect you
                with pre-assessed candidates who match your role requirements
                and have demonstrated strong interview performance.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 relative z-10 shrink-0">
              <Link href="/sign-in?redirect=/recruiter">
                <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-full px-8 h-14 text-base font-semibold shadow-[0_0_25px_rgba(59,130,246,0.2)] hover:shadow-[0_0_40px_rgba(59,130,246,0.35)] transition-all group">
                  <Briefcase className="w-5 h-5 mr-2" />
                  Login as Recruiter
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="mailto:anantsinghtanwar@gmail.com">
                <Button
                  variant="outline"
                  className="border-[#2A2A3A] bg-[#1A1A24] text-[#EAEAF0] hover:bg-[#252530] hover:border-[#3A3A4A] rounded-full px-8 h-14 text-base font-semibold transition-all group"
                >
                  <Mail className="w-5 h-5 mr-2 text-[#A855F7]" />
                  Contact Us
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
                  <CalendarCheck className="w-5 h-5 mr-2 text-[#DAA520]" />
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
