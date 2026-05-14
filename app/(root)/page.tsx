"use client";

import React from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroBanner from "@/components/landing/HeroBanner";
import WhyZenAISection from "@/components/landing/WhyZenAISection";
import HowItWorks from "@/components/landing/HowItWorks";
import FeaturesShowcase from "@/components/landing/FeaturesShowcase";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingCalculator from "@/components/landing/PricingCalculator";
import RecruiterSection from "@/components/landing/RecruiterSection";
import LandingFooter from "@/components/landing/LandingFooter";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#0B0B0F] overflow-x-hidden">
      <LandingNavbar />
      <HeroBanner />
      <WhyZenAISection />
      <HowItWorks />
      <FeaturesShowcase />
      <TestimonialsSection />
      <PricingCalculator />
      <RecruiterSection />
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
