import { useEffect } from "react";
import { registerImperativeTools } from "./webmcp/registerTools.js";
import { AppShell } from "./console/AppShell.js";

export default function App() {
  useEffect(() => {
    // Tools stay registered in the background so the ChatGPT in-app browser
    // and Chrome (WebMCP flag) can still discover and call them. All 23
    // imperative tools register unconditionally for now — Phase 7 makes
    // registration role/state-scoped (plan §8); this phase does not.
    return registerImperativeTools();
  }, []);

  return <AppShell />;
}
