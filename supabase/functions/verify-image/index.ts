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

    console.log('Analyzing image for AI generation / manipulation / edits...');

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
            content: `You are a forensic image analyst specialized in detecting (a) AI-generated images (Midjourney, DALL-E, Stable Diffusion, Flux, Imagen), (b) deepfakes / face swaps, (c) digital manipulation (splicing, inpainting, object removal), and (d) photo edits & effects (filters, retouching, color grading, background replacement, beauty filters, HDR, sharpening). You also identify suspicious REGIONS in the image.

Examine the image carefully for:
- AI generation: over-smooth skin, perfect symmetry, melting/blurred fingers and teeth, illegible text, repeating patterns, plastic textures, unnatural eye reflections
- Deepfake: face/neck blending mismatch, lighting direction mismatch, asymmetric earrings, inconsistent ear shape, blurry hair edges
- Manipulation: cloned regions, mismatched noise, soft edges around objects, inconsistent shadows or perspective
- Edits & effects: Instagram-style filter, vignette, heavy color grading, beauty/skin smoothing filter, teeth whitening, eye enlargement, slimming/reshaping, background blur or replacement, sky replacement, object removal, HDR boost, oversharpening, noise reduction, exposure/contrast/saturation push, black-and-white conversion, film grain added

Be decisive. Distinguish between an unedited camera photo, a lightly edited photo, a heavily edited photo, and a fully AI-generated image.

Return ONLY a valid JSON object, no prose, no markdown fences:
{
  "isAuthentic": boolean,
  "confidence": number,
  "category": "authentic" | "suspicious" | "manipulated",
  "verdict": "Real" | "AI-Generated" | "Manipulated" | "Suspicious",
  "sourceType": "camera" | "lightly-edited" | "heavily-edited" | "ai-generated",
  "analysis": "2-4 sentence forensic explanation citing specific visual evidence",
  "detectionScores": {
    "aiGeneration": number,
    "splicing": number,
    "lighting": number,
    "metadata": number
  },
  "effects": [
    { "name": "short label e.g. Beauty filter", "confidence": number, "severity": "subtle" | "moderate" | "strong" }
  ],
  "regions": [
    {
      "label": "short description e.g. Face blend edge",
      "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0,
      "severity": "low" | "medium" | "high"
    }
  ]
}

isAuthentic = true ONLY for an unedited or lightly edited real photo. Mark false if AI-generated, deepfaked, or heavily manipulated.
confidence = how sure you are of the verdict (0-100). detectionScores are 0-100 where higher = more suspicious. effects is an array (can be empty) of detected edits/effects, each with confidence 0-100.
regions is an array of suspicious areas. x,y,w,h are normalized 0-1 fractions of image dimensions (top-left origin). Only include regions where manipulation or AI artifacts are visible. For authentic images return an empty array.`
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
        sourceType: 'camera',
        analysis: 'An error occurred during analysis. Please try again.',
        detectionScores: { aiGeneration: 0, splicing: 0, lighting: 0, metadata: 0 },
        effects: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
