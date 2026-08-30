import { useEffect } from "react";
import { registerInvestigationTools } from "./webmcp/registerTools.js";
import { AppShell } from "./console/AppShell.js";

export default function App() {
  useEffect(() => {
    // Tools stay registered in the background so the ChatGPT in-app browser
    // and Chrome (WebMCP flag) can still discover and call them — Phase 5
    // wires their effects into this UI via onToolCall(); Phase 4 does not.
    return registerInvestigationTools();
  }, []);

  return <AppShell />;
}
