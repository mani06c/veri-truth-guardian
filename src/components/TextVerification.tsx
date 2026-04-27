import { useState } from "react";
import { useScans } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Brain, MessageCircleWarning, History, FileSearch, GitCompare } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { AnalysisProgress } from "./AnalysisProgress";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PropagandaTechnique { name: string; confidence: number; example: string }
interface ManipulationTactic { tactic: string; severity: "low" | "medium" | "high" }
interface FactCheck { claim: string; status: "supported" | "unverified" | "contradicted"; note?: string }
interface TextResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "fake";
  verdict?: "Real" | "Misleading" | "Fake";
  probabilities?: { real: number; misleading: number; fake: number };
  analysis: string;
  indicators?: string[];
  scores?: {
    fakeNewsProbability: number; propagandaLevel: number; biasScore: number;
    sentimentManipulation: number; sourceCredibility: number; aiGeneratedProbability: number;
  };
  biasDirection?: string;
  propagandaTechniques?: PropagandaTechnique[];
  manipulationTactics?: ManipulationTactic[];
  factChecks?: FactCheck[];
  historicalContext?: string;
  inconsistencies?: string[];
  layerSignals?: { semantic: number; factCheck: number; historical: number; consistency: number; propaganda: number; sourceCredibility: number };
  aiExplanation?: string;
}

const SEVERITY_CLS: Record<string, string> = {
  low: "bg-muted/40 border-border/50 text-foreground",
  medium: "bg-warning/15 border-warning/40 text-warning",
  high: "bg-destructive/15 border-destructive/40 text-destructive",
};

const BIAS_COLORS: Record<string, string> = {
  left: "text-blue-500", "center-left": "text-sky-500", center: "text-success",
  "center-right": "text-orange-400", right: "text-red-500", unknown: "text-muted-foreground",
};

