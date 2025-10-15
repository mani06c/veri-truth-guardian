import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface ImageResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "manipulated";
  analysis: string;
}

export const ImageVerification = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    setResult(null);

    try {
      // Simulate analysis with a delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Mock result - in production, this would use actual deepfake detection models
      const mockConfidence = Math.random() * 100;
      const mockResult: ImageResult = {
        isAuthentic: mockConfidence > 60,
        confidence: mockConfidence,
        category: mockConfidence > 70 ? "authentic" : mockConfidence > 40 ? "suspicious" : "manipulated",
        analysis: mockConfidence > 70 
          ? "No signs of manipulation detected. Image appears to be authentic with consistent lighting, natural facial features, and proper pixel patterns."
          : mockConfidence > 40
          ? "Some anomalies detected. Possible minor edits or compression artifacts. Recommend additional verification for critical use cases."
          : "High probability of AI manipulation detected. Inconsistent textures, unnatural facial features, and suspicious pixel patterns identified."
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
      case "manipulated":
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
      case "manipulated":
        return "border-destructive/20 bg-destructive/5";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-lg border-2">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Upload image to verify
            </label>
            
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
            >
              {selectedImage ? (
                <div className="space-y-4">
                  <img
                    src={selectedImage}
                    alt="Uploaded"
                    className="max-h-64 mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    Click to change image
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPG, WEBP up to 10MB
                  </p>
                </div>
              )}
            </div>
            
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
            disabled={isAnalyzing || !selectedImage}
            className="w-full bg-gradient-primary hover:opacity-90"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Image...
              </>
            ) : (
              "Verify Image"
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
