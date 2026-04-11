import type { Metadata } from "next";
import { Mona_Sans, Urbanist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZenAI",
  description: "Your Personal AI Powered Mock Interviewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body 
        className={`${monaSans.variable} ${urbanist.variable} ${urbanist.className} antialiased bg-background text-foreground`}
        suppressHydrationWarning={true}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
