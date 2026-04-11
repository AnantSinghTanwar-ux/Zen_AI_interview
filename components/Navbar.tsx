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
    <nav className="sticky top-0 z-50 w-full border-b border-none bg-[#f5f5f7]  shadow-neo-sm">
      <div className="mx-auto max-w-7xl w-full">
        {/* Added relative positioning for mobile menu context */}
        <div className="flex h-16 items-center px-6 w-full justify-between relative">
          <Link href="/" className="flex items-center gap-2 font-black text-xl hover:scale-105 transition-transform">
            <div className="relative h-10 w-10 overflow-hidden rounded-3xl border border-none bg-[#f5f5f7]  flex items-center justify-center shadow-neo-sm">
              <Swords className="w-6 h-6 text-primary" />
            </div>
            <span className="text-black text-2xl tracking-tight">ZenAI</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/interview" className="text-black font-bold hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary">Practice</Link>
            <Link href="/feedback" className="text-black font-bold hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary">Feedback</Link>
            <Link href="/call-data" className="text-black font-bold hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary">Interviews</Link>
            {!loading && (
              isAuthenticated ? (
                <LogoutButton />
              ) : (
                <Link href="/sign-in">
                  <Button className="btn-primary">Sign In</Button>
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
              className="text-black hover:bg-black/5"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>

          {/* Mobile Navigation Dropdown */}
          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 p-4 border-b border-none bg-[#f5f5f7]  flex flex-col gap-4 md:hidden shadow-neo-sm z-50 animate-in slide-in-from-top-2 rounded-b-2xl">
              <Link 
                href="/interview" 
                className="text-black font-bold text-lg w-full text-center py-3 hover:bg-[#f5f5f7] border border-transparent hover:border-none rounded-3xl transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Practice
              </Link>
              <Link 
                href="/feedback" 
                className="text-black font-bold text-lg w-full text-center py-3 hover:bg-[#f5f5f7] border border-transparent hover:border-none rounded-3xl transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Feedback
              </Link>
              <Link 
                href="/call-data" 
                className="text-black font-bold text-lg w-full text-center py-3 hover:bg-[#f5f5f7] border border-transparent hover:border-none rounded-3xl transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Interviews
              </Link>
              <div className="flex justify-center pt-2 border-t border-none">
                {!loading && (
                  isAuthenticated ? (
                    <LogoutButton />
                  ) : (
                    <Link href="/sign-in" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                      <Button className="w-full btn-primary h-12">Sign In</Button>
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
