import { useState, useRef, useEffect, useCallback } from "react";
import { useScans } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface FrameResult {
  timestamp: number;
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "deepfake";
  verdict?: string;
  analysis: string;
  detectionScores?: {
    facialManipulation: number;
    lipSync: number;
    temporalConsistency: number;
    ganArtifacts: number;
    voiceAuthenticity?: number;
  };
  suspiciousRegions?: { area: string; severity: "low" | "medium" | "high" }[];
  frameFlags?: string[];
}

const SCAN_INTERVAL_MS = 5000;

export const VideoVerification = () => {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [latest, setLatest] = useState<FrameResult | null>(null);
  const { user } = useAuth();
  const { saveScan } = useScans();
  const [history, setHistory] = useState<FrameResult[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inflightRef = useRef(false);
  const intervalRef = useRef<number | null>(null);

  const captureFrame = (): { dataUrl: string; t: number } | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (!video.videoWidth || !video.videoHeight) return null;
    // Downscale for faster upload
    const maxDim = 720;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), t: video.currentTime };
  };

  const scanOnce = useCallback(async () => {
    if (inflightRef.current) return;
    const cap = captureFrame();
    if (!cap) return;
    inflightRef.current = true;
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-video", {
        body: { frame: cap.dataUrl, timestamp: cap.t },
      });
      if (error) throw error;
      if (data?.error && !data.category) throw new Error(data.error);
      const r: FrameResult = { ...data, timestamp: data.timestamp ?? cap.t };
      setLatest(r);
      setHistory((h) => [r, ...h].slice(0, 8));
      if (user) {
        saveScan.mutate({
          scan_type: "video",
          input_label: `Video frame @${Math.round(r.timestamp)}s`,
          file_path: null,
          verdict: r.verdict || r.category,
          confidence: r.confidence,
          source_type: null,
          details: r,
          effects: [],
        });
      }
    } catch (err) {
      console.error("Frame analysis error:", err);
      toast.error(err instanceof Error ? err.message : "Frame analysis failed");
    } finally {
      inflightRef.current = false;
      setIsScanning(false);
    }
  }, []);

  // Periodic scan while video is playing
  useEffect(() => {
    if (!selectedVideo || !autoScan) return;
    const video = videoRef.current;
    if (!video) return;

    const start = () => {
      if (intervalRef.current) return;
      // Initial immediate scan
      scanOnce();
      intervalRef.current = window.setInterval(scanOnce, SCAN_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onPlay = () => start();
    const onPause = () => stop();
    const onEnded = () => stop();

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    if (!video.paused) start();

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      stop();
    };
  }, [selectedVideo, autoScan, scanOnce]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedVideo(ev.target?.result as string);
      setLatest(null);
      setHistory([]);
    };
    reader.readAsDataURL(file);
  };

  const badge = (() => {
    if (isScanning && !latest) {
      return { label: "Scanning…", sub: "Analyzing first frame", icon: <Loader2 className="w-5 h-5 animate-spin" />, cls: "bg-primary/15 border-primary/40 text-primary" };
    }
    if (!latest) return null;
    const sub = `t=${latest.timestamp.toFixed(1)}s · ${latest.confidence}% confidence`;
    if (latest.category === "authentic") {
      return { label: latest.verdict || "Real", sub, icon: <ShieldCheck className="w-5 h-5" />, cls: "bg-success/15 border-success/40 text-success" };
    }
    if (latest.category === "suspicious") {
      return { label: latest.verdict || "Suspicious", sub, icon: <AlertTriangle className="w-5 h-5" />, cls: "bg-warning/15 border-warning/40 text-warning" };
    }
    return { label: latest.verdict || "Deepfake", sub, icon: <ShieldAlert className="w-5 h-5" />, cls: "bg-destructive/15 border-destructive/40 text-destructive" };
  })();

  return (
    <div className="space-y-6">
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <div
            onClick={() => !selectedVideo && fileInputRef.current?.click()}
            className={`border-2 border-dashed border-border/50 rounded-lg p-6 text-center transition-all glass-panel ${selectedVideo ? "" : "hover:border-primary/50 cursor-pointer animate-lift"}`}
          >
            {selectedVideo ? (
              <div className="space-y-4">
                <div className="relative inline-block w-full">
                  <video
                    ref={videoRef}
                    src={selectedVideo}
                    controls
                    crossOrigin="anonymous"
                    className="max-h-80 mx-auto rounded-lg w-full object-contain bg-black"
                  />
                  {badge && (
                    <div className={`absolute top-3 left-3 flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md ${badge.cls} shadow-lg`}>
                      {badge.icon}
                      <div className="text-left leading-tight">
                        <div className="text-xs font-bold">{badge.label}</div>
                        <div className="text-[10px] opacity-80">{badge.sub}</div>
                      </div>
                    </div>
                  )}
                  {isScanning && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-background/60 backdrop-blur-md text-xs">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Live scan
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button
                    variant="outline"
                    className="glass-panel"
                    onClick={() => {
                      setSelectedVideo(null);
                      setLatest(null);
                      setHistory([]);
                    }}
                  >
                    Remove
                  </Button>
                  <Button
                    variant="outline"
                    className="glass-panel"
                    onClick={() => setAutoScan((v) => !v)}
                  >
                    {autoScan ? <><Pause className="mr-2 h-4 w-4" />Pause auto-scan</> : <><Play className="mr-2 h-4 w-4" />Resume auto-scan</>}
                  </Button>
                  <Button className="bg-gradient-primary" onClick={scanOnce} disabled={isScanning}>
                    {isScanning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning</> : "Scan now"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-scan runs every {SCAN_INTERVAL_MS / 1000}s while the video is playing.
                </p>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP4, MOV, WEBM — frames auto-analyzed during playback
                  </p>
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
        </div>
      </Card>

      {latest && (
        <Card className="glass-panel p-6 animate-glass-ripple">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{latest.verdict || latest.category}</h3>
                <p className="text-sm text-muted-foreground">
                  Frame at {latest.timestamp.toFixed(1)}s · Confidence {latest.confidence}%
                </p>
              </div>
              <Progress value={latest.confidence} className="h-3 w-1/2 glass-panel" />
            </div>
            <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">{latest.analysis}</p>

            {latest.detectionScores && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {([
                  ["Facial Manipulation", latest.detectionScores.facialManipulation],
                  ["Lip-Sync Anomalies", latest.detectionScores.lipSync],
                  ["Temporal Inconsistency", latest.detectionScores.temporalConsistency],
                  ["GAN Artifacts", latest.detectionScores.ganArtifacts],
                  ...(latest.detectionScores.voiceAuthenticity != null ? [["Voice Authenticity", latest.detectionScores.voiceAuthenticity] as const] : []),
                ] as const).map(([label, val]) => (
                  <div key={label as string} className="p-3 glass-panel rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">{label}</p>
                    <Progress value={val as number} className="h-2" />
                    <p className="text-xs font-medium mt-1">{val as number}%</p>
                  </div>
                ))}
              </div>
            )}

            {latest.suspiciousRegions && latest.suspiciousRegions.length > 0 && (
              <div className="border-t border-border/50 pt-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Suspicious Regions</p>
                <div className="flex flex-wrap gap-2">
                  {latest.suspiciousRegions.map((r, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${r.severity === "high" ? "bg-destructive/15 border-destructive/40 text-destructive" : r.severity === "medium" ? "bg-warning/15 border-warning/40 text-warning" : "bg-muted/40 border-border/50 text-foreground"}`}>
                      {r.area} <span className="opacity-60 capitalize ml-1">{r.severity}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {latest.frameFlags && latest.frameFlags.length > 0 && (
              <div className="border-t border-border/50 pt-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Frame Flags</p>
                <div className="flex flex-wrap gap-2">
                  {latest.frameFlags.map((f, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full border border-border/50 bg-muted/30 text-xs">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {history.length > 1 && (
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recent frames</p>
                <div className="flex gap-2 flex-wrap">
                  {history.map((h, i) => (
                    <div
                      key={i}
                      className={`px-2 py-1 rounded-md text-xs border ${
                        h.category === "authentic"
                          ? "bg-success/10 border-success/30 text-success"
                          : h.category === "suspicious"
                          ? "bg-warning/10 border-warning/30 text-warning"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {h.timestamp.toFixed(1)}s · {h.confidence}%
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
