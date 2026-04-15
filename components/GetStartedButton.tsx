"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkAuthStatus } from "@/lib/actions/check-auth";

export default function GetStartedButton() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        // Use the server action to check auth status
        const result = await checkAuthStatus();
        setIsAuthenticated(result.isAuthenticated);
      } catch (error) {
        console.error("Error checking authentication status:", error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAuthStatus();
  }, []);
  
  const handleClick = () => {
    if (isAuthenticated) {
      router.push("/interview");
    } else {
      router.push("/sign-in");
    }
  };
  
  return (
    <Button 
      className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 py-4 h-auto border-none shadow-[0_0_20px_rgba(157,125,249,0.3)] hover:shadow-[0_0_30px_rgba(157,125,249,0.5)] active:scale-95 transition-all text-lg font-semibold tracking-wide" 
      onClick={handleClick}
      disabled={isLoading}
    >
      Get Started
    </Button>
  );
}
