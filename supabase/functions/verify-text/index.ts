import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');
    if (!text) return new Response(JSON.stringify({ error: 'text is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    console.log('Analyzing text for fake news, propaganda, bias...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert forensic news analyst that performs MULTI-LAYERED NLP analysis to classify content as Real, Misleading, or Fake.

Run the following layers and combine them with an ensemble decision:

LAYER 1 — Semantic Analysis: understand context, tone, intent. Flag exaggerated, sensational, biased or emotionally loaded language patterns common in fake news.
LAYER 2 — Claim & Entity Fact-Check: extract the key claims, named entities, dates and events. Cross-check them against your trained knowledge of verified, reliable sources. Mark each claim as supported, unverified, or contradicted.
LAYER 3 — Historical Context: detect whether the news refers to past events and whether it has been altered, misrepresented, recycled, or taken out of context over time.
LAYER 4 — Internal Consistency: detect contradictions, unsupported statements, missing attribution, fabricated quotes or statistics.
LAYER 5 — Propaganda / Manipulation: bandwagon, appeal to fear, loaded language, false dichotomy, ad hominem, straw man, whataboutism, urgency manufacturing.
LAYER 6 — Source Credibility & AI-generation signals.

ENSEMBLE: combine the layers into three calibrated probabilities that SUM TO 100:
  realProbability + misleadingProbability + fakeProbability = 100
The final classification ("verdict") MUST be the label with the highest probability.

Return ONLY valid JSON, no markdown:
{
  "verdict": "Real" | "Misleading" | "Fake",
  "probabilities": { "real": number, "misleading": number, "fake": number },
  "isAuthentic": boolean,
  "confidence": number,
  "category": "authentic" | "suspicious" | "fake",
  "analysis": "3-5 sentence expert explanation citing specific evidence from the text",
  "indicators": ["list of specific red flags found"],
  "scores": {
    "fakeNewsProbability": number,
    "propagandaLevel": number,
    "biasScore": number,
    "sentimentManipulation": number,
    "sourceCredibility": number,
    "aiGeneratedProbability": number
  },
  "biasDirection": "left" | "center-left" | "center" | "center-right" | "right" | "unknown",
  "propagandaTechniques": [
    { "name": "technique name", "confidence": number, "example": "quoted text from input" }
  ],
  "manipulationTactics": [
    { "tactic": "short label", "severity": "low" | "medium" | "high" }
  ],
  "factChecks": [
    { "claim": "specific claim from the text", "status": "supported" | "unverified" | "contradicted", "note": "1 sentence explanation" }
  ],
  "historicalContext": "1-3 sentences on whether this refers to past events and if it has been altered, recycled, or taken out of context. Empty string if not applicable.",
  "inconsistencies": ["short bullet describing each contradiction or unsupported statement"],
  "layerSignals": {
    "semantic": number,
    "factCheck": number,
    "historical": number,
    "consistency": number,
    "propaganda": number,
    "sourceCredibility": number
  },
  "aiExplanation": "A plain-English paragraph explaining WHY this content is Real, Misleading or Fake, written for a general audience"
}

Rules:
- All scores 0-100. Higher score = stronger signal of that dimension.
- "isAuthentic" = (verdict === "Real").
- "category": Real → "authentic", Misleading → "suspicious", Fake → "fake".
- "confidence" = the WINNING probability from "probabilities".
- Be decisive and evidence-based. Quote the input where possible.`
          },
          { role: 'user', content: `Analyze this text:\n\n${text}` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit reached, please try again shortly.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in Lovable Cloud settings.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    console.log('AI Response:', resultText);

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');
    const result = JSON.parse(jsonMatch[0]);

    // Normalize probabilities to sum to 100 and align verdict/category
    const p = result.probabilities || {};
    let real = Math.max(0, Number(p.real) || 0);
    let mis = Math.max(0, Number(p.misleading) || 0);
    let fake = Math.max(0, Number(p.fake) || 0);
    const sum = real + mis + fake;
    if (sum > 0 && Math.abs(sum - 100) > 0.5) {
      real = (real / sum) * 100;
      mis = (mis / sum) * 100;
      fake = (fake / sum) * 100;
    }
    real = Math.round(real); mis = Math.round(mis); fake = Math.round(fake);
    // Fix rounding drift
    const drift = 100 - (real + mis + fake);
    if (drift !== 0) {
      const top = Math.max(real, mis, fake);
      if (top === real) real += drift;
      else if (top === mis) mis += drift;
      else fake += drift;
    }
    result.probabilities = { real, misleading: mis, fake };
    const winner = real >= mis && real >= fake ? 'Real' : mis >= fake ? 'Misleading' : 'Fake';
    result.verdict = winner;
    result.confidence = winner === 'Real' ? real : winner === 'Misleading' ? mis : fake;
    result.isAuthentic = winner === 'Real';
    result.category = winner === 'Real' ? 'authentic' : winner === 'Misleading' ? 'suspicious' : 'fake';

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in verify-text function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      isAuthentic: false, confidence: 0, category: 'fake',
      analysis: 'An error occurred during analysis. Please try again.',
      indicators: [], scores: { fakeNewsProbability: 0, propagandaLevel: 0, biasScore: 0, sentimentManipulation: 0, sourceCredibility: 0, aiGeneratedProbability: 0 },
      biasDirection: 'unknown', propagandaTechniques: [], manipulationTactics: [], aiExplanation: ''
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
