import { useState } from "react";
import { ModeSelector } from "@/components/ModeSelector";
import { VerificationSection } from "@/components/VerificationSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Index = () => {
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  if (!selectedMode) {
    return (
      <div className="relative">
        <div className="absolute top-6 right-6 z-50">
          <ThemeToggle />
        </div>
        <ModeSelector onSelectMode={setSelectedMode} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <Button
            onClick={() => setSelectedMode(null)}
            variant="outline"
            className="glass-panel animate-lift"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Modes
          </Button>
          <ThemeToggle />
        </div>
        <VerificationSection />
      </div>
    </div>
  );
};

export default Index;
