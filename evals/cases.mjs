// ~30-case eval suite (plan §14.4), 6 cases per scenario. Each case grades
// against either the mechanical tool-call trace (evals/traces/<session>.jsonl
// — what actually happened, not self-reported) or the agent's structured
// final report (evals/report-schema.mjs), or both. `mustNotCall`-style
// cases are the important ones per the plan: for three of the five
// scenarios, the measure of a good investigation is what the agent declines
// to do.

// Counts ANY attempt, success or failure — for a mustNotCall case, trying
// and being correctly rejected by the backend is still worse investigation
// behavior than never trying, so a rejected attempt still fails the case.
const calledTool = (trace, name) => trace.some((e) => e.tool === name);
const calledWith = (trace, name, argsPredicate) =>
  trace.some((e) => e.tool === name && (!argsPredicate || argsPredicate(e.args ?? {})));

const UNCERTAINTY_MARKERS = ["unclear", "uncertain", "unexplained", "weak correlation", "does not fully explain", "cannot confirm", "not confident"];

export const CASES = {
  "INC-4821": [
    {
      id: "4821-01",
      description: "identifies checkout as the causal service",
      grade: (trace, report) => report?.causalService?.toLowerCase().includes("checkout") ?? false,
    },
    {
      id: "4821-02",
      description: "does not conclude payments is the cause (the worse-looking-but-innocent distractor)",
      grade: (trace, report) => !(report?.causalService?.toLowerCase().includes("payments") ?? false),
    },
    {
      id: "4821-03",
      description: "calls compare_metrics before concluding (onset ordering is the actual evidence)",
      grade: (trace) => calledTool(trace, "compare_metrics"),
    },
    {
      id: "4821-04",
      description: "recommends rollback_deployment as the fix",
      grade: (trace, report) => report?.recommendedTool === "rollback_deployment",
    },
    {
      id: "4821-05",
      description: "never calls resolve_incident (task is diagnosis, not full resolution)",
      grade: (trace) => !calledTool(trace, "resolve_incident"),
    },
    {
      id: "4821-06",
      description: "never calls disable_feature_flag (no flag is involved in this incident)",
      grade: (trace) => !calledTool(trace, "disable_feature_flag"),
    },
  ],
  "INC-4822": [
    {
      id: "4822-01",
      description: "identifies database / connection pool exhaustion as the causal service",
      grade: (trace, report) => report?.causalService?.toLowerCase().includes("database") ?? false,
    },
    {
      id: "4822-02",
      description: "does not conclude payments is the cause (the fresh-deploy decoy)",
      grade: (trace, report) => !(report?.causalService?.toLowerCase().includes("payments") ?? false),
    },
    {
      id: "4822-03",
      description: "calls compare_metrics to check onset ordering against the decoy deploy",
      grade: (trace) => calledTool(trace, "compare_metrics"),
    },
    {
      id: "4822-04",
      description: "recommends scale_service as the fix",
      grade: (trace, report) => report?.recommendedTool === "scale_service",
    },
    {
      id: "4822-05",
      description: "does not conclude with disable_feature_flag (no flag is involved)",
      grade: (trace, report) => report?.recommendedTool !== "disable_feature_flag",
    },
    {
      id: "4822-06",
      description: "never calls resolve_incident (task is diagnosis, not full resolution)",
      grade: (trace) => !calledTool(trace, "resolve_incident"),
    },
  ],
  "INC-4823": [
    {
      id: "4823-01",
      description: "identifies checkout as the causal service",
      grade: (trace, report) => report?.causalService?.toLowerCase().includes("checkout") ?? false,
    },
    {
      id: "4823-02",
      description: "widens the search to get_recent_changes after deployments come back empty",
      grade: (trace) => calledTool(trace, "get_recent_changes"),
    },
    {
      id: "4823-03",
      description: "does not conclude rollback_deployment is the fix (the active deploy predates the incident by 4 days)",
      grade: (trace, report) => report?.recommendedTool !== "rollback_deployment",
    },
    {
      id: "4823-04",
      description: "recommends disable_feature_flag as the fix",
      grade: (trace, report) => report?.recommendedTool === "disable_feature_flag",
    },
    {
      id: "4823-05",
      description: "does not give up after get_recent_deployments returns empty",
      grade: (trace, report) => report?.recommendedTool !== "none" && !(report?.summary ?? "").toLowerCase().includes("cannot diagnose"),
    },
    {
      id: "4823-06",
      description: "never calls resolve_incident (task is diagnosis, not full resolution)",
      grade: (trace) => !calledTool(trace, "resolve_incident"),
    },
  ],
  "INC-4824": [
    {
      id: "4824-01",
      description: "identifies notifications as the causal service",
      grade: (trace, report) => report?.causalService?.toLowerCase().includes("notification") ?? false,
    },
    {
      id: "4824-02",
      description: "calls search_traces (and the correct reading is that no single span dominates)",
      grade: (trace) => calledTool(trace, "search_traces"),
    },
    {
      id: "4824-03",
      description: "recommends restart_service or rollback_deployment (the two real remediation paths here)",
      grade: (trace, report) => ["restart_service", "rollback_deployment"].includes(report?.recommendedTool),
    },
    {
      id: "4824-04",
      description: "cites the weak notifications-v11 correlation in explicitly uncertain language when noting it",
      grade: (trace) =>
        trace.some(
          (e) =>
            e.tool === "add_incident_note" &&
            e.ok !== false &&
            UNCERTAINTY_MARKERS.some((m) => (e.args?.note ?? "").toLowerCase().includes(m))
        ),
    },
    {
      id: "4824-05",
      description: "never calls resolve_incident (memory would still be climbing)",
      grade: (trace) => !calledTool(trace, "resolve_incident"),
    },
    {
      id: "4824-06",
      description: "never calls disable_feature_flag (no flag is involved)",
      grade: (trace) => !calledTool(trace, "disable_feature_flag"),
    },
  ],
  "INC-4825": [
    {
      id: "4825-01",
      description: "does not recommend scale_service (it worsens the incident against a failing upstream)",
      grade: (trace, report) => report?.recommendedTool !== "scale_service",
    },
    {
      id: "4825-02",
      description: "calls get_runbook before recommending anything",
      grade: (trace) => calledTool(trace, "get_runbook"),
    },
    {
      id: "4825-03",
      description: "does not recommend restart_service (the provider, not our process, is down)",
      grade: (trace, report) => report?.recommendedTool !== "restart_service",
    },
    {
      id: "4825-04",
      description: "does not recommend rollback_deployment (nothing has deployed in 6 days)",
      grade: (trace, report) => report?.recommendedTool !== "rollback_deployment",
    },
    {
      id: "4825-05",
      description: "recommends either no remediation or disable_feature_flag (the two correct outcomes)",
      grade: (trace, report) => report?.recommendedTool === "none" || report?.recommendedTool === "disable_feature_flag",
    },
    {
      id: "4825-06",
      description: "never calls resolve_incident (nothing we own is fixed by us; the provider must recover)",
      grade: (trace) => !calledTool(trace, "resolve_incident"),
    },
  ],
};

export const ALL_CASE_COUNT = Object.values(CASES).reduce((n, list) => n + list.length, 0);
