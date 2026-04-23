import { useState } from "react";
import { useScans } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { AnalysisProgress } from "./AnalysisProgress";

interface VerificationResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "fake";
  analysis: string;
}

export const TextVerification = () => {
  const [text, setText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const { user } = useAuth();
  const { saveScan } = useScans();

  const analyzeText = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text to analyze");
      return;
    }

    setIsAnalyzing(true);
    setShowProgress(true);
    setResult(null);
  };

  const handleAnalysisComplete = async () => {
    setShowProgress(false);
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      
      const { data, error } = await supabase.functions.invoke('verify-text', {
        body: { text }
      });

      if (error) throw error;

      setResult({
        isAuthentic: data.isAuthentic,
        confidence: data.confidence,
        category: data.category,
        analysis: data.analysis,
      });

      if (user) {
        saveScan.mutate({
          scan_type: "text",
          input_label: text.slice(0, 80),
          file_path: null,
          verdict: data.category,
          confidence: data.confidence,
          source_type: null,
          details: data,
          effects: [],
        });
      }
      toast.success("Analysis complete!");
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error("Analysis failed. Please try again.");
      setResult({
        isAuthentic: false,
        confidence: 0,
        category: "fake",
        analysis: "An error occurred during analysis. Please try again.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getResultIcon = (category: string) => {
    switch (category) {
      case "authentic":
        return <ShieldCheck className="w-8 h-8 text-success" />;
      case "suspicious":
        return <AlertTriangle className="w-8 h-8 text-warning" />;
      case "fake":
        return <ShieldAlert className="w-8 h-8 text-destructive" />;
    }
  };

  const getResultColor = (category: string) => {
    switch (category) {
      case "authentic":
        return { bg: "bg-success/10", border: "border-success/30" };
      case "suspicious":
        return { bg: "bg-warning/10", border: "border-warning/30" };
      case "fake":
        return { bg: "bg-destructive/10", border: "border-destructive/30" };
    }
  };

  if (showProgress) {
    return <AnalysisProgress onComplete={handleAnalysisComplete} />;
  }

  return (
    <div className="space-y-6">
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <Textarea
            placeholder="Paste the text you want to verify..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[200px] resize-none glass-panel"
          />
          <Button 
            onClick={analyzeText} 
            disabled={isAnalyzing} 
            className="w-full bg-gradient-primary animate-lift" 
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Verify Text"
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="glass-panel p-6 animate-glass-ripple">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full glass-glow ${getResultColor(result.category).bg}`}>
                {getResultIcon(result.category)}
              </div>
              <div>
                <h3 className="text-lg font-semibold capitalize">{result.category}</h3>
                <p className="text-sm text-muted-foreground">Confidence: {result.confidence}%</p>
              </div>
            </div>

            <Progress value={result.confidence} className="h-3 glass-panel" />

            <div className="pt-4 border-t border-border/50">
              <p className={`text-sm ${result.category === 'fake' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {result.analysis}
              </p>
              {!result.isAuthentic && (
                <div className="mt-4 p-4 glass-panel rounded-lg border-2 border-destructive glass-glow">
                  <p className="text-destructive font-bold text-lg">⚠ FAKE NEWS DETECTED</p>
                  <p className="text-sm text-muted-foreground mt-2">This content shows multiple signs of misinformation</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
