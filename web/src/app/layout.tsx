import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReviewSage // Autonomous Research Platform",
  description: "Enterprise multi-agent research agent with LangGraph, Google Gemini, Ollama, and deterministic citation verification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col antialiased selection:bg-zinc-800 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
