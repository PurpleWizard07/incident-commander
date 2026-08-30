import { useEffect, useState } from "react";
import { registerInvestigationTools, onToolCall, type ToolCallLogEntry } from "./webmcp/registerTools.js";

const SERVICES = ["checkout", "payments", "database"] as const; // subset, for the manual test buttons

function resultText(result: unknown): string {
  if (result && typeof result === "object" && "content" in result) {
    const content = (result as { content: { type: string; text?: string }[] }).content;
    return content.map((c) => c.text ?? "").join("\n");
  }
  return JSON.stringify(result);
}

export default function App() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [log, setLog] = useState<ToolCallLogEntry[]>([]);
  const [manualResult, setManualResult] = useState<string>("(not called yet)");

  useEffect(() => {
    setSupported(typeof document !== "undefined" && !!document.modelContext);
    const unregister = registerInvestigationTools();
    const unsubscribe = onToolCall((entry) => setLog((prev) => [entry, ...prev].slice(0, 20)));
    return () => {
      unregister();
      unsubscribe();
    };
  }, []);

  async function callDirectly(service: string) {
    const res = await fetch(`/api/services/${encodeURIComponent(service)}/health`, {
      headers: { "X-Session-Id": "manual-check" },
    });
    const data = await res.json();
    setManualResult(JSON.stringify(data, null, 2));
  }

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 720, margin: "2rem auto", lineHeight: 1.5 }}>
      <h1>Incident Commander — Phase 3</h1>
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
      <blockquote>&quot;Investigate the checkout incident and tell me what you recommend.&quot;</blockquote>
      {log.length === 0 ? (
        <p>(no tool calls yet — 12 investigation tools are registered)</p>
      ) : (
        <ul>
          {log.map((entry) => (
            <li key={entry.id} style={{ marginBottom: 8 }}>
              <div>
                <strong>{entry.tool}</strong> @ {entry.at}
              </div>
              <div>args: {JSON.stringify(entry.args)}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {entry.error ? `ERROR: ${entry.error}` : resultText(entry.result)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
