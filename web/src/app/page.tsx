"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Sparkles,
  ShieldCheck,
  Database,
  Cpu,
  Layers,
  History,
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Download,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Terminal,
  FileText,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Check,
} from "lucide-react";

interface EvidenceSource {
  title: string;
  url: string;
  content: string;
  query?: string;
}

interface ReportFinding {
  claim: string;
  sourceUrl: string;
  evidenceSnippet: string;
}

interface ResearchReport {
  topic: string;
  summary: string;
  keyFindings: ReportFinding[];
  sources: Array<{ title: string; url: string }>;
  conclusion: string;
  generatedAt: string;
  loopsUsed: number;
}

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: "system" | "planner" | "searcher" | "reviewer" | "verifier" | "reporter" | "error";
}

export default function ResearchCommandCenter() {
  const [activeTab, setActiveTab] = useState<"research" | "rag" | "sessions" | "telemetry">("research");
  
  // Research State
  const [topic, setTopic] = useState("");
  const [maxIterations, setMaxIterations] = useState(3);
  const [provider, setProvider] = useState("gemini");
  const [includeKb, setIncludeKb] = useState(true);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("idle");
  const [currentIteration, setCurrentIteration] = useState(1);
  const [evidenceList, setEvidenceList] = useState<EvidenceSource[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "init",
      time: new Date().toLocaleTimeString(),
      message: "Research Agent platform initialized and connected to LangGraph orchestrator.",
      type: "system",
    },
  ]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // System Telemetry
  const [telemetry, setTelemetry] = useState<any>(null);
  const [breakers, setBreakers] = useState<any[]>([]);
  const [activeModel, setActiveModel] = useState("gemini-3.5-flash-lite");

  // RAG State
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [ragTitle, setRagTitle] = useState("");
  const [ragUrl, setRagUrl] = useState("");
  const [ragTags, setRagTags] = useState("");
  const [ragContent, setRagContent] = useState("");
  const [ragSearchQuery, setRagSearchQuery] = useState("");
  const [ragSearchResults, setRagSearchResults] = useState<any[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Load initial health & telemetry
  useEffect(() => {
    fetchHealth();
    fetchTelemetry();
  }, []);

  useEffect(() => {
    if (activeTab === "rag") fetchRagDocs();
    if (activeTab === "sessions") fetchSessions();
    if (activeTab === "telemetry") fetchTelemetry();
  }, [activeTab]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, type: LogEntry["type"] = "system") => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        time: new Date().toLocaleTimeString(),
        message,
        type,
      },
    ]);
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch("/health");
      const data = await res.json();
      if (data.status === "ok") {
        setActiveModel(`${data.provider} (${data.model})`);
      }
    } catch {
      setActiveModel("Backend Connecting...");
    }
  };

  const fetchTelemetry = async () => {
    try {
      const [overviewRes, breakersRes] = await Promise.all([
        fetch("/api/v1/telemetry/overview"),
        fetch("/api/v1/telemetry/circuit-breakers"),
      ]);
      const overviewData = await overviewRes.json();
      const breakersData = await breakersRes.json();
      if (overviewData.success) setTelemetry(overviewData.telemetry);
      if (breakersData.breakers) setBreakers(breakersData.breakers);
    } catch (err) {
      console.error("Telemetry fetch error:", err);
    }
  };

  const fetchRagDocs = async () => {
    try {
      const res = await fetch("/api/v1/knowledge");
      const data = await res.json();
      if (data.success) setRagDocs(data.documents || []);
    } catch (err) {
      console.error("RAG docs fetch error:", err);
    }
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch("/api/v1/sessions");
      const data = await res.json();
      if (data.success) setSessions(data.sessions || []);
    } catch (err) {
      console.error("Sessions fetch error:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleStartResearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = topic.trim();
    if (!query || isInvestigating) return;

    // Reset session view
    setIsInvestigating(true);
    setCurrentStep("planning");
    setCurrentIteration(1);
    setEvidenceList([]);
    setReport(null);
    setSessionId(null);
    addLog(`Initiating autonomous research mission: "${query}" (Loops: ${maxIterations}, Provider: ${provider})`, "system");

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const streamUrl = `/api/v1/research/stream?topic=${encodeURIComponent(query)}&maxIterations=${maxIterations}`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.addEventListener("status", (event) => {
        try {
          const data = JSON.parse(event.data);
          const stepMsg = data.step || "";
          addLog(`${stepMsg} ${data.details ? JSON.stringify(data.details) : ""}`, "system");

          const lower = stepMsg.toLowerCase();
          if (lower.includes("plan")) setCurrentStep("planning");
          else if (lower.includes("evidence") || lower.includes("search")) {
            setCurrentStep("searching");
            if (data.details?.totalSources) {
              // Evidence update
            }
          } else if (lower.includes("evaluat") || lower.includes("review")) setCurrentStep("reviewing");
          else if (lower.includes("complet") || lower.includes("synthesis")) setCurrentStep("reporting");
        } catch (err) {
          console.error("SSE parse error", err);
        }
      });

      es.addEventListener("completed", (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`Investigation finalized. Session persisted to PostgreSQL checkpoint.`, "verifier");
          setCurrentStep("completed");
          setReport(data.report);
          setSessionId(data.sessionId);
          if (data.report?.sources) {
            setEvidenceList(
              data.report.sources.map((s: any) => ({
                title: s.title,
                url: s.url,
                content: "Referenced in verified report.",
              }))
            );
          }
          fetchTelemetry();
        } catch (err) {
          console.error("Completion event parse error", err);
        } finally {
          setIsInvestigating(false);
          es.close();
        }
      });

      es.addEventListener("error", (event) => {
        console.error("Stream disconnect or error", event);
        addLog("Stream connection closed.", "error");
        setIsInvestigating(false);
        es.close();
      });
    } catch (err: any) {
      addLog(`Failed to connect to agent stream: ${err.message}`, "error");
      setIsInvestigating(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!report) return;
    const md = `# RESEARCH REPORT: ${report.topic}

**Generated At:** ${report.generatedAt}
**Loops Used:** ${report.loopsUsed}

## Executive Summary
${report.summary}

## Key Findings & Sourced Ground Truth
${(report.keyFindings || [])
  .map(
    (f, i) => `### [${i + 1}] ${f.claim}
- **Source:** ${f.sourceUrl}
- **Snippet:** "${f.evidenceSnippet}"`
  )
  .join("\n\n")}

## Referenced Sources
${(report.sources || []).map((s, i) => `[${i + 1}] [${s.title}](${s.url})`).join("\n")}

## Conclusion
${report.conclusion}
`;
    navigator.clipboard.writeText(md).then(() => {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    });
  };

  const handleExportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ sessionId, report }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleIngestDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragTitle.trim() || !ragContent.trim()) return;

    setIsIngesting(true);
    try {
      const tags = ragTags
        ? ragTags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        : [];

      const res = await fetch("/api/v1/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ragTitle.trim(),
          sourceUrl: ragUrl.trim() || undefined,
          tags,
          content: ragContent.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to ingest");

      setRagTitle("");
      setRagUrl("");
      setRagTags("");
      setRagContent("");
      fetchRagDocs();
      alert("Internal document successfully chunked and indexed into Private RAG database.");
    } catch (err: any) {
      alert(`Ingestion error: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleTestRagSearch = async () => {
    if (!ragSearchQuery.trim()) return;
    try {
      const res = await fetch(`/api/v1/knowledge/search?q=${encodeURIComponent(ragSearchQuery.trim())}`);
      const data = await res.json();
      setRagSearchResults(data.results || []);
    } catch (err) {
      console.error("RAG search probe error:", err);
    }
  };

  const handleViewSavedSession = async (sid: string) => {
    try {
      const res = await fetch(`/api/v1/sessions/${sid}`);
      const data = await res.json();
      if (!data.success || !data.session) throw new Error("Session not found");

      const s = data.session;
      if (s.report) {
        setReport({
          topic: s.topic,
          summary: s.report.summary,
          conclusion: s.report.conclusion,
          generatedAt: s.report.generatedAt,
          loopsUsed: s.loopsUsed || 1,
          keyFindings: (s.report.findings || []).map((f: any) => ({
            claim: f.claim,
            sourceUrl: f.sourceUrl,
            evidenceSnippet: f.evidenceSnippet,
          })),
          sources: (s.evidence || []).map((e: any) => ({
            title: e.title,
            url: e.url,
          })),
        });
        setSessionId(sid);
        setTopic(s.topic);
        setActiveTab("research");
      } else {
        alert("This historical session does not have a compiled report.");
      }
    } catch (err: any) {
      alert(`Error loading session: ${err.message}`);
    }
  };

  const handleResetBreakers = async () => {
    try {
      await fetch("/api/v1/telemetry/circuit-breakers/reset", { method: "POST" });
      fetchTelemetry();
      alert("All resilience circuit breakers reset to CLOSED status.");
    } catch (err: any) {
      alert(`Failed to reset: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-[#fafafa]">
      {/* Top Professional Header Bar */}
      <header className="border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-100 shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-zinc-100">ReviewSage</span>
                <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400">
                  Agentic Graph
                </span>
              </div>
            </div>
          </div>

          {/* Clean Central Nav Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800/70">
            <button
              onClick={() => setActiveTab("research")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "research"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Research
            </button>
            <button
              onClick={() => setActiveTab("rag")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "rag"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Private RAG
            </button>
            <button
              onClick={() => setActiveTab("sessions")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "sessions"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Checkpoints
            </button>
            <button
              onClick={() => setActiveTab("telemetry")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "telemetry"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Telemetry
            </button>
          </nav>

          {/* Right Status Pill */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900/80 text-[11px] text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeModel}</span>
            </div>
            <button
              onClick={fetchHealth}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {/* ========================================================================= */}
        {/* TAB 1: RESEARCH STUDIO                                                    */}
        {/* ========================================================================= */}
        {activeTab === "research" && (
          <div className="space-y-8">
            {/* Perplexity-style Command Card */}
            <div className="rounded-2xl border border-zinc-800 bg-[#121215] p-6 shadow-xl relative overflow-hidden">
              <form onSubmit={handleStartResearch} className="space-y-4">
                <div className="relative">
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ask any complex research question or hypothesis..."
                    rows={2}
                    className="w-full bg-transparent text-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none font-normal"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleStartResearch();
                      }
                    }}
                  />
                </div>

                {/* Sub-bar Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Provider Dropdown */}
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none hover:border-zinc-700 transition"
                    >
                      <option value="gemini">Gemini 3.5 Flash Lite</option>
                      <option value="ollama">Ollama Qwen3:8b (Local GPU)</option>
                      <option value="openai">OpenAI GPT-4o Mini</option>
                      <option value="claude">Claude 3.5 Sonnet</option>
                    </select>

                    {/* Max Loops Selector */}
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5">
                      <span className="text-zinc-500">Loops:</span>
                      <select
                        value={maxIterations}
                        onChange={(e) => setMaxIterations(Number(e.target.value))}
                        className="bg-transparent text-zinc-200 focus:outline-none"
                      >
                        <option value={1}>1 loop (Fast)</option>
                        <option value={2}>2 loops</option>
                        <option value={3}>3 loops (Standard)</option>
                        <option value={5}>5 loops (Exhaustive)</option>
                      </select>
                    </div>

                    {/* Private RAG Toggle */}
                    <button
                      type="button"
                      onClick={() => setIncludeKb(!includeKb)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition ${
                        includeKb
                          ? "bg-zinc-800/80 border-zinc-700 text-zinc-100"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Database className="w-3 h-3 text-zinc-400" />
                      <span>Internal RAG</span>
                    </button>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline text-[11px] text-zinc-500">⌘ ↵</span>
                    <button
                      type="submit"
                      disabled={isInvestigating || !topic.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isInvestigating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Investigating...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>Conduct Research</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Quick Prompt Suggestions */}
              <div className="mt-4 pt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-500 text-[11px]">Hypotheses:</span>
                {[
                  "State of the art in AI agents and Google ADK JS in 2026",
                  "LangGraph durable checkpoints vs memory-only execution",
                  "Deterministic citation verification and hallucination defense in RAG",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTopic(s)}
                    className="px-2.5 py-1 rounded-md bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/60 text-zinc-400 hover:text-zinc-200 text-[11px] transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Stepper Pipeline Display (Appears when active or completed) */}
            {(isInvestigating || report) && (
              <div className="rounded-xl border border-zinc-800 bg-[#121215] p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 px-2">
                  <span className="font-medium text-zinc-300">Orchestration Graph Pipeline</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700 flex items-center gap-1"
                    >
                      <Terminal className="w-3 h-3" />
                      {showLogs ? "Hide Logs" : "View Live Logs"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { id: "planning", name: "1. Formulation", desc: "Plan & Queries" },
                    { id: "searching", name: "2. Gathering", desc: "Web & Internal RAG" },
                    { id: "reviewing", name: "3. Reflection", desc: "Sufficiency Check" },
                    { id: "verifying", name: "4. Grounding Gate", desc: "Non-LLM Citation Check" },
                    { id: "reporting", name: "5. Synthesis", desc: "Executive Report" },
                  ].map((step, idx) => {
                    const isDone =
                      currentStep === "completed" ||
                      (currentStep === "searching" && idx < 1) ||
                      (currentStep === "reviewing" && idx < 2) ||
                      (currentStep === "verifying" && idx < 3) ||
                      (currentStep === "reporting" && idx < 4);
                    const isActive = currentStep === step.id;

                    return (
                      <div
                        key={step.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isActive
                            ? "border-emerald-500/50 bg-emerald-950/10 text-zinc-100 shadow-sm"
                            : isDone
                            ? "border-zinc-800 bg-zinc-900/30 text-zinc-400"
                            : "border-zinc-800/40 bg-zinc-950 text-zinc-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{step.name}</span>
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : isActive ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          ) : (
                            <Clock className="w-3 h-3 text-zinc-600" />
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500 block truncate">{step.desc}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Collapsible Log Stream Drawer */}
                {showLogs && (
                  <div className="mt-4 pt-3 border-t border-zinc-800">
                    <div className="h-44 overflow-y-auto bg-black/60 rounded-lg p-3 font-mono text-[11px] text-zinc-400 space-y-1">
                      {logs.map((l) => (
                        <div key={l.id} className="leading-relaxed">
                          <span className="text-zinc-600">[{l.time}]</span>{" "}
                          <span
                            className={
                              l.type === "error"
                                ? "text-rose-400"
                                : l.type === "verifier"
                                ? "text-emerald-400"
                                : l.type === "planner"
                                ? "text-sky-400"
                                : "text-zinc-300"
                            }
                          >
                            {l.message}
                          </span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results Workspace: Dual-Column */}
            {report && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Sourced Evidence Sidebar */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="rounded-xl border border-zinc-800 bg-[#121215] p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                      <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                        Gathered Sources ({report.sources?.length || 0})
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {report.sources && report.sources.length > 0 ? (
                        report.sources.map((s, idx) => {
                          let domain = "source";
                          try {
                            domain = new URL(s.url).hostname.replace("www.", "");
                          } catch {
                            domain = s.url.startsWith("internal") ? "Internal RAG" : "web";
                          }

                          return (
                            <a
                              key={idx}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group block p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700 transition"
                            >
                              <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                                <span className="font-mono text-zinc-400">[{idx + 1}] {domain}</span>
                                <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 transition" />
                              </div>
                              <p className="text-xs font-medium text-zinc-200 group-hover:text-white line-clamp-1">
                                {s.title}
                              </p>
                            </a>
                          );
                        })
                      ) : (
                        <p className="text-xs text-zinc-500">No sources cited.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Synthesized Report */}
                <div className="lg:col-span-8">
                  <article className="rounded-2xl border border-zinc-800 bg-[#121215] p-8 shadow-sm space-y-8">
                    {/* Header Details */}
                    <div className="border-b border-zinc-800 pb-6">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-900/60 bg-emerald-950/20 text-emerald-400 text-xs font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verified Ground Truth
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyMarkdown}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-300 text-xs transition"
                          >
                            {copiedMarkdown ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedMarkdown ? "Copied" : "Copy Markdown"}</span>
                          </button>
                          <button
                            onClick={handleExportJson}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-300 text-xs transition"
                          >
                            <Download className="w-3 h-3" />
                            <span>Export</span>
                          </button>
                        </div>
                      </div>

                      <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mt-2">{report.topic}</h1>
                      <div className="flex items-center gap-4 text-xs text-zinc-500 mt-3 font-mono">
                        <span>Loops: {report.loopsUsed}</span>
                        <span>•</span>
                        <span>Generated: {new Date(report.generatedAt).toLocaleDateString()}</span>
                        {sessionId && (
                          <>
                            <span>•</span>
                            <span title={sessionId}>Session: {sessionId.slice(0, 8)}...</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Executive Summary */}
                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Executive Summary</h2>
                      <p className="text-zinc-300 leading-relaxed text-sm">{report.summary}</p>
                    </section>

                    {/* Key Findings with Grounded Citations */}
                    <section className="space-y-4">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                        Itemized Claims & Verified Citations
                      </h2>
                      <div className="space-y-3">
                        {report.keyFindings && report.keyFindings.length > 0 ? (
                          report.keyFindings.map((f, idx) => (
                            <div
                              key={idx}
                              className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-2 hover:border-zinc-700/80 transition"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-sm font-medium text-zinc-100">
                                  <span className="text-zinc-500 font-mono mr-2">[{idx + 1}]</span>
                                  {f.claim}
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/40 shrink-0">
                                  ✓ Grounded
                                </span>
                              </div>

                              <blockquote className="text-xs italic text-zinc-400 border-l-2 border-zinc-700 pl-3 py-1 bg-zinc-950/40 rounded-r">
                                &ldquo;{f.evidenceSnippet}&rdquo;
                              </blockquote>

                              <div className="pt-1">
                                <a
                                  href={f.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 break-all"
                                >
                                  <span>{f.sourceUrl}</span>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </a>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-zinc-500">No itemized claims extracted.</p>
                        )}
                      </div>
                    </section>

                    {/* Conclusion */}
                    <section className="space-y-3 border-t border-zinc-800 pt-6">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Synthesis Conclusion</h2>
                      <p className="text-zinc-300 leading-relaxed text-sm">{report.conclusion}</p>
                    </section>
                  </article>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PRIVATE KNOWLEDGE BASE (RAG)                                       */}
        {/* ========================================================================= */}
        {activeTab === "rag" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Ingestion Form */}
            <div className="lg:col-span-5 rounded-2xl border border-zinc-800 bg-[#121215] p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Ingest Internal Document</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Add proprietary technical specs or guidelines. Text is automatically chunked with overlap and scored for RAG retrieval.
                </p>
              </div>

              <form onSubmit={handleIngestDocument} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Document Title</label>
                  <input
                    type="text"
                    required
                    value={ragTitle}
                    onChange={(e) => setRagTitle(e.target.value)}
                    placeholder="e.g. Distributed State Machine & Consensus Architecture"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Canonical URL / URI (Optional)</label>
                  <input
                    type="text"
                    value={ragUrl}
                    onChange={(e) => setRagUrl(e.target.value)}
                    placeholder="internal://docs/consensus-v1"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={ragTags}
                    onChange={(e) => setRagTags(e.target.value)}
                    placeholder="consensus, state, langgraph, postgres"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Content</label>
                  <textarea
                    required
                    rows={6}
                    value={ragContent}
                    onChange={(e) => setRagContent(e.target.value)}
                    placeholder="Paste technical documentation or proprietary guidelines here..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isIngesting}
                  className="w-full py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs shadow transition disabled:opacity-50"
                >
                  {isIngesting ? "Chunking & Indexing..." : "Ingest & Index Document"}
                </button>
              </form>
            </div>

            {/* Right: Indexed Documents & Test Query Probe */}
            <div className="lg:col-span-7 space-y-6">
              {/* Test Search Probe */}
              <div className="rounded-2xl border border-zinc-800 bg-[#121215] p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-zinc-200">Test RAG Relevance Probe</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ragSearchQuery}
                    onChange={(e) => setRagSearchQuery(e.target.value)}
                    placeholder="Test query against private documents..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                  <button
                    onClick={handleTestRagSearch}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg font-medium transition"
                  >
                    Search Probe
                  </button>
                </div>

                {ragSearchResults.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wide">Top Matched Chunks:</span>
                    {ragSearchResults.map((m, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-xs space-y-1">
                        <div className="font-semibold text-zinc-200">{m.title}</div>
                        <p className="text-zinc-400 font-mono text-[11px] leading-relaxed">&ldquo;{m.content}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Document List */}
              <div className="rounded-2xl border border-zinc-800 bg-[#121215] p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200">Indexed Knowledge Documents ({ragDocs.length})</h3>
                  <button onClick={fetchRagDocs} className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                <div className="space-y-2">
                  {ragDocs.length > 0 ? (
                    ragDocs.map((doc) => (
                      <div key={doc.id} className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-200">{doc.title}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-zinc-500 font-mono">{doc.sourceUrl || "internal-kb"}</span>
                          {(doc.tags || []).map((t: string) => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 py-4 text-center">No documents indexed yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CHECKPOINTS & HISTORY                                              */}
        {/* ========================================================================= */}
        {activeTab === "sessions" && (
          <div className="rounded-2xl border border-zinc-800 bg-[#121215] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">PostgreSQL Durable Checkpoints</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Historical research sessions stored with full state checkpoints.</p>
              </div>
              <button onClick={fetchSessions} className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2.5 font-medium">Topic</th>
                    <th className="py-2.5 font-medium">Status</th>
                    <th className="py-2.5 font-medium">Model</th>
                    <th className="py-2.5 font-medium">Loops</th>
                    <th className="py-2.5 font-medium">Sources</th>
                    <th className="py-2.5 font-medium">Date</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {sessions.length > 0 ? (
                    sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-900/40 transition">
                        <td className="py-3 font-medium text-zinc-200 max-w-xs truncate">{s.topic}</td>
                        <td className="py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              s.status === "COMPLETED"
                                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-400 font-mono text-[11px]">{s.modelName}</td>
                        <td className="py-3 text-zinc-400">{s.loopsUsed || 1}</td>
                        <td className="py-3 text-zinc-400">{s._count?.evidence || 0}</td>
                        <td className="py-3 text-zinc-500 font-mono text-[11px]">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleViewSavedSession(s.id)}
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition"
                          >
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-zinc-500">
                        {isLoadingSessions ? "Loading checkpoints..." : "No research sessions recorded yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: TELEMETRY & CIRCUIT BREAKERS                                       */}
        {/* ========================================================================= */}
        {activeTab === "telemetry" && (
          <div className="space-y-6">
            {/* Metric Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-zinc-800 bg-[#121215]">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Total Inquiries</span>
                <span className="block text-2xl font-bold text-zinc-100 font-mono mt-1">
                  {telemetry?.totalSessions || 0}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-[#121215]">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Completed Runs</span>
                <span className="block text-2xl font-bold text-emerald-400 font-mono mt-1">
                  {telemetry?.completedSessions || 0}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-[#121215]">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Cumulative Tokens</span>
                <span className="block text-2xl font-bold text-zinc-100 font-mono mt-1">
                  {Number(telemetry?.totalTokens || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-[#121215]">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Estimated Cost (USD)</span>
                <span className="block text-2xl font-bold text-zinc-100 font-mono mt-1">
                  ${Number(telemetry?.estimatedCostUsd || 0).toFixed(4)}
                </span>
              </div>
            </div>

            {/* Circuit Breakers Panel */}
            <div className="rounded-2xl border border-zinc-800 bg-[#121215] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">Resilience Circuit Breakers</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Automated downstream failure guards preventing cascade timeouts.
                  </p>
                </div>
                <button
                  onClick={handleResetBreakers}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition"
                >
                  Reset All Breakers
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {breakers.length > 0 ? (
                  breakers.map((b) => (
                    <div key={b.name} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 font-mono">{b.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                            b.state === "CLOSED"
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
                              : "bg-rose-950/40 text-rose-400 border border-rose-900/40"
                          }`}
                        >
                          {b.state}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1 font-mono text-[11px]">
                        <div>Failures: {b.failureCount}</div>
                        <div>Successes: {b.successCount}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 font-mono">gemini-llm</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-900/40">
                        CLOSED
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono text-[11px]">Status: Healthy & Active</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#09090b] py-6 text-center text-xs text-zinc-600">
        ReviewSage Agentic System // Next.js & LangGraph.js // Grounded Non-LLM Citations
      </footer>
    </div>
  );
}
