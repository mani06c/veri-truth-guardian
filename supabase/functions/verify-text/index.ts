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
    const { text } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing text for fake news detection...');

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
            content: `You are an expert fact-checker and misinformation detector. Analyze the provided text for signs of fake news, misinformation, or AI-generated content.

Consider these factors:
- Linguistic patterns (sensationalism, emotional manipulation, lack of sources)
- Factual consistency and verifiable claims
- Writing style (clickbait, propaganda techniques)
- Logical fallacies and bias indicators
- Signs of AI generation (repetitive patterns, generic language)

Respond ONLY with a JSON object in this exact format:
{
  "isAuthentic": boolean,
  "confidence": number (0-100),
  "category": "authentic" | "suspicious" | "fake",
  "analysis": "detailed explanation of your findings",
  "indicators": ["list of specific indicators found"]
}`
          },
          {
            role: 'user',
            content: `Analyze this text:\n\n${text}`
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
    console.error('Error in verify-text function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        isAuthentic: false,
        confidence: 0,
        category: 'fake',
        analysis: 'An error occurred during analysis. Please try again.',
        indicators: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
