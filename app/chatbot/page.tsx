"use client";

import Navbar from "@/components/Navbar";
import AIChatbot from "@/components/AIChatbot";

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Navbar />
      <AIChatbot userType="supplier" />
    </main>
  );
}
