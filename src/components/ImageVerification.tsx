import { useState, useRef, useCallback } from "react";
import { useScans } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Sparkles, Camera, Info, Activity, Waves, Grid3x3 } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import exifr from "exifr";
import { analyzeImageForensics, type ForensicBundle } from "@/lib/forensicSignals";

/* ── Types ─────────────────────────────────── */
interface DetectedEffect {
  name: string;
  confidence: number;
  severity?: "subtle" | "moderate" | "strong";
}

interface Region {
  label: string;
  x: number; y: number; w: number; h: number;
  severity: "low" | "medium" | "high";
}

interface ImageResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "manipulated";
  verdict?: string;
  sourceType?: "camera" | "lightly-edited" | "heavily-edited" | "ai-generated";
  analysis: string;
  detectionScores?: { aiGeneration: number; splicing: number; lighting: number; metadata: number };
  forensicSummary?: {
    spectralVerdict?: "natural" | "suspicious" | "synthetic";
    noiseVerdict?: "natural" | "suspicious" | "synthetic";
    patchVerdict?: "consistent" | "inconsistent";
    ensembleVerdict?: "real" | "uncertain" | "ai-or-manipulated";
    fusedConfidence?: number;
  };
  effects?: DetectedEffect[];
  regions?: Region[];
}

interface ExifInfo {
  make?: string; model?: string; software?: string;
  dateTime?: string; gps?: boolean;
  width?: number; height?: number;
  iso?: number; focalLength?: number;
}

interface CompressionInfo {
  fileSize: number;
  megapixels: number;
  bytesPerPixel: number;
  anomaly: boolean;
  reason?: string;
}

/* ── Constants ─────────────────────────────── */
const SOURCE_LABELS: Record<string, string> = {
  camera: "Original camera photo",
  "lightly-edited": "Lightly edited",
  "heavily-edited": "Heavily edited",
  "ai-generated": "AI-generated",
};

const SEVERITY_CLS: Record<string, string> = {
  subtle: "bg-muted/40 border-border/50 text-foreground",
  moderate: "bg-warning/15 border-warning/40 text-warning",
  strong: "bg-destructive/15 border-destructive/40 text-destructive",
};

const REGION_BORDER: Record<string, string> = {
  low: "border-warning/70",
  medium: "border-orange-400/80",
  high: "border-destructive/90",
};

/* ── EXIF extractor ────────────────────────── */
async function extractExif(file: File): Promise<ExifInfo> {
  try {
    const raw = await exifr.parse(file, true);
    if (!raw) return {};
    return {
      make: raw.Make,
      model: raw.Model,
      software: raw.Software,
      dateTime: raw.DateTimeOriginal?.toLocaleString?.() || raw.DateTimeOriginal,
      gps: !!(raw.latitude || raw.longitude),
      width: raw.ImageWidth || raw.ExifImageWidth,
      height: raw.ImageHeight || raw.ExifImageHeight,
      iso: raw.ISO,
      focalLength: raw.FocalLength,
    };
  } catch {
    return {};
  }
}

function analyzeCompression(file: File, w: number, h: number): CompressionInfo {
  const mp = (w * h) / 1e6;
  const bpp = file.size / (w * h);
  let anomaly = false;
  let reason: string | undefined;
  if (bpp < 0.05 && file.type === "image/jpeg") { anomaly = true; reason = "Extremely low bytes-per-pixel — possible re-save or heavy compression"; }
  if (bpp > 8) { anomaly = true; reason = "Unusually high bytes-per-pixel — possible embedded data or raw capture"; }
  if (file.size > 15_000_000 && file.type === "image/jpeg") { anomaly = true; reason = "JPEG over 15 MB is unusual for standard photos"; }
  return { fileSize: file.size, megapixels: mp, bytesPerPixel: bpp, anomaly, reason };
}

