import { AppShell } from "./console/AppShell.js";

// Tool registration itself lives in AppShell — it's role/incident/state-
// scoped (plan §8), so it needs the same live console data AppShell already
// loads, not a one-time effect at the app root.
export default function App() {
  return <AppShell />;
}