export const TextVerification = () => {
  const [text, setText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [result, setResult] = useState<TextResult | null>(null);
  const { user } = useAuth();
  const { saveScan } = useScans();

  const analyzeText = () => {
    if (!text.trim()) { toast.error("Please enter some text to analyze"); return; }
    setIsAnalyzing(true); setShowProgress(true); setResult(null);
  };

  const handleAnalysisComplete = async () => {
    setShowProgress(false);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("verify-text", { body: { text } });
      if (error) throw error;
      setResult(data as TextResult);
      if (user) {
        saveScan.mutate({
          scan_type: "text", input_label: text.slice(0, 80), file_path: null,
          verdict: data.category, confidence: data.confidence, source_type: null, details: data, effects: [],
        });
      }
      toast.success("Analysis complete!");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Analysis failed. Please try again.");
      setResult({ isAuthentic: false, confidence: 0, category: "fake", analysis: "An error occurred during analysis. Please try again." });
    } finally { setIsAnalyzing(false); }
  };

  const icon = (cat: string) => cat === "authentic" ? <ShieldCheck className="w-6 h-6 text-success" /> : cat === "suspicious" ? <AlertTriangle className="w-6 h-6 text-warning" /> : <ShieldAlert className="w-6 h-6 text-destructive" />;
  const catCls = (cat: string) => cat === "authentic" ? "bg-success/10" : cat === "suspicious" ? "bg-warning/10" : "bg-destructive/10";

  // Derive a clear top-line verdict tag: Real / AI-Generated / Fake News / Manipulated / Suspicious
  const deriveTag = (r: TextResult): { tag: string; metricLabel: string; metricValue: number; cls: string } => {
    // If the backend ensemble produced explicit Real/Misleading/Fake probabilities, trust them.
    if (r.probabilities && r.verdict) {
      const p = r.probabilities;
      if (r.verdict === "Real")
        return { tag: "REAL NEWS", metricLabel: "Real Probability", metricValue: p.real, cls: "bg-success/15 border-success/50 text-success" };
      if (r.verdict === "Misleading")
        return { tag: "MISLEADING", metricLabel: "Misleading Probability", metricValue: p.misleading, cls: "bg-warning/15 border-warning/50 text-warning" };
      return { tag: "FAKE NEWS", metricLabel: "Fake Probability", metricValue: p.fake, cls: "bg-destructive/15 border-destructive/50 text-destructive" };
    }
    const s = r.scores;
    const ai = s?.aiGeneratedProbability ?? 0;
    const fake = s?.fakeNewsProbability ?? 0;
    const prop = s?.propagandaLevel ?? 0;
    const manip = Math.max(prop, s?.sentimentManipulation ?? 0);
    if (r.category === "authentic" && ai < 60 && fake < 40)
      return { tag: "REAL CONTENT", metricLabel: "Authenticity Score", metricValue: r.confidence, cls: "bg-success/15 border-success/50 text-success" };
    if (ai >= 70)
      return { tag: "AI-GENERATED", metricLabel: "AI Generated Probability", metricValue: ai, cls: "bg-primary/15 border-primary/50 text-primary" };
    if (fake >= 65 || r.category === "fake")
      return { tag: "FAKE NEWS", metricLabel: "Fake News Probability", metricValue: Math.max(fake, r.confidence), cls: "bg-destructive/15 border-destructive/50 text-destructive" };
    if (manip >= 60)
      return { tag: "MANIPULATED", metricLabel: "Manipulation Probability", metricValue: manip, cls: "bg-warning/15 border-warning/50 text-warning" };
    return { tag: "SUSPICIOUS", metricLabel: "Risk Score", metricValue: r.confidence, cls: "bg-warning/15 border-warning/50 text-warning" };
  };

  if (showProgress) return <AnalysisProgress onComplete={handleAnalysisComplete} />;

  return (
    <div className="space-y-6">
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <Textarea placeholder="Paste the text you want to verify…" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[200px] resize-none glass-panel" />
          <Button onClick={analyzeText} disabled={isAnalyzing} className="w-full bg-gradient-primary animate-lift" size="lg">
            {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : "Verify Text"}
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Hero verdict tag */}
            {(() => {
              const t = deriveTag(result);
              return (
                <Card className={`glass-panel p-6 border-2 ${t.cls} animate-glass-ripple`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-70 mb-1">Verdict</p>
                      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{t.tag}</h2>
                      <p className="text-xs opacity-70 mt-1">{t.metricLabel}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl md:text-5xl font-extrabold tabular-nums">{Math.round(t.metricValue)}%</div>
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* Real / Misleading / Fake probability breakdown */}
            {result.probabilities && (
              <Card className="glass-panel p-5 animate-glass-ripple">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Probability Breakdown</p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ["Real", result.probabilities.real, "success"],
                    ["Misleading", result.probabilities.misleading, "warning"],
                    ["Fake", result.probabilities.fake, "destructive"],
                  ] as const).map(([label, val, tone]) => (
                    <div key={label} className={`p-3 rounded-lg glass-panel border ${tone === "success" ? "border-success/40" : tone === "warning" ? "border-warning/40" : "border-destructive/40"}`}>
                      <p className={`text-xs font-medium ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive"}`}>{label}</p>
                      <p className="text-2xl font-extrabold tabular-nums mt-1">{val}%</p>
                      <Progress value={val} className="h-1.5 mt-2" />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Final classification chosen by highest probability via ensemble of semantic, fact-check, historical and consistency layers.
                </p>
              </Card>
            )}

            {/* Verdict */}
            <Card className="glass-panel p-6 animate-glass-ripple">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full glass-glow ${catCls(result.category)}`}>{icon(result.category)}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold capitalize">{result.category}</h3>
                    <p className="text-sm text-muted-foreground">Confidence: {result.confidence}%
                      {result.biasDirection && result.biasDirection !== "unknown" && <> · Bias: <span className={`font-medium capitalize ${BIAS_COLORS[result.biasDirection] || ""}`}>{result.biasDirection}</span></>}
                    </p>
                  </div>
                  <Progress value={result.confidence} className="h-3 w-1/3 glass-panel" />
                </div>

                <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">{result.analysis}</p>

                {!result.isAuthentic && (
                  <div className="p-4 glass-panel rounded-lg border-2 border-destructive glass-glow">
                    <p className="text-destructive font-bold text-lg">⚠ FAKE NEWS DETECTED</p>
                    <p className="text-sm text-muted-foreground mt-1">This content shows multiple signs of misinformation</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Scores radar */}
            {result.scores && (
              <Card className="glass-panel p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Threat Scores</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {([
                    ["Fake News", result.scores.fakeNewsProbability],
                    ["Propaganda", result.scores.propagandaLevel],
                    ["Bias", result.scores.biasScore],
                    ["Sentiment Manipulation", result.scores.sentimentManipulation],
                    ["Source Credibility", result.scores.sourceCredibility],
                    ["AI-Generated", result.scores.aiGeneratedProbability],
                  ] as const).map(([label, val]) => (
                    <div key={label} className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">{label}</p>
                      <Progress value={val} className="h-2" />
                      <p className="text-xs font-medium mt-1">{val}%</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Propaganda techniques */}
            {result.propagandaTechniques && result.propagandaTechniques.length > 0 && (
              <Card className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircleWarning className="h-4 w-4 text-warning" />
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Propaganda Techniques</p>
                </div>
                <div className="space-y-2">
                  {result.propagandaTechniques.map((pt, i) => (
                    <div key={i} className="p-3 glass-panel rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{pt.name}</span>
                        <span className="text-xs text-muted-foreground">{pt.confidence}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic">"{pt.example}"</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Manipulation tactics */}
            {result.manipulationTactics && result.manipulationTactics.length > 0 && (
              <Card className="glass-panel p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Manipulation Tactics</p>
                <div className="flex flex-wrap gap-2">
                  {result.manipulationTactics.map((mt, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${SEVERITY_CLS[mt.severity]}`}>{mt.tactic}</span>
                  ))}
                </div>
              </Card>
            )}

            {/* Fact checks */}
            {result.factChecks && result.factChecks.length > 0 && (
              <Card className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileSearch className="h-4 w-4 text-primary" />
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Claim Fact-Check</p>
                </div>
                <div className="space-y-2">
                  {result.factChecks.map((fc, i) => {
                    const cls = fc.status === "supported"
                      ? "border-success/40 bg-success/10 text-success"
                      : fc.status === "contradicted"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-warning/40 bg-warning/10 text-warning";
                    return (
                      <div key={i} className="p-3 glass-panel rounded-lg">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium flex-1">"{fc.claim}"</p>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${cls}`}>{fc.status}</span>
                        </div>
                        {fc.note && <p className="text-xs text-muted-foreground">{fc.note}</p>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Historical context */}
            {result.historicalContext && result.historicalContext.trim() && (
              <Card className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-2">
                  <History className="h-4 w-4 text-primary" />
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Historical Context</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{result.historicalContext}</p>
              </Card>
            )}

            {/* Inconsistencies */}
            {result.inconsistencies && result.inconsistencies.length > 0 && (
              <Card className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  <GitCompare className="h-4 w-4 text-warning" />
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Inconsistencies & Unsupported Statements</p>
                </div>
                <ul className="space-y-1.5">
                  {result.inconsistencies.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-warning mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* AI Explanation */}
            {result.aiExplanation && (
              <Card className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-4 w-4 text-primary" />
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Expert Explanation</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{result.aiExplanation}</p>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
