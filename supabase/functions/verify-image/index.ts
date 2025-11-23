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

    console.log('Analyzing image for deepfake detection...');

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
            content: `You are an expert in deepfake detection and image forensics. Analyze the provided image for signs of manipulation, AI generation, or deepfake technology.

Consider these factors:
- Facial inconsistencies (unnatural features, misaligned elements)
- Lighting and shadow anomalies
- Edge artifacts and blending issues
- Signs of GAN generation (smoothing, repetitive patterns)
- Metadata inconsistencies
- Unnatural textures or skin appearance

Respond ONLY with a JSON object in this exact format:
{
  "isAuthentic": boolean,
  "confidence": number (0-100),
  "category": "authentic" | "suspicious" | "manipulated",
  "analysis": "detailed explanation of your findings",
  "detectionScores": {
    "splicing": number (0-100),
    "aiGeneration": number (0-100),
    "metadata": number (0-100),
    "lighting": number (0-100)
  }
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image for deepfake or manipulation indicators:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    
    console.log('AI Response:', resultText);

    // Parse the JSON response
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

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
        category: 'manipulated',
        analysis: 'An error occurred during analysis. Please try again.',
        detectionScores: {
          splicing: 0,
          aiGeneration: 0,
          metadata: 0,
          lighting: 0
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
