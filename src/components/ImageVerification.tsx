import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface DetectedEffect {
  name: string;
  confidence: number;
  severity?: "subtle" | "moderate" | "strong";
}

interface ImageResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "manipulated";
  verdict?: string;
  sourceType?: "camera" | "lightly-edited" | "heavily-edited" | "ai-generated";
  analysis: string;
  detectionScores?: {
    aiGeneration: number;
    splicing: number;
    lighting: number;
    metadata: number;
  };
  effects?: DetectedEffect[];
}

const SOURCE_LABELS: Record<string, string> = {
  "camera": "Original camera photo",
  "lightly-edited": "Lightly edited",
  "heavily-edited": "Heavily edited",
  "ai-generated": "AI-generated",
};

const SEVERITY_CLS: Record<string, string> = {
  subtle: "bg-muted/40 border-border/50 text-foreground",
  moderate: "bg-warning/15 border-warning/40 text-warning",
  strong: "bg-destructive/15 border-destructive/40 text-destructive",
};

export const ImageVerification = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runAnalysis = async (imageData: string) => {
    setIsAnalyzing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-image", {
        body: { imageData },
      });
      if (error) throw error;
      if (data?.error && !data.category) throw new Error(data.error);
      setResult(data as ImageResult);
      toast.success("Analysis complete");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSelectedImage(dataUrl);
      // Auto-analyze immediately
      runAnalysis(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const badge = (() => {
    if (isAnalyzing) {
      return {
        label: "Scanning…",
        sub: "AI forensic analysis in progress",
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        cls: "bg-primary/15 border-primary/40 text-primary",
      };
    }
    if (!result) return null;
    if (result.category === "authentic") {
      return {
        label: result.verdict || "Real",
        sub: `Authentic · ${result.confidence}% confidence`,
        icon: <ShieldCheck className="w-5 h-5" />,
        cls: "bg-success/15 border-success/40 text-success",
      };
    }
    if (result.category === "suspicious") {
      return {
        label: result.verdict || "Suspicious",
        sub: `Possible manipulation · ${result.confidence}% confidence`,
        icon: <AlertTriangle className="w-5 h-5" />,
        cls: "bg-warning/15 border-warning/40 text-warning",
      };
    }
    return {
      label: result.verdict || "AI / Manipulated",
      sub: `Inauthentic · ${result.confidence}% confidence`,
      icon: <ShieldAlert className="w-5 h-5" />,
      cls: "bg-destructive/15 border-destructive/40 text-destructive",
    };
  })();

  return (
    <div className="space-y-6">
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-all cursor-pointer glass-panel animate-lift overflow-hidden"
          >
            {selectedImage ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={selectedImage}
                    alt="Selected"
                    className="max-h-80 mx-auto rounded-lg object-contain"
                  />
                  {badge && (
                    <div
                      className={`absolute top-3 left-3 flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md ${badge.cls} shadow-lg`}
                    >
                      {badge.icon}
                      <div className="text-left leading-tight">
                        <div className="text-xs font-bold">{badge.label}</div>
                        <div className="text-[10px] opacity-80">{badge.sub}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    className="glass-panel"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(null);
                      setResult(null);
                    }}
                  >
                    Remove
                  </Button>
                  <Button
                    className="bg-gradient-primary"
                    disabled={isAnalyzing}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedImage) runAnalysis(selectedImage);
                    }}
                  >
                    {isAnalyzing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Re-scanning</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" />Re-scan</>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, WEBP — auto analyzed instantly
                  </p>
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
        </div>
      </Card>

      {result && (
        <Card className="glass-panel p-6 animate-glass-ripple">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold capitalize">
                  {result.verdict || result.category}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Confidence: {result.confidence}%
                </p>
              </div>
              <Progress value={result.confidence} className="h-3 w-1/2 glass-panel" />
            </div>
            <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">
              {result.analysis}
            </p>
            {result.detectionScores && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  ["AI Generation", result.detectionScores.aiGeneration],
                  ["Splicing", result.detectionScores.splicing],
                  ["Lighting Anomalies", result.detectionScores.lighting],
                  ["Metadata", result.detectionScores.metadata],
                ].map(([label, val]) => (
                  <div key={label as string} className="p-3 glass-panel rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">{label}</p>
                    <Progress value={val as number} className="h-2" />
                    <p className="text-xs font-medium mt-1">{val as number}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
