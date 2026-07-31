import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listScansTool from "./tools/list-scans";
import getScanTool from "./tools/get-scan";
import verifyTextTool from "./tools/verify-text";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "verifact",
  title: "veriFact",
  version: "0.1.0",
  instructions:
    "Tools for VeriFact, a forensic AI verification platform. Use `verify_text` to fact-check a news claim, headline or article against live news, fact-checkers and social platforms. Use `list_scans` and `get_scan` to read the signed-in user's past verification scans across text, image, video, audio, URL and document analysis.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [verifyTextTool, listScansTool, getScanTool],
});