/* ── Component ─────────────────────────────── */
export const ImageVerification = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [exifData, setExifData] = useState<ExifInfo | null>(null);
  const [compression, setCompression] = useState<CompressionInfo | null>(null);
  const [forensics, setForensics] = useState<ForensicBundle | null>(null);
  const [showRegions, setShowRegions] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { user } = useAuth();
  const { saveScan } = useScans();

  const runAnalysis = async (
    imageData: string,
    signals?: { exif?: ExifInfo; compression?: CompressionInfo; dimensions?: { width: number; height: number }; mime?: string },
    forensicBundle?: ForensicBundle | null
  ) => {
    setIsAnalyzing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-image", {
        body: { imageData, signals, forensics: forensicBundle ?? undefined },
      });
      if (error) throw error;
      if (data?.error && !data.category) throw new Error(data.error);
      setResult(data as ImageResult);
      if (user) {
        saveScan.mutate({
          scan_type: "image",
          input_label: "Image scan",
          file_path: null,
          verdict: data.verdict || data.category,
          confidence: data.confidence,
          source_type: data.sourceType || null,
          details: { ...data, forensics: forensicBundle ?? null },
          effects: data.effects || [],
        });
      }
      toast.success("Analysis complete");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }

    // Extract EXIF in parallel with reading the file
    const exifPromise = extractExif(file);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setSelectedImage(dataUrl);

      // Get natural dimensions for compression analysis (await so we can fuse signals server-side)
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = dataUrl;
      });
      const comp = analyzeCompression(file, dims.width, dims.height);
      setCompression(comp);

      const exif = await exifPromise;
      setExifData(exif);

      // Run multi-layered forensic ensemble (FFT, noise residual, edges, patches)
      const forensicBundle = await analyzeImageForensics(dataUrl);
      setForensics(forensicBundle);
      runAnalysis(dataUrl, { exif, compression: comp, dimensions: dims, mime: file.type }, forensicBundle);
    };
    reader.readAsDataURL(file);
  }, [user]);

  const badge = (() => {
    if (isAnalyzing) return { label: "Scanning…", sub: "AI forensic analysis in progress", icon: <Loader2 className="w-5 h-5 animate-spin" />, cls: "bg-primary/15 border-primary/40 text-primary" };
    if (!result) return null;
    if (result.category === "authentic") return { label: result.verdict || "Real", sub: `Authentic · ${result.confidence}%`, icon: <ShieldCheck className="w-5 h-5" />, cls: "bg-success/15 border-success/40 text-success" };
    if (result.category === "suspicious") return { label: result.verdict || "Suspicious", sub: `Possible manipulation · ${result.confidence}%`, icon: <AlertTriangle className="w-5 h-5" />, cls: "bg-warning/15 border-warning/40 text-warning" };
    return { label: result.verdict || "AI / Manipulated", sub: `Inauthentic · ${result.confidence}%`, icon: <ShieldAlert className="w-5 h-5" />, cls: "bg-destructive/15 border-destructive/40 text-destructive" };
  })();

  const regions = result?.regions ?? [];

  return (
    <div className="space-y-6">
      {/* ── Upload & Image Preview ────────────── */}
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-all cursor-pointer glass-panel animate-lift overflow-hidden"
          >
            {selectedImage ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img ref={imgRef} src={selectedImage} alt="Selected" className="max-h-96 mx-auto rounded-lg object-contain" />

                  {/* Region overlays */}
                  {showRegions && regions.length > 0 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
                      {regions.map((r, i) => (
                        <g key={i}>
                          <rect
                            x={r.x} y={r.y} width={r.w} height={r.h}
                            fill={r.severity === "high" ? "rgba(239,68,68,0.15)" : r.severity === "medium" ? "rgba(249,115,22,0.12)" : "rgba(234,179,8,0.1)"}
                            stroke={r.severity === "high" ? "#ef4444" : r.severity === "medium" ? "#f97316" : "#eab308"}
                            strokeWidth="0.003"
                            rx="0.005"
                          />
                          <text
                            x={r.x + 0.005} y={r.y + r.h - 0.008}
                            fill="white" fontSize="0.022" fontWeight="600"
                            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                          >
                            {r.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  )}

                  {/* Badge overlay */}
                  {badge && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className={`absolute top-3 left-3 flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md ${badge.cls} shadow-lg`}
                    >
                      {badge.icon}
                      <div className="text-left leading-tight">
                        <div className="text-xs font-bold">{badge.label}</div>
                        <div className="text-[10px] opacity-80">{badge.sub}</div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex gap-2 justify-center flex-wrap">
                  {regions.length > 0 && (
                    <Button variant="outline" size="sm" className="glass-panel text-xs" onClick={(e) => { e.stopPropagation(); setShowRegions(!showRegions); }}>
                      {showRegions ? "Hide regions" : "Show regions"}
                    </Button>
                  )}
                  <Button variant="outline" className="glass-panel" onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setResult(null); setExifData(null); setCompression(null); setForensics(null); }}>
                    Remove
                  </Button>
                  <Button className="bg-gradient-primary" disabled={isAnalyzing} onClick={(e) => { e.stopPropagation(); if (selectedImage) runAnalysis(selectedImage, undefined, forensics); }}>
                    {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Re-scanning</> : <><Sparkles className="mr-2 h-4 w-4" />Re-scan</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drop or click to upload</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — auto analyzed instantly</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>
        </div>
      </Card>

      {/* ── EXIF & Compression Panel ─────────── */}
      <AnimatePresence>
        {(exifData && Object.keys(exifData).length > 0) || compression ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="glass-panel p-5 animate-glass-fade">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Metadata & Compression</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {exifData?.make && <MetaItem label="Camera" value={`${exifData.make} ${exifData.model || ""}`} />}
                {exifData?.software && <MetaItem label="Software" value={exifData.software} />}
                {exifData?.dateTime && <MetaItem label="Date Taken" value={exifData.dateTime} />}
                {exifData?.iso && <MetaItem label="ISO" value={String(exifData.iso)} />}
                {exifData?.focalLength && <MetaItem label="Focal Length" value={`${exifData.focalLength}mm`} />}
                {exifData?.gps !== undefined && <MetaItem label="GPS" value={exifData.gps ? "Present" : "None"} />}
                {compression && <MetaItem label="File Size" value={`${(compression.fileSize / 1024).toFixed(0)} KB`} />}
                {compression && <MetaItem label="Resolution" value={`${compression.megapixels.toFixed(1)} MP`} />}
              </div>
              {compression?.anomaly && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-warning">Compression Anomaly Detected</p>
                    <p className="text-xs text-muted-foreground">{compression.reason}</p>
                  </div>
                </div>
              )}
              {exifData && !exifData.make && !exifData.software && !exifData.dateTime && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">No EXIF metadata found — this often indicates the image was stripped, screenshot, or AI-generated.</p>
                </div>
              )}
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Forensic Ensemble Panel ─────────── */}
      <AnimatePresence>
        {forensics && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="glass-panel p-5 animate-glass-fade">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Multi-layered Forensic Ensemble
                  </h3>
                </div>
                <div className={`px-3 py-1 rounded-full border text-xs font-bold ${
                  forensics.ensembleScore >= 65 ? "bg-destructive/15 border-destructive/40 text-destructive" :
                  forensics.ensembleScore >= 35 ? "bg-warning/15 border-warning/40 text-warning" :
                  "bg-success/15 border-success/40 text-success"
                }`}>
                  Ensemble: {forensics.ensembleScore}/100
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ForensicLayer
                  icon={<Waves className="h-4 w-4" />}
                  title="Spectral (FFT)"
                  score={forensics.spectral.syntheticScore}
                  details={[
                    ["High-freq ratio", forensics.spectral.highFreqRatio.toFixed(3)],
                    ["Spectral slope", forensics.spectral.spectralSlope.toFixed(2)],
                  ]}
                />
                <ForensicLayer
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Sensor Noise (PRNU)"
                  score={forensics.noise.cleanlinessScore}
                  details={[
                    ["Noise mean", forensics.noise.noiseMean.toFixed(2)],
                    ["Noise std", forensics.noise.noiseStd.toFixed(2)],
                  ]}
                />
                <ForensicLayer
                  icon={<Activity className="h-4 w-4" />}
                  title="Edge Consistency"
                  score={forensics.edges.softnessScore}
                  details={[
                    ["Edge density", forensics.edges.edgeDensity.toFixed(1)],
                    ["Edge std", forensics.edges.edgeStd.toFixed(1)],
                  ]}
                />
                <ForensicLayer
                  icon={<Grid3x3 className="h-4 w-4" />}
                  title="Patch-based Local"
                  score={forensics.patch.manipulationScore}
                  details={[
                    ["Variance-of-var", forensics.patch.varianceOfVariance.toFixed(0)],
                    ["Noise inconsist.", forensics.patch.noiseInconsistency.toFixed(2)],
                  ]}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Spatial CNN signals + Fast Fourier spectrum + sensor-noise residual + 8×8 patch consistency are fused into the ensemble score above and sent to the AI model for the final verdict.
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Result Panel ──────────────────── */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="glass-panel p-6 animate-glass-ripple">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold capitalize">{result.verdict || result.category}</h3>
                    <p className="text-sm text-muted-foreground">
                      Confidence: {result.confidence}%
                      {result.sourceType && <> · <span className="font-medium">{SOURCE_LABELS[result.sourceType] || result.sourceType}</span></>}
                    </p>
                  </div>
                  <Progress value={result.confidence} className="h-3 w-1/2 glass-panel" />
                </div>

                {/* Suspicious Regions list */}
                {regions.length > 0 && (
                  <div className="space-y-2 border-t border-border/50 pt-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Suspicious Regions ({regions.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {regions.map((r, i) => (
                        <span key={i} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${REGION_BORDER[r.severity]} bg-background/50`}>
                          {r.label}
                          <span className="ml-1 opacity-60 capitalize">{r.severity}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Effects */}
                {result.effects && result.effects.length > 0 && (
                  <div className="space-y-2 border-t border-border/50 pt-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Detected edits & effects</p>
                    <div className="flex flex-wrap gap-2">
                      {result.effects.map((eff, i) => (
                        <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${SEVERITY_CLS[eff.severity || "subtle"]}`} title={`${eff.confidence}% confidence`}>
                          <span className="font-medium">{eff.name}</span>
                          <span className="opacity-70">{eff.confidence}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">{result.analysis}</p>

                {/* Detection Scores */}
                {result.detectionScores && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {([["AI Generation", result.detectionScores.aiGeneration], ["Splicing", result.detectionScores.splicing], ["Lighting Anomalies", result.detectionScores.lighting], ["Metadata", result.detectionScores.metadata]] as const).map(([label, val]) => (
                      <div key={label} className="p-3 glass-panel rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">{label}</p>
                        <Progress value={val} className="h-2" />
                        <p className="text-xs font-medium mt-1">{val}%</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Small metadata item ───────────────────── */
function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg glass-panel">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}

/* ── Forensic layer card ───────────────────── */
function ForensicLayer({
  icon, title, score, details,
}: {
  icon: React.ReactNode;
  title: string;
  score: number;
  details: [string, string][];
}) {
  const tone = score >= 60 ? "text-destructive" : score >= 30 ? "text-warning" : "text-success";
  return (
    <div className="p-3 glass-panel rounded-lg border border-border/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className={tone}>{icon}</span>
          {title}
        </div>
        <span className={`text-xs font-bold ${tone}`}>{score}/100</span>
      </div>
      <Progress value={score} className="h-1.5 mb-2" />
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        {details.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
