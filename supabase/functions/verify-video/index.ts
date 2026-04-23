import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Accept a single frame (data URL) for real-time scan
    const frame: string | undefined = body.frame;
    const timestamp: number | undefined = body.timestamp;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    if (!frame) {
      return new Response(
        JSON.stringify({ error: 'frame (data URL) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing video frame at t=${timestamp ?? 0}s`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a forensic video analyst inspecting a single frame from a video to detect AI generation (Sora, Runway, Pika, Veo, Kling) and deepfakes (face swap, lip-sync manipulation, full-body puppetry, voice cloning).

Look for:
- Face boundary blending, mismatched skin tone at jawline, flickering edges
- Eye and teeth artifacts, asymmetric facial details
- Lip-shape mismatch with expected speech, unnatural mouth interior
- AI video signatures: morphing backgrounds, warping objects, hands with wrong finger counts, melting hair, plastic skin, unnatural lighting on face vs body
- GAN/diffusion fingerprints: micro repeating textures, smoothed details
- Voice authenticity cues visible in the frame: lip/jaw sync with expected speech, facial muscle engagement during speech

Be decisive. Return ONLY valid JSON, no markdown:
{
  "isAuthentic": boolean,
  "confidence": number,
  "category": "authentic" | "suspicious" | "deepfake",
  "verdict": "Real" | "AI-Generated" | "Deepfake" | "Suspicious",
  "analysis": "2-4 sentence forensic explanation citing specific visual evidence in the frame",
  "detectionScores": {
    "facialManipulation": number,
    "lipSync": number,
    "temporalConsistency": number,
    "ganArtifacts": number,
    "voiceAuthenticity": number
  },
  "suspiciousRegions": [
    { "area": "short label e.g. jawline blend", "severity": "low" | "medium" | "high" }
  ],
  "frameFlags": ["list of specific issues found in this frame"]
}

Scores 0-100, higher = more suspicious. suspiciousRegions lists areas where anomalies are visible. frameFlags are short string labels for each issue detected.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Analyze this video frame${timestamp != null ? ` (t=${timestamp.toFixed(1)}s)` : ''}. Is it real, AI-generated, or a deepfake?` },
              { type: 'image_url', image_url: { url: frame } }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit reached, please try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in Lovable Cloud settings.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    console.log('AI Response:', resultText);

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');
    const result = JSON.parse(jsonMatch[0]);
    if (timestamp != null) result.timestamp = timestamp;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in verify-video function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        isAuthentic: false,
        confidence: 0,
        category: 'suspicious',
        verdict: 'Suspicious',
        analysis: 'An error occurred during analysis. Please try again.',
        detectionScores: { facialManipulation: 0, lipSync: 0, temporalConsistency: 0, ganArtifacts: 0 }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
