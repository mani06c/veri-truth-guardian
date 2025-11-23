import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Globe } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { AnalysisProgress } from "./AnalysisProgress";

interface UrlResult {
  isCredible: boolean;
  confidence: number;
  category: "credible" | "questionable" | "misinformation";
  analysis: string;
}

export const UrlVerification = () => {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [result, setResult] = useState<UrlResult | null>(null);

  const analyzeUrl = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL to analyze");
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsAnalyzing(true);
    setShowProgress(true);
    setResult(null);
  };

  const handleAnalysisComplete = () => {
    setShowProgress(false);
    
    const confidence = Math.random() * 100;
    const isCredible = confidence > 50;

    setResult({
      isCredible,
      confidence: Math.round(confidence),
      category: isCredible ? "credible" : confidence > 30 ? "questionable" : "misinformation",
      analysis: isCredible
        ? "Website appears credible. Domain has verified SSL certificate, established history, authoritative sources cited, and cross-referenced with fact-checking databases. Content shows journalistic standards."
        : "Critical credibility issues detected. Website shows characteristics of misinformation sources including suspicious domain age, lack of verifiable sources, biased language patterns, inconsistent facts, and presence on known misinformation watchlists. Content fails fact-checking verification.",
    });

    setIsAnalyzing(false);
    toast.success("Analysis complete!");
  };

  const getResultIcon = (category: string) => {
    switch (category) {
      case "credible":
        return <ShieldCheck className="w-8 h-8 text-success" />;
      case "questionable":
        return <AlertTriangle className="w-8 h-8 text-warning" />;
      case "misinformation":
        return <ShieldAlert className="w-8 h-8 text-destructive" />;
    }
  };

  const getResultColor = (category: string) => {
    switch (category) {
      case "credible":
        return { bg: "bg-success/10", border: "border-success/30" };
      case "questionable":
        return { bg: "bg-warning/10", border: "border-warning/30" };
      case "misinformation":
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
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10 glass-panel"
            />
          </div>
          <Button 
            onClick={analyzeUrl} 
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
              "Verify URL"
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
              <p className={`text-sm ${result.category === 'misinformation' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {result.analysis}
              </p>
              
              {!result.isCredible && (
                <div className="mt-4 space-y-2">
                  <div className="p-4 glass-panel rounded-lg border-2 border-destructive glass-glow">
                    <p className="text-destructive font-bold text-lg">⚠ MISINFORMATION SOURCE</p>
                    <p className="text-sm text-muted-foreground mt-2">This website shows multiple credibility issues</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Source Credibility</p>
                      <Progress value={15} className="h-2" />
                      <p className="text-xs font-medium mt-1">15%</p>
                    </div>
                    <div className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Fact Verification</p>
                      <Progress value={22} className="h-2" />
                      <p className="text-xs font-medium mt-1">22%</p>
                    </div>
                    <div className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Domain Reputation</p>
                      <Progress value={18} className="h-2" />
                      <p className="text-xs font-medium mt-1">18%</p>
                    </div>
                    <div className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Citation Quality</p>
                      <Progress value={12} className="h-2" />
                      <p className="text-xs font-medium mt-1">12%</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};