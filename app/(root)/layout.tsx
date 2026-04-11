import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.actions";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "ZenAI",
    template: "%s | ZenAI",
  },
  description: "ZenAI - Your Personal AI Powered Mock Interviewer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {children}
      {/* Footer is automatically included on all pages except the homepage */}
      {/* The homepage has its own footer with the special styling */}
      <Toaster position="top-center" />
    </div>
  );
}
