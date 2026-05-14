"use client";

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Star, Quote, TrendingUp, Users, Award, Zap } from "lucide-react";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "SDE-1 at Google",
    avatar: "PS",
    color: "#FACC15",
    rating: 5,
    text: "ZenAI completely changed how I prepared for interviews. The AI interviewer felt like a real person — follow-up questions, probing deeper into my answers. I cracked my Google L3 round on the first attempt!",
  },
  {
    name: "Rahul Verma",
    role: "SWE Intern at Microsoft",
    avatar: "RV",
    color: "#8B5CF6",
    rating: 5,
    text: "The DSA practice is unreal. It doesn't just give you problems — it guides you through the thought process like a real interviewer would. Totally worth every rupee.",
  },
  {
    name: "Ananya Desai",
    role: "Backend Dev at Flipkart",
    avatar: "AD",
    color: "#10B981",
    rating: 5,
    text: "I was nervous about system design interviews. ZenAI's voice-based format helped me practice articulating my thoughts clearly. The detailed scorecard after each session was incredibly helpful.",
  },
  {
    name: "Vikram Singh",
    role: "SDE-2 at Amazon",
    avatar: "VS",
    color: "#3B82F6",
    rating: 5,
    text: "Used ZenAI for 2 weeks before my Amazon loop. The behavioral interview practice was spot-on. The AI caught weak points in my STAR stories that I never noticed.",
  },
  {
    name: "Sneha Patel",
    role: "Data Engineer at Razorpay",
    avatar: "SP",
    color: "#F97316",
    rating: 5,
    text: "Our college purchased the bulk plan and it was a game-changer. Students who practiced on ZenAI had a 40% higher placement rate compared to last year's batch.",
  },
  {
    name: "Arjun Nair",
    role: "Full-Stack Dev at Swiggy",
    avatar: "AN",
    color: "#EC4899",
    rating: 5,
    text: "The real-time feedback on communication skills is what sets ZenAI apart. It taught me to structure my answers better. Landed my dream job in just 3 mock sessions!",
  },
];

const impactStats = [
  { icon: <Users className="w-5 h-5" />, value: "2,500+", label: "Students Placed", color: "#FACC15" },
  { icon: <Award className="w-5 h-5" />, value: "50+", label: "Partner Colleges", color: "#8B5CF6" },
  { icon: <TrendingUp className="w-5 h-5" />, value: "40%", label: "Higher Success Rate", color: "#10B981" },
  { icon: <Zap className="w-5 h-5" />, value: "< 2 min", label: "Avg. Setup Time", color: "#3B82F6" },
];

const TestimonialsSection = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  return (
    <section
      id="testimonials"
      ref={containerRef}
      className="relative py-24 px-6 bg-background overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-primary/5 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border mb-6">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <span className="text-sm font-medium text-foreground/80">Loved by Students</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            What Our Users Say
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Thousands of students have cracked their dream interviews with ZenAI. Here&apos;s what they have to say.
          </p>
        </motion.div>

        {/* Impact Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16 max-w-4xl mx-auto"
        >
          {impactStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              className="relative p-5 rounded-2xl bg-card border border-border text-center group hover:border-primary/20 transition-all"
            >
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 border border-border bg-background shadow-sm"
              >
                {React.cloneElement(stat.icon as React.ReactElement, { className: "w-5 h-5 text-primary" })}
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Infinite Moving Cards Testimonials */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden py-10 w-full">
          <div className="w-full relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
            <motion.div
              className="flex min-w-full shrink-0 gap-5 py-4 w-max"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            >
              {[...testimonials, ...testimonials].map((t, i) => (
                <div
                  key={`${t.name}-${i}`}
                  className="w-[350px] md:w-[450px] shrink-0 group relative p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all duration-300"
                >
                  <Quote className="w-8 h-8 text-white/5 absolute top-4 right-4" />
                  
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-primary fill-primary" />
                    ))}
                  </div>
                  
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-black"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
