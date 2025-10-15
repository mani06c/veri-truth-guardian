import { Hero } from "@/components/Hero";
import { VerificationSection } from "@/components/VerificationSection";

const Index = () => {
  const scrollToVerify = () => {
    const element = document.getElementById("verify");
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      <Hero onScrollToVerify={scrollToVerify} />
      <VerificationSection />
    </div>
  );
};

export default Index;
