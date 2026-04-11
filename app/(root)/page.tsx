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

const HomePage = () => {
  return (
    <PageLayout fullWidth={true}>
      <HeroSection />

      {/* Content sections aligned with navbar */}
      <div className="relative z-10 bg-[#f5f5f7]  text-foreground py-20">
        <div className="mx-auto px-6 max-w-7xl w-full">
          {/* CTA Section */}
          <section className="bg-primary/5 rounded-3xl border border-none p-4 md:p-6 shadow-neo mb-20">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                 <h2 className="text-4xl font-black uppercase tracking-tight">Get Interview Ready</h2>
                 <p className="text-xl font-medium text-gray-700">
                   Practice on real Interview questions & get instant feedback. 
                   Voice interviews now include DSA coding questions with text chat support!
                 </p>
                 <div className="flex gap-2">
                    <div className="bg-[#f5f5f7]  text-foreground px-4 py-2 border border-none rounded-md font-bold text-sm shadow-neo-sm">
                       AI Feedback
                    </div>
                     <div className="bg-[#f5f5f7]  text-foreground px-4 py-2 border border-none rounded-md font-bold text-sm shadow-neo-sm">
                       Real-time Voice
                    </div>
                 </div>
              </div>
              <div className="flex-1 flex justify-center items-center h-[260px] overflow-hidden">
                <Image
                  src={"/OJZ2JZ0.png"}
                  width={420}
                  height={420}
                  alt="robot"
                  className="drop-shadow-neo object-cover"
                />
              </div>
            </div>
          </section>

          {/* Recent Interview Data */}
          <RecentCallData />

          <section className="flex flex-col gap-10 mt-20">
            <div className="flex items-center gap-4">
               <div className="h-1 flex-1 bg-black"></div>
               <h2 className="text-4xl font-black uppercase text-center shrink-0">Interview Features</h2>
               <div className="h-1 flex-1 bg-black"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="neo-box p-8 rounded-3xl h-full flex flex-col">
                  <div className="w-16 h-16 bg-primary rounded-2xl border border-none flex items-center justify-center mb-6 shadow-neo-sm">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-2xl mb-3">Voice Interview</h3>
                  <p className="text-gray-600 font-medium mb-6 text-lg">
                    Practice with our AI interviewer using natural voice conversations. Perfect for behavioral and technical discussions.
                  </p>
                  <ul className="space-y-3 mt-auto">
                    {['Real-time voice interaction', 'Behavioral & technical questions', 'Instant transcript & feedback'].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 font-semibold">
                         <div className="w-2 h-2 bg-black rounded-full"></div>
                         {item}
                      </li>
                    ))}
                  </ul>
              </div>

              <div className="neo-box p-8 rounded-3xl h-full flex flex-col">
                  <div className="w-16 h-16 bg-green-500 rounded-2xl border border-none flex items-center justify-center mb-6 shadow-neo-sm">
                    <Code className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-2xl mb-3">DSA Chat Support</h3>
                  <p className="text-gray-600 font-medium mb-6 text-lg">
                    When DSA questions come up during voice interviews, a chat window automatically appears for coding solutions.
                  </p>
                  <ul className="space-y-3 mt-auto">
                     {['Auto-detects coding questions', 'Text input for code solutions', 'Real-time analysis & feedback'].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 font-semibold">
                         <div className="w-2 h-2 bg-black rounded-full"></div>
                         {item}
                      </li>
                    ))}
                  </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
};

export default HomePage;
