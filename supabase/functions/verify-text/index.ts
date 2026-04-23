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
            content: `You are an expert forensic text analyst specializing in misinformation detection, propaganda analysis, and sentiment manipulation. You combine fact-checking expertise with linguistic forensics.

Analyze the text for:
1. **Fake news probability** — verifiable false claims, fabricated quotes, invented statistics
2. **Propaganda techniques** — bandwagon, appeal to fear, loaded language, false dichotomy, ad hominem, straw man, appeal to authority, whataboutism, emotional blackmail
3. **Bias detection** — political lean (left/center-left/center/center-right/right), framing bias, omission bias, selection bias
4. **Sentiment manipulation** — emotional trigger words, fear-mongering, outrage bait, clickbait patterns, urgency manufacturing
5. **Source credibility cues** — presence of citations, named sources, verifiable data, institutional backing
6. **AI-generated text signals** — repetitive structure, generic phrasing, lack of personal voice, statistical patterns

Return ONLY valid JSON, no markdown:
{
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
  "aiExplanation": "A plain-English paragraph explaining WHY this content may be misleading or trustworthy, written for a general audience"
}

All scores 0-100 where higher = more concerning. Be decisive and evidence-based.`
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
