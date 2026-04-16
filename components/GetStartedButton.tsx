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
      className="btn-primary w-full sm:w-auto text-lg tracking-wide rounded-full px-10 py-4 h-auto" 
      onClick={handleClick}
      disabled={isLoading}
    >
      Get Started
    </Button>
  );
}
