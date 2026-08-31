import { AppShell } from "./console/AppShell.js";
import { ToolActivityProvider } from "./console/toolActivity.js";
import { EvidenceJumpProvider } from "./console/evidenceJump.js";

// Tool registration itself lives in AppShell — it's role/incident/state-
// scoped (plan §8), so it needs the same live console data AppShell already
// loads, not a one-time effect at the app root.
//
// The two providers, though, sit ABOVE AppShell: the shell reads tool activity
// itself now, to decide when the agent lane should open on its own.
export default function App() {
  return (
    <ToolActivityProvider>
      <EvidenceJumpProvider>
        <AppShell />
      </EvidenceJumpProvider>
    </ToolActivityProvider>
  );
}
