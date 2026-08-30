import { useEffect, useState } from "react";
import { registerPhase0Tools, onToolCall, type ToolCallLogEntry } from "./webmcp/registerTools.js";

const SERVICES = ["checkout", "payments", "database"] as const; // subset, for the manual test buttons

export default function App() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [log, setLog] = useState<ToolCallLogEntry[]>([]);
  const [manualResult, setManualResult] = useState<string>("(not called yet)");

  useEffect(() => {
    setSupported(typeof document !== "undefined" && !!document.modelContext);
    const unregister = registerPhase0Tools();
    const unsubscribe = onToolCall((entry) => setLog((prev) => [entry, ...prev].slice(0, 20)));
    return () => {
      unregister();
      unsubscribe();
    };
  }, []);

  async function callDirectly(service: string) {
    const res = await fetch(`/api/service-health?service=${encodeURIComponent(service)}`);
    const data = await res.json();
    setManualResult(JSON.stringify(data, null, 2));
  }

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 720, margin: "2rem auto", lineHeight: 1.5 }}>
      <h1>Incident Commander — Phase 0</h1>
      <p>
        WebMCP support in this browser:{" "}
        <strong>{supported === null ? "checking…" : supported ? "YES" : "NO"}</strong>
      </p>
      {supported === false && (
        <p style={{ color: "#b45309" }}>
          Enable <code>chrome://flags/#enable-webmcp-testing</code> in Chrome, or open this page in
          ChatGPT&apos;s in-app browser.
        </p>
      )}

      <h2>Manual API check (bypasses WebMCP)</h2>
      <p>
        {SERVICES.map((s) => (
          <button key={s} onClick={() => callDirectly(s)} style={{ marginRight: 8 }}>
            {s}
          </button>
        ))}
      </p>
      <pre style={{ background: "#111", color: "#0f0", padding: 12, overflowX: "auto" }}>
        {manualResult}
      </pre>

      <h2>Agent tool-call log</h2>
      <p>Ask an agent (in ChatGPT&apos;s in-app browser, or Chrome with WebMCP enabled) something like:</p>
      <blockquote>&quot;What is the health of the checkout service?&quot;</blockquote>
      {log.length === 0 ? (
        <p>(no tool calls yet)</p>
      ) : (
        <ul>
          {log.map((entry) => (
            <li key={entry.id} style={{ marginBottom: 8 }}>
              <div>
                <strong>{entry.tool}</strong> @ {entry.at}
              </div>
              <div>args: {JSON.stringify(entry.args)}</div>
              <div>
                result: {entry.error ? `ERROR: ${entry.error}` : JSON.stringify(entry.result)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
