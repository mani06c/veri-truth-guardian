import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { AnalysisProgress } from "./AnalysisProgress";

interface ImageResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "manipulated";
  analysis: string;
  detectionScores?: {
    splicing: number;
    aiGeneration: number;
    metadata: number;
    lighting: number;
  };
}

export const ImageVerification = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!selectedImage) {
      toast.error("Please upload an image first");
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
      
      const { data, error } = await supabase.functions.invoke('verify-image', {
        body: { imageData: selectedImage }
      });

      if (error) throw error;

      setResult({
        isAuthentic: data.isAuthentic,
        confidence: data.confidence,
        category: data.category,
        analysis: data.analysis,
      });

      toast.success("Analysis complete!");
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error("Analysis failed. Please try again.");
      setResult({
        isAuthentic: false,
        confidence: 0,
        category: "manipulated",
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
      case "manipulated":
        return <ShieldAlert className="w-8 h-8 text-destructive" />;
    }
  };

  const getResultColor = (category: string) => {
    switch (category) {
      case "authentic":
        return { bg: "bg-success/10", border: "border-success/30" };
      case "suspicious":
        return { bg: "bg-warning/10", border: "border-warning/30" };
      case "manipulated":
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
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-all cursor-pointer glass-panel animate-lift"
          >
            {selectedImage ? (
              <div className="space-y-4">
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="max-h-64 mx-auto rounded-lg object-contain"
                />
                <Button
                  variant="outline"
                  className="glass-panel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                    setResult(null);
                  }}
                >
                  Remove Image
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <Button
            onClick={analyzeImage}
            disabled={!selectedImage || isAnalyzing}
            className="w-full bg-gradient-primary animate-lift"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Image"
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
              <p className={`text-sm ${result.category === 'manipulated' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {result.analysis}
              </p>
              
              {!result.isAuthentic && (
                <div className="mt-4 space-y-2">
                  <div className="p-4 glass-panel rounded-lg border-2 border-destructive glass-glow">
                    <p className="text-destructive font-bold text-lg">⚠ DEEPFAKE DETECTED</p>
                    <p className="text-sm text-muted-foreground mt-2">Multiple manipulation indicators found</p>
                  </div>
                  
                  {result.detectionScores && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="p-3 glass-panel rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Splicing Detection</p>
                        <Progress value={result.detectionScores.splicing} className="h-2" />
                        <p className="text-xs font-medium mt-1">{result.detectionScores.splicing}%</p>
                      </div>
                      <div className="p-3 glass-panel rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">AI Generation</p>
                        <Progress value={result.detectionScores.aiGeneration} className="h-2" />
                        <p className="text-xs font-medium mt-1">{result.detectionScores.aiGeneration}%</p>
                      </div>
                      <div className="p-3 glass-panel rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Metadata Tampering</p>
                        <Progress value={result.detectionScores.metadata} className="h-2" />
                        <p className="text-xs font-medium mt-1">{result.detectionScores.metadata}%</p>
                      </div>
                      <div className="p-3 glass-panel rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Lighting Anomalies</p>
                        <Progress value={result.detectionScores.lighting} className="h-2" />
                        <p className="text-xs font-medium mt-1">{result.detectionScores.lighting}%</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
