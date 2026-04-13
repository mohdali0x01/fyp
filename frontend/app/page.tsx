import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LandingHero } from "@/components/landing/Hero";
import { LandingStats } from "@/components/landing/Stats";
import { LandingFeatures } from "@/components/landing/Features";
import { PipelineExplainer } from "@/components/landing/PipelineExplainer";
import { LandingCTA } from "@/components/landing/CTA";

export default function LandingPage() {
  return (
    <div className="hero-gradient grid-bg min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <PipelineExplainer />
        <LandingCTA />
      </main>
      <Footer />
    </div>
  );
}
