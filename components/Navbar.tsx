"use client";

import React from 'react';
import Link from 'next/link';
import LogoutButton from './LogoutButton';
import { Menu, X, Swords } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { checkAuthStatus } from '@/lib/actions/check-auth';

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await checkAuthStatus();
        setIsAuthenticated(result.isAuthenticated);
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/60 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto max-w-7xl w-full">
        {/* Added relative positioning for mobile menu context */}
        <div className="flex h-20 items-center px-6 w-full justify-between relative">
          <Link href="/" className="flex items-center gap-3 font-bold text-xl hover:opacity-80 transition-opacity">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <Swords className="w-5 h-5 text-primary" />
            </div>
            <span className="text-foreground tracking-wide font-semibold text-2xl">ZenAI</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/interview" className="text-foreground/80 text-sm font-medium hover:text-white transition-colors border-b border-transparent hover:border-primary pb-1">Practice</Link>
            <Link href="/feedback" className="text-foreground/80 text-sm font-medium hover:text-white transition-colors border-b border-transparent hover:border-primary pb-1">Feedback</Link>
            <Link href="/call-data" className="text-foreground/80 text-sm font-medium hover:text-white transition-colors border-b border-transparent hover:border-primary pb-1">Interviews</Link>
            <Link href="/recruiter" className="text-foreground/80 text-sm font-medium hover:text-white transition-colors border-b border-transparent hover:border-primary pb-1">Recruiter</Link>
            {!loading && (
              isAuthenticated ? (
                <LogoutButton />
              ) : (
                <Link href="/sign-in">
                  <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 border-none shadow-[0_0_15px_rgba(157,125,249,0.3)] transition-all hover:scale-105">Sign In</Button>
                </Link>
              )
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
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
          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 p-6 border-b border-white/5 bg-background/95 backdrop-blur-xl flex flex-col gap-4 md:hidden z-50 animate-in slide-in-from-top-2 rounded-b-3xl shadow-2xl">
              <Link 
                href="/interview" 
                className="text-foreground/90 font-medium text-lg w-full text-center py-3 hover:bg-white/5 rounded-2xl transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Practice
              </Link>
              <Link 
                href="/feedback" 
                className="text-foreground/90 font-medium text-lg w-full text-center py-3 hover:bg-white/5 rounded-2xl transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Feedback
              </Link>
              <Link 
                href="/call-data" 
                className="text-foreground/90 font-medium text-lg w-full text-center py-3 hover:bg-white/5 rounded-2xl transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Interviews
              </Link>
              <Link 
                href="/recruiter" 
                className="text-foreground/90 font-medium text-lg w-full text-center py-3 hover:bg-white/5 rounded-2xl transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Recruiter
              </Link>
              <div className="flex justify-center pt-4 mt-2 border-t border-white/10">
                {!loading && (
                  isAuthenticated ? (
                    <LogoutButton />
                  ) : (
                    <Link href="/sign-in" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-full h-12 shadow-[0_0_15px_rgba(157,125,249,0.3)]">Sign In</Button>
                    </Link>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
