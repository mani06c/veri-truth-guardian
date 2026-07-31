import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseProjectUrl, supabasePublishableKey } from "../supabase";

export default defineTool({
  name: "verify_text",
  title: "Verify a news claim",
  description:
    "Run VeriFact's news verification on a claim, headline or article. Cross-references live news, fact-checkers and social platforms and returns a verdict with probabilities and evidence.",
  inputSchema: { text: z.string().describe("The claim, headline or article text to verify.") },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ text }) => {
    const claim = text.trim();
    if (!claim) throw new ToolError("text must not be empty");
    const res = await fetch(`${supabaseProjectUrl()}/functions/v1/verify-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabasePublishableKey(),
        Authorization: `Bearer ${supabasePublishableKey()}`,
      },
      body: JSON.stringify({ text: claim }),
    });
    const body = await res.text();
    if (!res.ok) throw new ToolError(`Verification failed (${res.status}): ${body.slice(0, 400)}`);
    let result: any;
    try {
      result = JSON.parse(body);
    } catch {
      throw new ToolError("Verification returned an unreadable response");
    }
    const summary = [
      `Verdict: ${result.verifiedVerdict ?? result.verdict ?? "unknown"}`,
      `Confidence: ${result.confidence ?? "n/a"}%`,
      result.probabilities
        ? `Probabilities — real ${result.probabilities.real}% / misleading ${result.probabilities.misleading}% / fake ${result.probabilities.fake}%`
        : "",
      result.aiExplanation || result.analysis || "",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { result },
    };
  },
});