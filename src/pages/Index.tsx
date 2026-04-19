import { useState } from "react";
import { ModeSelector } from "@/components/ModeSelector";
import { VerificationSection } from "@/components/VerificationSection";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Index = () => {
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <AppHeader />
      {!selectedMode ? (
        <ModeSelector onSelectMode={setSelectedMode} />
      ) : (
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Button
              onClick={() => setSelectedMode(null)}
              variant="outline"
              className="glass-panel animate-lift"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to modes
            </Button>
          </div>
          <VerificationSection initialMode={selectedMode} />
        </div>
      )}
    </div>
  );
};

export default Index;
