import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface VerificationResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "fake";
  analysis: string;
}

export const TextVerification = () => {
  const [text, setText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const analyzeText = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text to analyze");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      // Simulate analysis with a delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock result - in production, this would use @huggingface/transformers
      const mockConfidence = Math.random() * 100;
      const mockResult: VerificationResult = {
        isAuthentic: mockConfidence > 60,
        confidence: mockConfidence,
        category: mockConfidence > 70 ? "authentic" : mockConfidence > 40 ? "suspicious" : "fake",
        analysis: mockConfidence > 70 
          ? "This text shows patterns consistent with authentic news sources. Language structure and factual consistency suggest reliability."
          : mockConfidence > 40
          ? "This text contains some suspicious elements. Further verification recommended. Some claims may require fact-checking."
          : "High likelihood of misinformation detected. Multiple red flags including sensational language and unverified claims."
      };

      setResult(mockResult);
      toast.success("Analysis complete!");
    } catch (error) {
      toast.error("Analysis failed. Please try again.");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getResultIcon = () => {
    if (!result) return null;
    
    switch (result.category) {
      case "authentic":
        return <CheckCircle className="w-12 h-12 text-success" />;
      case "suspicious":
        return <AlertTriangle className="w-12 h-12 text-warning" />;
      case "fake":
        return <XCircle className="w-12 h-12 text-destructive" />;
    }
  };

  const getResultColor = () => {
    if (!result) return "";
    
    switch (result.category) {
      case "authentic":
        return "border-success/20 bg-success/5";
      case "suspicious":
        return "border-warning/20 bg-warning/5";
      case "fake":
        return "border-destructive/20 bg-destructive/5";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-lg border-2">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Enter text to verify
            </label>
            <Textarea
              placeholder="Paste news article text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[200px] resize-none"
              disabled={isAnalyzing}
            />
          </div>

          <Button
            onClick={analyzeText}
            disabled={isAnalyzing || !text.trim()}
            className="w-full bg-gradient-primary hover:opacity-90"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Verify Text"
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className={`p-8 shadow-lg border-2 ${getResultColor()} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
          <div className="flex flex-col items-center text-center space-y-4">
            {getResultIcon()}
            
            <div>
              <h3 className="text-2xl font-bold mb-2 capitalize">
                {result.category}
              </h3>
              <p className="text-4xl font-bold mb-4">
                {result.confidence.toFixed(1)}%
                <span className="text-lg font-normal text-muted-foreground ml-2">
                  Confidence
                </span>
              </p>
            </div>

            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  result.category === "authentic" 
                    ? "bg-success" 
                    : result.category === "suspicious" 
                    ? "bg-warning" 
                    : "bg-destructive"
                }`}
                style={{ width: `${result.confidence}%` }}
              />
            </div>

            <p className="text-muted-foreground max-w-2xl">
              {result.analysis}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
