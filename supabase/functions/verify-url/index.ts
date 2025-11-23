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
    const { url } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing URL for credibility:', url);

    // Fetch the webpage content
    let pageContent = '';
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FactCheckBot/1.0)'
        }
      });
      
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        // Extract text content (simplified - remove HTML tags)
        pageContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000);
      }
    } catch (fetchError) {
      console.error('Error fetching URL:', fetchError);
      pageContent = 'Unable to fetch page content';
    }

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
            content: `You are an expert fact-checker and web credibility analyst. Analyze the provided URL and its content for reliability and misinformation.

Consider these factors:
- Domain reputation and history
- Content quality and sourcing
- Presence of citations and references
- Bias indicators and language patterns
- Comparison with known fact-checking databases
- SSL certificate and security
- Editorial standards

Respond ONLY with a JSON object in this exact format:
{
  "isCredible": boolean,
  "confidence": number (0-100),
  "category": "credible" | "questionable" | "misinformation",
  "analysis": "detailed explanation of your findings",
  "credibilityScores": {
    "sourceCredibility": number (0-100),
    "factVerification": number (0-100),
    "domainReputation": number (0-100),
    "citationQuality": number (0-100)
  }
}`
          },
          {
            role: 'user',
            content: `Analyze this URL and content for credibility:\n\nURL: ${url}\n\nPage Content Sample:\n${pageContent}`
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
    console.error('Error in verify-url function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        isCredible: false,
        confidence: 0,
        category: 'misinformation',
        analysis: 'An error occurred during analysis. Please try again.',
        credibilityScores: {
          sourceCredibility: 0,
          factVerification: 0,
          domainReputation: 0,
          citationQuality: 0
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
