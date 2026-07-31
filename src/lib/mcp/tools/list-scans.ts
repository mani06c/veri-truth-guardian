import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_scans",
  title: "List verification scans",
  description:
    "List the signed-in user's recent VeriFact verification scans (text, image, video, audio, url, document) with verdict and confidence.",
  inputSchema: {
    scan_type: z
      .enum(["text", "image", "video", "url", "audio", "document"])
      .optional()
      .describe("Optional filter by scan type."),
    limit: z.number().int().optional().describe("Max scans to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ scan_type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabaseForUser(ctx)
      .from("scans")
      .select("id, scan_type, input_label, verdict, confidence, source_type, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (scan_type) query = query.eq("scan_type", scan_type);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { scans: data ?? [] },
    };
  },
});