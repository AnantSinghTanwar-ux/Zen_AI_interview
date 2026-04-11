"use client";
import React, { useRef, useState } from "react";

export const GridBackground = ({ children }: { children: React.ReactNode }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  return (
      <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative flex-1 flex items-center justify-center py-10 px-4 w-full bg-[#f2f2f2] overflow-hidden"
    >
      {/* Simple Grid Pattern Background (Static Base) */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#000 2px, transparent 2px), linear-gradient(90deg, #000 2px, transparent 2px)",
          backgroundSize: "40px 40px",
        }}
      ></div>

      {/* Interactive Grid Overlay (Revealed on Hover) */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#000 2px, transparent 2px), linear-gradient(90deg, #000 2px, transparent 2px)",
          backgroundSize: "40px 40px",
          opacity: 0.15,
          maskImage: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
        }}
      />
      
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
};
