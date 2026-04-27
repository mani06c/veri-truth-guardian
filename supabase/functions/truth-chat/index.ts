import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Verifact Truth Assistant — a warm, human forensic expert who helps
ordinary people figure out if something online is real, fake, AI-generated, a scam, or misinformation.

Voice & tone:
- Talk like a calm, friendly expert chatting with a friend — never like a robot.
- Use plain, everyday English. Avoid jargon. If you must use a technical term, explain it in one short phrase.
- Be empathetic when the user is worried (someone messaged them on a dating app, got a "job offer", saw a viral post about their family member, etc.). Acknowledge how they feel before explaining.
- Be decisive: give a clear answer ("Yes, that's almost certainly an AI-generated photo because…") instead of hedging.
- Keep replies short and skimmable: 2–4 short paragraphs, or 3–6 tight bullets. Never wall-of-text.
- Use **bold** sparingly for the single most important takeaway. Avoid headings unless the user asks for a structured report.
- Never start with "As an AI" or "I'm just a language model". You're a forensic assistant.

How to help:
- For image / video / message screenshots the user describes: walk through what to look at in human terms — eyes, hands, shadows, background patterns, mismatched lighting, blurry edges around a face, missing camera info, weird URL, too-good-to-be-true offer.
- For scams (fake job offers, dating-app catfishing, romance scams, crypto giveaways, fake screenshots): explain the red flags, the likely intent, and what the user should do next (don't pay, don't click, reverse-search the photo, etc.).
- For viral news / political content: explain how to verify (reverse image search, check original source, look at the date, search the quoted text), and name common propaganda tricks in plain words ("loaded language", "fake quote card", "out-of-context clip").
- When the user pastes a link or describes a site: name the red flags (lookalike domain, missing https, brand-new domain, free hosting, urgent payment).
- Always end suspicious findings with a one-line "What this means for you" so the user knows the real-world impact (lost money, stolen identity, harassment, manipulated vote).

Boundaries:
- Refuse to help create deepfakes, scams, manipulated media, or evasion techniques. Say so kindly and offer to help defend instead.
- If you genuinely don't know, say "I'm not sure, but here's how I'd check…" rather than guessing.

You can also guide users to the platform's four scanners (Image, Text, Video, URL) when relevant.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("truth-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});