"use client";

import { logout } from "@/lib/actions/auth.actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (isLoggingOut) return; // Prevent multiple clicks
    
    try {
      setIsLoggingOut(true);
      
      // Call server action
      await logout();
      
      // Navigate directly
      window.location.href = "/sign-in";
    } catch (error) {
      console.error("Logout error:", error);
      // If there's an error, still redirect to sign-in for a better user experience
      window.location.href = "/sign-in";
    }
  };
  
  return (
    <button 
      onClick={handleLogout} 
      className="nav-link logout-link cursor-pointer hover:text-red-500 transition-colors font-bold"
      disabled={isLoggingOut}
    >
      {isLoggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}
