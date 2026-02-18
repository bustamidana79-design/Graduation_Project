import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Navbar />
      <Hero />
      <Features />
    </main>
  );
}