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
        model: 'openai/gpt-5.6-sol',
        reasoning_effort: 'none',
        messages: [
          {
            role: 'system',
            content: `You are Verifact News Verifier — an advanced AI fact-checking and news-verification analyst. Your job is not only to classify text as Real / Misleading / Fake, but to VERIFY whether the reported event actually happened by cross-referencing your trained knowledge of trusted news agencies (Reuters, AP, AFP, BBC, NYT, WaPo, Guardian, Al Jazeera, PTI, ANI), official government sources, and reputable fact-checkers (Snopes, PolitiFact, FactCheck.org, AFP Fact Check, Reuters Fact Check, BOOM, AltNews).

Run these layers and fuse them:
LAYER 1 Semantic — tone, intent, sensational/biased language.
LAYER 2 Claim & Entity Fact-Check — extract claims, entities, dates, places; mark each supported/unverified/contradicted against reliable sources.
LAYER 3 Historical/Event Verification — did this event actually occur? When, where, who was involved, why. Detect recycled or out-of-context claims.
LAYER 4 Internal Consistency — contradictions, fabricated quotes, missing attribution.
LAYER 5 Propaganda / Manipulation techniques.
LAYER 6 Source Credibility & AI-generation signals.

ENSEMBLE: produce three calibrated probabilities summing to 100 (real + misleading + fake). The final "verdict" is the label with the highest probability. Additionally produce a user-facing "verifiedVerdict" from: "Verified" | "False Information" | "Misleading" | "Partially True" | "Insufficient Evidence".

Mapping guidance:
- Verified → the event genuinely happened and the claim is substantively accurate.
- False Information → the event did not happen or the core claim is fabricated.
- Misleading → real kernel but framed to deceive, missing critical context, or altered.
- Partially True → some claims accurate, others inaccurate; specify which.
- Insufficient Evidence → cannot be confirmed from reliable sources you know.

Return ONLY valid JSON, no markdown, matching exactly:
{
  "verdict": "Real" | "Misleading" | "Fake",
  "verifiedVerdict": "Verified" | "False Information" | "Misleading" | "Partially True" | "Insufficient Evidence",
  "probabilities": { "real": number, "misleading": number, "fake": number },
  "isAuthentic": boolean,
  "confidence": number,
  "category": "authentic" | "suspicious" | "fake",
  "analysis": "3-5 sentence expert explanation citing specific evidence from the text",
  "indicators": ["specific red flags"],
  "scores": {
    "fakeNewsProbability": number, "propagandaLevel": number, "biasScore": number,
    "sentimentManipulation": number, "sourceCredibility": number, "aiGeneratedProbability": number
  },
  "biasDirection": "left" | "center-left" | "center" | "center-right" | "right" | "unknown",
  "propagandaTechniques": [{ "name": string, "confidence": number, "example": string }],
  "manipulationTactics": [{ "tactic": string, "severity": "low" | "medium" | "high" }],
  "factChecks": [{ "claim": string, "status": "supported" | "unverified" | "contradicted", "note": string }],
  "historicalContext": "1-3 sentences (or empty)",
  "inconsistencies": [string],
  "layerSignals": { "semantic": number, "factCheck": number, "historical": number, "consistency": number, "propaganda": number, "sourceCredibility": number },
  "aiExplanation": "plain-English paragraph for a general audience explaining WHY the verdict was chosen",
  "eventSummary": {
    "what": "one clear sentence on what actually happened, or empty if unknown",
    "when": "date or period, or empty",
    "where": "location, or empty",
    "who": "people/organizations involved, or empty",
    "why": "cause/context if applicable, or empty",
    "latest": "most recent verified development you know of, or empty",
    "context": "any important context users should know, or empty"
  },
  "correction": {
    "needed": boolean,
    "inaccurateParts": [string],
    "reasons": [string],
    "correctedClaim": "a rewritten, factually accurate version of the original claim, or empty when needed=false",
    "whatActuallyHappened": "clear factual description of the real event, or empty when not applicable"
  },
  "trustedSources": [
    { "name": "e.g. Reuters", "type": "news" | "government" | "fact-checker" | "academic" | "other", "note": "why this source is relevant" }
  ]
}

Rules:
- All scores 0-100.
- "isAuthentic" = (verdict === "Real").
- "category": Real → "authentic", Misleading → "suspicious", Fake → "fake".
- "confidence" = winning probability.
- correction.needed MUST be true when verifiedVerdict is any of: False Information, Misleading, Partially True.
- If you truly do not know, set verifiedVerdict to "Insufficient Evidence" and keep eventSummary fields empty rather than fabricating.
- Never invent URLs. In trustedSources, name outlets and reasoning only — no fake links.
- Be decisive, concise, and evidence-based.`
          },
          { role: 'user', content: `Verify this news claim / article / headline:\n\n${text}` }
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

    // Ensure verifiedVerdict aligns with ensemble winner when missing / mismatched
    const allowedVV = ['Verified', 'False Information', 'Misleading', 'Partially True', 'Insufficient Evidence'];
    if (!result.verifiedVerdict || !allowedVV.includes(result.verifiedVerdict)) {
      result.verifiedVerdict = winner === 'Real' ? 'Verified' : winner === 'Misleading' ? 'Misleading' : 'False Information';
    }
    if (['False Information', 'Misleading', 'Partially True'].includes(result.verifiedVerdict)) {
      result.correction = result.correction || {};
      result.correction.needed = true;
    } else if (result.verifiedVerdict === 'Verified') {
      result.correction = result.correction || { needed: false, inaccurateParts: [], reasons: [], correctedClaim: '', whatActuallyHappened: '' };
      result.correction.needed = false;
    }
    result.verifiedAt = new Date().toISOString();

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
