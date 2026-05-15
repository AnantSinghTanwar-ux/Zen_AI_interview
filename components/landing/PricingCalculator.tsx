"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import {
  IndianRupee,
  Clock,
  Sparkles,
  Check,
  GraduationCap,
  Users,
  BookOpen,
  Mail,
  Calculator,
  ArrowRight,
  Zap,
  Shield,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

// Animated number counter
function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

// BorderBeam Component
const BorderBeam = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[-100%] aspect-square bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(212,175,55,1)_360deg)]"
      />
    </div>
  );
};

const PricingCalculator = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });

  // Payment states
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Individual pricing
  const BASE_INTERVIEW_PRICE = 399;
  const [interviewPriceInfo, setInterviewPriceInfo] = useState<{ price: number, productId: string, remaining: number }>({ price: 399, productId: 'single_interview', remaining: 0 });
  const [dsaTier, setDsaTier] = useState<'starter'|'pack'|'pro'>('pack');
  const [recruiterVisibility, setRecruiterVisibility] = useState(false);
  const RECRUITER_VISIBILITY_PRICE = 30;

  useEffect(() => {
    fetch('/api/premium/interview-price')
      .then(res => res.json())
      .then(data => setInterviewPriceInfo(data))
      .catch(console.error);
  }, []);

  // College calculator
  const [students, setStudents] = useState(50);
  const [interviewsPerStudent, setInterviewsPerStudent] = useState(3);
  const [collegeEmail, setCollegeEmail] = useState("");

  const totalInterviews = students * interviewsPerStudent;
  const totalCost = totalInterviews * BASE_INTERVIEW_PRICE;

  // Bulk discount calculation
  const getDiscount = (total: number) => {
    if (total >= 1000) return 20;
    if (total >= 500) return 15;
    if (total >= 100) return 10;
    return 0;
  };

  const discount = getDiscount(totalInterviews);
  // Apply discount then ensure the total ends in 99 (e.g. 4400 → 4399)
  const rawDiscountedCost = Math.round(totalCost * (1 - discount / 100));
  const discountedCost = rawDiscountedCost <= 99
    ? 99
    : Math.floor(rawDiscountedCost / 100) * 100 - 1;

  const { initiatePayment: initiateInterviewPayment, isProcessing: isProcessingInterview } =
    useRazorpayCheckout({
      onSuccess: (result) => {
        setPaymentError(null);
        setPaymentSuccess(
          `Payment successful! Redirecting to your interview...`
        );
        // Redirect to interview page after short delay
        setTimeout(() => {
          window.location.href = "/interview";
        }, 1500);
      },
      onError: (error) => {
        setPaymentSuccess(null);
        setPaymentError(error);
        setTimeout(() => setPaymentError(null), 5000);
      },
    });

  const { initiatePayment: initiateDSAPayment, isProcessing: isProcessingDSA } =
    useRazorpayCheckout({
      onSuccess: () => {
        setPaymentError(null);
        setPaymentSuccess(`Payment successful! Redirecting to DSA practice...`);
        setTimeout(() => { window.location.href = "/dsa-interview"; }, 1500);
      },
      onError: (error) => {
        setPaymentSuccess(null);
        setPaymentError(error);
        setTimeout(() => setPaymentError(null), 5000);
      },
    });

  const { initiatePayment: initiateCollegePayment, isProcessing: isProcessingCollege } =
    useRazorpayCheckout({
      onSuccess: () => {
        setPaymentError(null);
        setPaymentSuccess(`Payment successful! Your college plan is active.`);
      },
      onError: (error) => {
        setPaymentSuccess(null);
        setPaymentError(error);
        setTimeout(() => setPaymentError(null), 5000);
      },
    });

  const { initiatePayment: initiateVisibilityPayment, isProcessing: isProcessingVisibility } =
    useRazorpayCheckout({
      onSuccess: () => {
        setPaymentError(null);
        setPaymentSuccess(`Recruiter visibility activated! Your profile is now discoverable.`);
      },
      onError: (error) => {
        setPaymentSuccess(null);
        setPaymentError(error);
        setTimeout(() => setPaymentError(null), 5000);
      },
    });

  const handleBuyInterview = () => {
    initiateInterviewPayment(interviewPriceInfo.productId, { recruiterVisibility });
  };

  const handleBuyDSA = () => {
    const productMap = { starter: 'dsa_starter', pack: 'dsa_practice', pro: 'dsa_pro' } as const;
    initiateDSAPayment(productMap[dsaTier]);
  };

  const handleCollegeSubmit = () => {
    if (!collegeEmail) {
      setPaymentError("Please enter your official school email.");
      setTimeout(() => setPaymentError(null), 3000);
      return;
    }

    initiateCollegePayment("bulk_college_plan", { amountInPaise: discountedCost * 100 });
  };

  const interviewFeatures = [
    "30-minute AI-powered voice interview",
    "Realistic simulation with follow-ups",
    "Detailed performance scorecard",
    "Category-wise feedback & tips",
    "Personalized improvement plan",
  ];

  const dsaTiers = {
    starter: { label: '1 Session', price: 29, sessions: 1, perSession: 29 },
    pack: { label: '5 Sessions', price: 99, sessions: 5, perSession: 19 },
    pro: { label: '12 Sessions', price: 199, sessions: 12, perSession: 16 },
  };
  const activeDsa = dsaTiers[dsaTier];

  const dsaFeatures = [
    `${activeDsa.sessions} AI-guided DSA session${activeDsa.sessions > 1 ? 's' : ''}`,
    "Company-specific curated problem bank",
    "AI tutor teaches you patterns & tricks",
    "Code review with complexity analysis",
    "60 messages per session — no exploitation",
  ];

  return (
    <section id="pricing" className="relative py-28 bg-[#0B0B0F]">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#1F1F2B] to-transparent" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[200px]" />
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
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border text-muted-foreground text-xs font-medium mb-6">
            <IndianRupee className="w-3.5 h-3.5 text-primary" />
            PRICING
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight mb-5">
            Simple, <span className="text-primary">Transparent</span> Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto font-normal leading-relaxed">
            Pay per session — no subscriptions, no hidden fees. Start
            practicing today.
          </p>
        </motion.div>

        {/* Toast Messages */}
        {paymentSuccess && (
          <div className="mb-8 mx-auto max-w-2xl rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-sm text-green-300 text-center">
            ✓ {paymentSuccess}
          </div>
        )}
        {paymentError && (
          <div className="mb-8 mx-auto max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300 text-center">
            {paymentError}
          </div>
        )}

        {/* Individual Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* Interview Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={
              isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
            }
            transition={{
              duration: 0.6,
              delay: 0.15,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative group"
          >
            <div className="absolute -inset-px bg-gradient-to-b from-primary/20 to-transparent rounded-[1.1rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-card border-none rounded-2xl p-8 md:p-10 h-full flex flex-col transition-all duration-300 overflow-hidden shadow-2xl">
              <BorderBeam />
              <div className="relative z-10 flex flex-col h-full">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6 w-fit">
                  <Zap className="w-3 h-3" />
                  MOST POPULAR
                </div>

                <h3 className="text-2xl font-bold text-foreground mb-2">
                  AI Interview
                </h3>
                <p className="text-muted-foreground text-sm mb-8">
                  Voice-powered mock interview with real-time AI feedback.
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl md:text-6xl font-bold text-foreground transition-all duration-300">
                    ₹{recruiterVisibility ? interviewPriceInfo.price + RECRUITER_VISIBILITY_PRICE : interviewPriceInfo.price}
                  </span>
                  <div className="text-muted-foreground text-sm">
                    <div>per session</div>
                    <div className="flex items-center gap-1 text-xs mt-0.5">
                      <Clock className="w-3 h-3" />
                      30 minutes
                    </div>
                  </div>
                </div>

                {interviewPriceInfo.remaining > 0 && (
                  <div className="mb-4 text-xs font-semibold text-primary px-3 py-1 bg-primary/10 rounded-full w-fit">
                    Limited Offer: Only {interviewPriceInfo.remaining} spots left at ₹{interviewPriceInfo.price}!
                  </div>
                )}

                {/* Features */}
              <ul className="space-y-4 mb-8 flex-1">
                {interviewFeatures.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-[#EAEAF0]"
                  >
                    <Check
                      className="w-5 h-5 text-[#FACC15] shrink-0 mt-0.5"
                      strokeWidth={2.5}
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Recruiter Visibility Add-on */}
              <div
                onClick={() => setRecruiterVisibility(!recruiterVisibility)}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-300 mb-6 relative overflow-hidden ${
                  recruiterVisibility
                    ? 'border-[#A855F7] bg-[#A855F7]/15 shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-1 ring-[#A855F7]/30'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                }`}
              >
                {recruiterVisibility && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-gradient-to-r from-[#A855F7]/10 to-transparent pointer-events-none"
                  />
                )}
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all relative z-10 ${
                  recruiterVisibility
                    ? 'border-[#A855F7] bg-[#A855F7]'
                    : 'border-white/30'
                }`}>
                  {recruiterVisibility && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 relative z-10">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#EAEAF0]">Get visible to recruiters</p>
                    {recruiterVisibility && (
                      <span className="text-[10px] font-bold bg-[#A855F7] text-white px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9CA3AF]">Your scores appear in the recruiter talent pool</p>
                </div>
                <span className="text-sm font-bold text-[#A855F7] relative z-10">+₹{RECRUITER_VISIBILITY_PRICE}</span>
              </div>

              <Button
                id="pricing-buy-interview"
                onClick={handleBuyInterview}
                disabled={isProcessingInterview}
                className="w-full bg-primary hover:bg-primary/90 text-black rounded-full h-14 text-lg font-semibold shadow-[0_0_25px_rgba(250,204,21,0.2)] hover:shadow-[0_0_40px_rgba(250,204,21,0.35)] transition-all group disabled:opacity-60"
              >
                {isProcessingInterview ? (
                  "Processing..."
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Buy Now — ₹{recruiterVisibility ? interviewPriceInfo.price + RECRUITER_VISIBILITY_PRICE : interviewPriceInfo.price}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-[#9CA3AF] mt-3">
                <Shield className="w-3 h-3 text-green-400" />
                Secured by Razorpay
              </div>
              </div>
            </div>
          </motion.div>

          {/* DSA Practice Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={
              isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
            }
            transition={{
              duration: 0.6,
              delay: 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative group"
          >
            <div className="absolute -inset-px bg-gradient-to-b from-[#10B981]/20 to-transparent rounded-[1.1rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-[#111118] border border-[#1F1F2B] rounded-2xl p-8 md:p-10 h-full flex flex-col transition-all duration-300 hover:border-[#2A2A3A]">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6 w-fit animate-pulse">
                <Code className="w-3 h-3" />
                🔥 NEW — DSA PREP
              </div>

              <h3 className="text-2xl font-bold text-[#EAEAF0] mb-2">
                DSA Practice
              </h3>
              <p className="text-[#9CA3AF] text-sm mb-8">
                Text-based coding interview prep with AI guidance.
              </p>

              {/* Tier Selector */}
              <div className="flex gap-2 mb-6 pt-3">
                {(['starter','pack','pro'] as const).map(t => (
                  <button key={t} onClick={() => setDsaTier(t)}
                    className={`relative flex-1 text-xs py-2 px-1 sm:px-2 rounded-lg border transition-all font-medium ${
                      dsaTier === t ? 'bg-primary/20 border-primary text-primary' : 'bg-transparent border-[#1F1F2B] text-[#9CA3AF] hover:border-[#3A3A4A]'
                    }`}>
                    {t === 'pack' && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1F1F2B] text-[#9CA3AF] text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white/10 whitespace-nowrap">
                        Popular
                      </span>
                    )}
                    {t === 'pro' && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap animate-pulse">
                        Best Value
                      </span>
                    )}
                    {dsaTiers[t].label}
                  </button>
                ))}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-5xl md:text-6xl font-bold text-[#EAEAF0]">
                  ₹{activeDsa.price}
                </span>
                <div className="text-[#9CA3AF] text-sm">
                  <div>₹{activeDsa.perSession}/session</div>
                  <div className="flex items-center gap-1 text-xs mt-0.5">
                    <Clock className="w-3 h-3" />
                    30 min · 60 msgs each
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8 flex-1">
                {dsaFeatures.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-[#EAEAF0]"
                  >
                    <Check
                      className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5"
                      strokeWidth={2.5}
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                id="pricing-buy-dsa"
                onClick={handleBuyDSA}
                disabled={isProcessingDSA}
                className="w-full bg-primary hover:bg-primary/90 text-black rounded-full h-14 text-lg font-semibold shadow-[0_0_25px_rgba(212,175,55,0.2)] hover:shadow-[0_0_40px_rgba(212,175,55,0.35)] transition-all group disabled:opacity-60"
              >
                {isProcessingDSA ? (
                  "Processing..."
                ) : (
                  <>
                    <Code className="w-5 h-5 mr-2" />
                    Buy Now — ₹{activeDsa.price}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-[#9CA3AF] mt-3">
                <Shield className="w-3 h-3 text-green-400" />
                Secured by Razorpay
              </div>
            </div>
          </motion.div>

          {/* College Plan */}
          <motion.div
            id="college"
            initial={{ opacity: 0, y: 30 }}
            animate={
              isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
            }
            transition={{
              duration: 0.6,
              delay: 0.35,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative group md:col-span-2 lg:col-span-1"
          >
            <div className="absolute -inset-px bg-gradient-to-b from-[#A855F7]/20 to-transparent rounded-[1.1rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-[#111118] border border-[#1F1F2B] rounded-2xl p-8 md:p-10 h-full flex flex-col transition-all duration-300 hover:border-[#2A2A3A]">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/20 text-[#A855F7] text-xs font-semibold mb-6 w-fit">
                <GraduationCap className="w-3.5 h-3.5" />
                BULK PRICING
              </div>

              <h3 className="text-2xl font-bold text-[#EAEAF0] mb-2">
                College Plan
              </h3>
              <p className="text-[#9CA3AF] text-sm mb-8">
                Empower your entire student body with AI interview prep.
              </p>

              {/* College Form */}
              <div className="space-y-5 mb-6">
                {/* Email */}
                <div>
                  <label className="text-xs font-medium text-[#9CA3AF] mb-2 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Official School Email
                  </label>
                  <input
                    type="email"
                    value={collegeEmail}
                    onChange={(e) => setCollegeEmail(e.target.value)}
                    placeholder="placement@yourcollege.edu"
                    className="w-full bg-[#0B0B0F] border border-[#1F1F2B] rounded-xl px-4 py-3 text-sm text-[#EAEAF0] placeholder:text-[#4B5563] focus:border-[#A855F7] focus:ring-1 focus:ring-[#A855F7]/20 transition-all outline-none"
                  />
                </div>

                {/* Students & Interviews */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[#9CA3AF] mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Number of Students
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={students}
                      onChange={(e) =>
                        setStudents(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-full bg-[#0B0B0F] border border-[#1F1F2B] rounded-xl px-4 py-3 text-sm text-[#EAEAF0] focus:border-[#A855F7] focus:ring-1 focus:ring-[#A855F7]/20 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#9CA3AF] mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Interviews / Student
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={interviewsPerStudent}
                      onChange={(e) =>
                        setInterviewsPerStudent(
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      className="w-full bg-[#0B0B0F] border border-[#1F1F2B] rounded-xl px-4 py-3 text-sm text-[#EAEAF0] focus:border-[#A855F7] focus:ring-1 focus:ring-[#A855F7]/20 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Live Calculator Results */}
              <div className="bg-[#0B0B0F] border border-[#1F1F2B] rounded-xl p-5 mb-6 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[#9CA3AF] mb-3">
                  <Calculator className="w-3.5 h-3.5" />
                  LIVE COST CALCULATOR
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#9CA3AF]">Total Interviews</span>
                  <span className="text-[#EAEAF0] font-semibold text-lg">
                    <AnimatedNumber value={totalInterviews} />
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#9CA3AF]">Price per Interview</span>
                  <span className="text-[#EAEAF0]">₹{BASE_INTERVIEW_PRICE}</span>
                </div>
                {discount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-[#10B981] font-medium">
                      Bulk Discount
                    </span>
                    <span className="text-[#10B981] font-semibold">
                      -{discount}%
                    </span>
                  </motion.div>
                )}
                <div className="border-t border-[#1F1F2B] pt-3 flex justify-between items-center">
                  <span className="text-[#EAEAF0] font-medium">
                    Total Cost
                  </span>
                  <div className="text-right">
                    {discount > 0 && (
                      <span className="text-[#9CA3AF] line-through text-sm mr-2">
                        ₹<AnimatedNumber value={totalCost} />
                      </span>
                    )}
                    <span className="text-2xl font-bold text-[#EAEAF0]">
                      ₹<AnimatedNumber value={discountedCost} />
                    </span>
                  </div>
                </div>
              </div>

              <Button
                id="pricing-college-submit"
                onClick={handleCollegeSubmit}
                disabled={isProcessingCollege}
                className="w-full bg-[#A855F7] hover:bg-[#9333EA] text-white rounded-full h-14 text-lg font-semibold shadow-[0_0_25px_rgba(168,85,247,0.2)] hover:shadow-[0_0_40px_rgba(168,85,247,0.35)] transition-all group"
              >
                {isProcessingCollege ? (
                  "Processing..."
                ) : (
                  <>
                    <GraduationCap className="w-5 h-5 mr-2" />
                    Buy Bulk Plan
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PricingCalculator;
