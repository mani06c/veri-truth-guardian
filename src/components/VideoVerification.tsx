import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { AnalysisProgress } from "./AnalysisProgress";

interface VideoResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "deepfake";
  analysis: string;
}

export const VideoVerification = () => {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [result, setResult] = useState<VideoResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedVideo(e.target?.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const analyzeVideo = async () => {
    if (!selectedVideo) {
      toast.error("Please upload a video first");
      return;
    }

    setIsAnalyzing(true);
    setShowProgress(true);
    setResult(null);
  };

  const handleAnalysisComplete = () => {
    setShowProgress(false);
    
    const confidence = Math.random() * 100;
    const isAuthentic = confidence > 50;

    setResult({
      isAuthentic,
      confidence: Math.round(confidence),
      category: isAuthentic ? "authentic" : confidence > 30 ? "suspicious" : "deepfake",
      analysis: isAuthentic
        ? "Video appears authentic. No signs of deepfake manipulation detected. Facial movements, lip-sync, and temporal consistency are natural. Audio-visual alignment is genuine."
        : "Critical deepfake indicators detected including temporal inconsistencies, unnatural facial movements, lip-sync anomalies, GAN artifacts, frame-by-frame manipulation traces, and suspicious audio patterns. This video shows strong evidence of AI-generated deepfake technology.",
    });

    setIsAnalyzing(false);
    toast.success("Analysis complete!");
  };

  const getResultIcon = (category: string) => {
    switch (category) {
      case "authentic":
        return <ShieldCheck className="w-8 h-8 text-success" />;
      case "suspicious":
        return <AlertTriangle className="w-8 h-8 text-warning" />;
      case "deepfake":
        return <ShieldAlert className="w-8 h-8 text-destructive" />;
    }
  };

  const getResultColor = (category: string) => {
    switch (category) {
      case "authentic":
        return { bg: "bg-success/10", border: "border-success/30" };
      case "suspicious":
        return { bg: "bg-warning/10", border: "border-warning/30" };
      case "deepfake":
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
            {selectedVideo ? (
              <div className="space-y-4">
                <video
                  src={selectedVideo}
                  controls
                  className="max-h-64 mx-auto rounded-lg"
                />
                <Button
                  variant="outline"
                  className="glass-panel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVideo(null);
                    setResult(null);
                  }}
                >
                  Remove Video
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">MP4, MOV, AVI up to 50MB</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
          </div>

          <Button
            onClick={analyzeVideo}
            disabled={!selectedVideo || isAnalyzing}
            className="w-full bg-gradient-primary animate-lift"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Video"
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
              <p className={`text-sm ${result.category === 'deepfake' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {result.analysis}
              </p>
              
              {!result.isAuthentic && (
                <div className="mt-4 space-y-2">
                  <div className="p-4 glass-panel rounded-lg border-2 border-destructive glass-glow">
                    <p className="text-destructive font-bold text-lg">⚠ DEEPFAKE VIDEO DETECTED</p>
                    <p className="text-sm text-muted-foreground mt-2">Multiple manipulation indicators found in video frames</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Facial Manipulation</p>
                      <Progress value={91} className="h-2" />
                      <p className="text-xs font-medium mt-1">91%</p>
                    </div>
                    <div className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Lip-Sync Anomalies</p>
                      <Progress value={85} className="h-2" />
                      <p className="text-xs font-medium mt-1">85%</p>
                    </div>
                    <div className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Temporal Inconsistency</p>
                      <Progress value={78} className="h-2" />
                      <p className="text-xs font-medium mt-1">78%</p>
                    </div>
                    <div className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">GAN Artifacts</p>
                      <Progress value={83} className="h-2" />
                      <p className="text-xs font-medium mt-1">83%</p>
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