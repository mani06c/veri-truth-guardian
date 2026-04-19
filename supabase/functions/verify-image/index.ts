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
    const { imageData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'imageData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing image for AI generation / manipulation...');

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
            content: `You are a forensic image analyst specialized in detecting AI-generated images (Midjourney, DALL-E, Stable Diffusion, Flux, Sora, Gemini Imagen), deepfakes, GAN outputs, and any digital manipulation (splicing, retouching, face swaps, inpainting).

Examine the image carefully for:
- AI generation signatures: over-smooth skin, perfect symmetry, melting/blurred fingers and teeth, illegible text, repeating patterns, plastic textures, unnatural eye reflections, broken jewelry/glasses
- Deepfake signs: face/neck blending mismatch, lighting direction mismatch on the face, asymmetric earrings, inconsistent ear shape, blurry hair edges
- Manipulation: cloned regions, mismatched noise, soft edges around objects, inconsistent shadows or perspective
- Compression and metadata clues visible in pixels

Be decisive. If the image looks AI-generated or manipulated, say so with high confidence.

Return ONLY a valid JSON object, no prose, no markdown fences:
{
  "isAuthentic": boolean,
  "confidence": number,
  "category": "authentic" | "suspicious" | "manipulated",
  "verdict": "Real" | "AI-Generated" | "Manipulated" | "Suspicious",
  "analysis": "2-4 sentence forensic explanation citing specific visual evidence",
  "detectionScores": {
    "aiGeneration": number,
    "splicing": number,
    "lighting": number,
    "metadata": number
  }
}

confidence = how sure you are of the verdict (0-100). Scores are 0-100 where higher = more suspicious.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this image. Is it real, AI-generated, or manipulated?' },
              { type: 'image_url', image_url: { url: imageData } }
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

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in verify-image function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        isAuthentic: false,
        confidence: 0,
        category: 'suspicious',
        verdict: 'Suspicious',
        analysis: 'An error occurred during analysis. Please try again.',
        detectionScores: { aiGeneration: 0, splicing: 0, lighting: 0, metadata: 0 }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
