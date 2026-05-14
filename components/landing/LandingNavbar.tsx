"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Swords, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

import { checkAuthStatus } from '@/lib/actions/check-auth';
import LogoutButton from '../LogoutButton';

const navLinks = [
  { label: "Home", href: "#hero" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Student", href: "#pricing" },
  { label: "College", href: "#college" },
  { label: "Recruiters", href: "#recruiters" },
  { label: "Contact", href: "#contact" },
];

type AuthState = 'unknown' | 'authenticated' | 'guest';

function getClientAuthHint(): AuthState {
  if (typeof window === 'undefined') return 'unknown';
  const cachedState = window.sessionStorage.getItem('zenai-auth-state');
  if (cachedState === 'authenticated' || cachedState === 'guest') {
    return cachedState;
  }
  return document.cookie.includes('session=') ? 'authenticated' : 'guest';
}

const LandingNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [authState, setAuthState] = useState<AuthState>('unknown');

  const isAuthenticated = authState === 'authenticated';
  const isAuthLoading = authState === 'unknown';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      // Determine active section
      const sections = navLinks.map((l) => l.href.replace("#", ""));
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            setActiveSection(sections[i]);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    let isMounted = true;
    const hintedState = getClientAuthHint();
    setAuthState(hintedState);

    const checkAuth = async () => {
      try {
        const result = await checkAuthStatus();
        if (!isMounted) return;
        const nextState: AuthState = result.isAuthenticated ? 'authenticated' : 'guest';
        setAuthState(nextState);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('zenai-auth-state', nextState);
        }
      } catch (error) {
        if (!isMounted) return;
        setAuthState('guest');
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('zenai-auth-state', 'guest');
        }
      }
    };

    checkAuth();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      isMounted = false;
    };
  }, []);

  const scrollToSection = (href: string) => {
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        isScrolled
          ? "bg-[#0B0B0F]/90 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl w-full">
        <div className="flex h-20 items-center px-6 w-full justify-between relative">
          {/* Logo */}
          <button
            onClick={() => scrollToSection("#hero")}
            className="flex items-center gap-3 font-bold text-xl hover:opacity-80 transition-opacity"
          >
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <Swords className="w-5 h-5 text-primary" />
            </div>
            <span className="text-foreground tracking-wide font-semibold text-2xl">
              ZenAI
            </span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const sectionId = link.href.replace("#", "");
              const isActive = activeSection === sectionId;
              return (
                <button
                  key={link.href}
                  onClick={() => scrollToSection(link.href)}
                  className={`relative text-sm font-medium px-4 py-2 rounded-full transition-all duration-300 ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {isAuthLoading ? (
              <div className="h-10 w-28 rounded-full border border-white/10 bg-white/5 animate-pulse" />
            ) : isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button className="bg-primary hover:bg-primary/90 text-black rounded-full px-6 font-semibold shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:shadow-[0_0_30px_rgba(250,204,21,0.4)] transition-all hover:scale-105 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button
                    variant="ghost"
                    className="text-white/70 hover:text-white hover:bg-white/5 rounded-full px-5 text-sm font-medium"
                  >
                    Log In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button className="bg-primary hover:bg-primary/90 text-black rounded-full px-6 font-semibold shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:shadow-[0_0_30px_rgba(250,204,21,0.4)] transition-all hover:scale-105 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-foreground/80 hover:text-white hover:bg-white/5 rounded-full transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>

          {/* Mobile Navigation Dropdown */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute top-full left-0 right-0 p-6 border-b border-white/5 bg-[#0B0B0F]/98 backdrop-blur-xl flex flex-col gap-2 lg:hidden z-50 rounded-b-3xl shadow-2xl"
              >
                {navLinks.map((link) => (
                  <button
                    key={link.href}
                    onClick={() => scrollToSection(link.href)}
                    className="text-foreground/90 font-medium text-lg w-full text-center py-3 hover:bg-white/5 rounded-2xl transition-all"
                  >
                    {link.label}
                  </button>
                ))}
                <div className="flex flex-col gap-3 pt-4 mt-2 border-t border-white/10">
                  {isAuthLoading ? (
                    <div className="h-12 w-full rounded-full border border-white/10 bg-white/5 animate-pulse" />
                  ) : isAuthenticated ? (
                    <>
                      <Link
                        href="/dashboard"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full"
                      >
                        <Button className="w-full bg-primary hover:bg-primary/90 text-black rounded-full h-12 font-semibold shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                          <Sparkles className="w-4 h-4 mr-2" />
                          Dashboard
                        </Button>
                      </Link>
                      <LogoutButton />
                    </>
                  ) : (
                    <>
                      <Link
                        href="/sign-in"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full"
                      >
                        <Button
                          variant="ghost"
                          className="w-full text-white/70 hover:text-white hover:bg-white/5 rounded-full h-12"
                        >
                          Log In
                        </Button>
                      </Link>
                      <Link
                        href="/sign-up"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full"
                      >
                        <Button className="w-full bg-primary hover:bg-primary/90 text-black rounded-full h-12 font-semibold shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                          <Sparkles className="w-4 h-4 mr-2" />
                          Get Started
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
};

export default LandingNavbar;
