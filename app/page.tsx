import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/sections/Hero";
// Removed per CONTENT.md §3 (not in the approved homepage order) and §4.3/§9
// (repeats the "one workspace" promise as a separate product-story section).
// Kept commented out rather than deleted.
// import OneWorkspace from "@/components/landing/sections/OneWorkspace";
import WhyDocuzy from "@/components/landing/sections/WhyDocuzy";
import AIChatFeature from "@/components/landing/sections/AIChatFeature";
import ToolsFeature from "@/components/landing/sections/ToolsFeature";
import OrganizationFeature from "@/components/landing/sections/OrganizationFeature";
import HowItWorks from "@/components/landing/sections/HowItWorks";
// Removed per CONTENT.md §3 (not an approved section) and DESIGN.md §10
// (do not expand each audience/use case into another long landing section
// unless CONTENT.md deliberately specifies it). Kept commented out.
// import StudentUseCases from "@/components/landing/sections/StudentUseCases";
import FinalCTA from "@/components/landing/sections/FinalCTA";
import Footer from "@/components/landing/sections/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans selection:bg-indigo-500/20 overflow-x-hidden">
      <Navbar />
      <Hero />
      <WhyDocuzy />
      <AIChatFeature />
      {/* <OneWorkspace /> */}
      <ToolsFeature />
      <OrganizationFeature />
      <HowItWorks />
      {/* <StudentUseCases /> */}
      <FinalCTA />
      <Footer />
    </div>
  );
}
