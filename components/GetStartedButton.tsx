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
      className="!bg-primary !text-primary-foreground !border-2 !border-black !rounded-md !shadow-neo hover:!shadow-none hover:!translate-y-[2px] hover:!translate-x-[2px] !transition-all !px-8 !py-4 !text-lg !font-bold !h-auto !cursor-pointer" 
      onClick={handleClick}
      disabled={isLoading}
    >
      Get Started
    </Button>
  );
}
