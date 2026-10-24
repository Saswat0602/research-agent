// =========================================================
// REVIEWSAGE AI // COMMAND CENTER APPLICATION CONTROLLER
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let currentReportData = null;
  let activeEventSource = null;

  // DOM Elements - Navigation
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // DOM Elements - Research
  const formResearch = document.getElementById("form-research-mission");
  const inputTopic = document.getElementById("input-topic");
  const selectProvider = document.getElementById("select-provider");
  const inputMaxLoops = document.getElementById("input-max-loops");
  const btnStartResearch = document.getElementById("btn-start-research");
  const quickTopicPills = document.querySelectorAll(".pill-btn");

  // Pipeline Nodes
  const nodePlanner = document.getElementById("node-planner");
  const nodeSearcher = document.getElementById("node-searcher");
  const nodeReviewer = document.getElementById("node-reviewer");
  const nodeVerifier = document.getElementById("node-verifier");
  const nodeReporter = document.getElementById("node-reporter");
  const conn1 = document.getElementById("conn-1");
  const conn2 = document.getElementById("conn-2");
  const conn3 = document.getElementById("conn-3");
  const conn4 = document.getElementById("conn-4");
  const displayIterationBadge = document.getElementById("display-iteration-badge");
  const displayStatusBadge = document.getElementById("display-status-badge");

  // Terminal & Evidence
  const liveEventStream = document.getElementById("live-event-stream");
  const btnClearLogs = document.getElementById("btn-clear-logs");
  const evidenceCardList = document.getElementById("evidence-card-list");
  const evidenceCountSpan = document.getElementById("evidence-count");

  // Report Elements
  const reportEmptyState = document.getElementById("report-empty-state");
  const renderedReportContent = document.getElementById("rendered-report-content");
  const repTopic = document.getElementById("rep-topic");
  const repLoops = document.getElementById("rep-loops");
  const repSourcesCount = document.getElementById("rep-sources-count");
  const repClaimsCount = document.getElementById("rep-claims-count");
  const repSessionId = document.getElementById("rep-session-id");
  const repSummary = document.getElementById("rep-summary");
  const repFindingsContainer = document.getElementById("rep-findings-container");
  const repSourcesList = document.getElementById("rep-sources-list");
  const repConclusion = document.getElementById("rep-conclusion");
  const btnCopyMarkdown = document.getElementById("btn-copy-markdown");
  const btnExportJson = document.getElementById("btn-export-json");
  const badgeVerifiedClaims = document.getElementById("badge-verified-claims");

  // Telemetry & Header
  const headerTokensCount = document.getElementById("header-tokens-count");
  const activeModelDisplay = document.getElementById("active-model-display");
  const btnRefreshHealth = document.getElementById("btn-refresh-health");

  // RAG DOM Elements
  const formRagIngest = document.getElementById("form-rag-ingest");
  const tbodyKbDocuments = document.getElementById("tbody-kb-documents");
  const btnReloadDocs = document.getElementById("btn-reload-docs");
  const inputRagSearchProbe = document.getElementById("input-rag-search-probe");
  const btnTestRagSearch = document.getElementById("btn-test-rag-search");
  const ragProbeResults = document.getElementById("rag-probe-results");
  const ragProbeCards = document.getElementById("rag-probe-cards");

  // Telemetry Tab DOM Elements
  const telTotalSessions = document.getElementById("tel-total-sessions");
  const telCompletedSessions = document.getElementById("tel-completed-sessions");
  const telTotalTokens = document.getElementById("tel-total-tokens");
  const telTotalCost = document.getElementById("tel-total-cost");
  const breakersContainer = document.getElementById("breakers-container");
  const btnResetAllBreakers = document.getElementById("btn-reset-all-breakers");

  // Sessions Tab DOM Elements
  const tbodySessions = document.getElementById("tbody-sessions");
  const btnRefreshSessions = document.getElementById("btn-refresh-sessions");

  // Prompts Tab DOM Elements
  const promptPlannerPersona = document.getElementById("prompt-planner-persona");
  const promptReviewerPersona = document.getElementById("prompt-reviewer-persona");
  const promptReporterPersona = document.getElementById("prompt-reporter-persona");
  const btnSavePrompts = document.getElementById("btn-save-prompts");

  // ==========================================
  // TAB NAVIGATION
  // ==========================================
  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTabId = tab.getAttribute("data-tab");

      navTabs.forEach((t) => t.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.add("hidden"));

      tab.classList.add("active");
      const targetPane = document.getElementById(targetTabId);
      if (targetPane) targetPane.classList.remove("hidden");

      // Lazy load tab data
      if (targetTabId === "tab-rag") loadKnowledgeDocuments();
      if (targetTabId === "tab-telemetry") loadTelemetry();
      if (targetTabId === "tab-sessions") loadSessionsList();
      if (targetTabId === "tab-prompts") loadPrompts();
    });
  });

  // Quick Topic Pills
  quickTopicPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      inputTopic.value = pill.getAttribute("data-topic");
      inputTopic.focus();
    });
  });

  // Clear Terminal Logs
  btnClearLogs.addEventListener("click", () => {
    liveEventStream.innerHTML = `<div class="log-line log-system">[CLEARED] Telemetry log stream reset.</div>`;
  });

  // ==========================================
  // PIPELINE VISUALIZER STATE MACHINE
  // ==========================================
  function resetPipelineVisuals() {
    [nodePlanner, nodeSearcher, nodeReviewer, nodeVerifier, nodeReporter].forEach((n) => {
      n.classList.remove("active", "completed");
    });
    [conn1, conn2, conn3, conn4].forEach((c) => c.classList.remove("active"));
    displayStatusBadge.textContent = "Idle";
    displayStatusBadge.className = "status-indicator-badge";
  }

  function setPipelineStep(step, iteration = 1) {
    displayIterationBadge.textContent = `Iteration ${iteration}`;
    displayStatusBadge.textContent = `Running: ${step}`;
    displayStatusBadge.className = "status-indicator-badge status-running";

    if (step.includes("planner") || step.includes("plan")) {
      nodePlanner.classList.add("active");
    } else if (step.includes("search") || step.includes("evidence")) {
      nodePlanner.classList.remove("active");
      nodePlanner.classList.add("completed");
      conn1.classList.add("active");
      nodeSearcher.classList.add("active");
    } else if (step.includes("review") || step.includes("evaluat")) {
      nodeSearcher.classList.remove("active");
      nodeSearcher.classList.add("completed");
      conn2.classList.add("active");
      nodeReviewer.classList.add("active");
    } else if (step.includes("verifier") || step.includes("grounding") || step.includes("citation")) {
      nodeReviewer.classList.remove("active");
      nodeReviewer.classList.add("completed");
      conn3.classList.add("active");
      nodeVerifier.classList.add("active");
    } else if (step.includes("report") || step.includes("synthesis") || step.includes("complet")) {
      nodeVerifier.classList.remove("active");
      nodeVerifier.classList.add("completed");
      conn4.classList.add("active");
      nodeReporter.classList.add("active");
    }
  }

  function setPipelineCompleted() {
    [nodePlanner, nodeSearcher, nodeReviewer, nodeVerifier, nodeReporter].forEach((n) => {
      n.classList.remove("active");
      n.classList.add("completed");
    });
    [conn1, conn2, conn3, conn4].forEach((c) => c.classList.add("active"));
    displayStatusBadge.textContent = "Mission Accomplished";
    displayStatusBadge.className = "status-indicator-badge status-completed";
  }

  // ==========================================
  // LIVE LOG LOGGING UTILITY
  // ==========================================
  function appendLog(message, category = "system") {
    const time = new Date().toLocaleTimeString();
    const line = document.createElement("div");
    line.className = `log-line log-${category}`;
    line.textContent = `[${time}] ${message}`;
    liveEventStream.appendChild(line);
    liveEventStream.scrollTop = liveEventStream.scrollHeight;
  }

  // ==========================================
  // RESEARCH EXECUTION VIA SSE STREAM
  // ==========================================
  formResearch.addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = inputTopic.value.trim();
    if (!topic) return;

    const provider = selectProvider.value;
    const maxIterations = parseInt(inputMaxLoops.value, 10) || 3;

    // Reset UI
    resetPipelineVisuals();
    btnStartResearch.disabled = true;
    btnStartResearch.querySelector(".btn-text").textContent = "Investigating...";
    evidenceCardList.innerHTML = "";
    evidenceCountSpan.textContent = "0";
    reportEmptyState.classList.remove("hidden");
    renderedReportContent.classList.add("hidden");
    badgeVerifiedClaims.classList.add("hidden");
    btnCopyMarkdown.disabled = true;
    btnExportJson.disabled = true;

    appendLog(`[MISSION INITIATED] Topic: "${topic}" (Max Iterations: ${maxIterations}, Provider: ${provider})`, "system");

    // Close any prior stream
    if (activeEventSource) {
      activeEventSource.close();
    }

    try {
      const streamUrl = `/api/v1/research/stream?topic=${encodeURIComponent(topic)}&maxIterations=${maxIterations}`;
      activeEventSource = new EventSource(streamUrl);

      let currentEvidenceCount = 0;
      let sessionIteration = 1;

      activeEventSource.addEventListener("status", (event) => {
        const data = JSON.parse(event.data);
        appendLog(`[STATUS] ${data.step}: ${JSON.stringify(data.details || {})}`, "system");
        setPipelineStep(data.step, sessionIteration);
      });

      activeEventSource.addEventListener("node_start", (event) => {
        const data = JSON.parse(event.data);
        sessionIteration = data.iteration || sessionIteration;
        appendLog(`[NODE EXECUTION] Starting node: ${data.node}`, data.node);
        setPipelineStep(data.node, sessionIteration);
      });

      activeEventSource.addEventListener("node_update", (event) => {
        const data = JSON.parse(event.data);
        const node = data.node;
        const state = data.state || {};

        if (node === "planner" && state.plan) {
          appendLog(`[PLAN CREATED] Initial queries: ${state.plan.initialQueries?.join(" | ")}`, "planner");
          setPipelineStep("searcher", sessionIteration);
        }

        if (node === "searcher" && Array.isArray(state.evidence)) {
          appendLog(`[EVIDENCE GATHERED] Retrieved ${state.evidence.length} new source(s)`, "searcher");
          state.evidence.forEach((ev) => {
            currentEvidenceCount++;
            evidenceCountSpan.textContent = String(currentEvidenceCount);
            renderEvidenceCard(ev);
          });
          setPipelineStep("reviewer", sessionIteration);
        }

        if (node === "reviewer" && state.assessment) {
          const suff = state.assessment.isSufficient ? "Sufficient" : "Insufficient (Next loop)";
          appendLog(`[EVALUATION] Evidence sufficiency: ${suff} (Confidence: ${state.assessment.confidenceScore})`, "reviewer");
          setPipelineStep("verifier", sessionIteration);
        }

        if (node === "reporter" && state.finalReport) {
          appendLog(`[REPORT READY] Synthesis finalized with ${state.finalReport.keyFindings?.length || 0} findings`, "reporter");
        }
      });

      activeEventSource.addEventListener("completed", (event) => {
        const data = JSON.parse(event.data);
        appendLog(`[MISSION COMPLETE] Session persisted: ${data.sessionId}`, "system");
        setPipelineCompleted();
        renderFinalReport(data.report, data.sessionId);
        activeEventSource.close();
        btnStartResearch.disabled = false;
        btnStartResearch.querySelector(".btn-text").textContent = "Launch Investigation";
        refreshHealthOverview();
      });

      activeEventSource.addEventListener("error", (event) => {
        console.error("SSE stream error:", event);
        appendLog(`[STREAM DISCONNECT] Connection ended or encountered error`, "error");
        activeEventSource.close();
        btnStartResearch.disabled = false;
        btnStartResearch.querySelector(".btn-text").textContent = "Launch Investigation";
      });
    } catch (err) {
      appendLog(`[FAILED TO LAUNCH] ${err.message}`, "error");
      btnStartResearch.disabled = false;
      btnStartResearch.querySelector(".btn-text").textContent = "Launch Investigation";
    }
  });

  // Render individual evidence card
  function renderEvidenceCard(ev) {
    const item = document.createElement("div");
    item.className = "evidence-item";
    const domain = ev.url.startsWith("http") ? new URL(ev.url).hostname : "Internal RAG";
    const isInternal = ev.title.includes("[Internal");

    item.innerHTML = `
      <div class="evidence-header">
        <a href="${ev.url}" target="_blank" rel="noopener noreferrer" class="evidence-title">${escapeHtml(ev.title)}</a>
        <span class="evidence-badge ${isInternal ? 'badge-internal' : ''}">${escapeHtml(domain)}</span>
      </div>
      <div class="evidence-excerpt">${escapeHtml(ev.content)}</div>
    `;
    evidenceCardList.prepend(item);
  }

  // Render Complete Synthesized Report
  function renderFinalReport(report, sessionId) {
    currentReportData = report;
    reportEmptyState.classList.add("hidden");
    renderedReportContent.classList.remove("hidden");

    repTopic.textContent = report.topic;
    repLoops.textContent = report.loopsUsed || 1;
    repSourcesCount.textContent = report.sources?.length || 0;
    repClaimsCount.textContent = report.keyFindings?.length || 0;
    repSessionId.textContent = sessionId ? sessionId.slice(0, 8) + "..." : "ephemeral";

    badgeVerifiedClaims.textContent = `${report.keyFindings?.length || 0} Grounded Claims`;
    badgeVerifiedClaims.classList.remove("hidden");

    repSummary.textContent = report.summary;
    repConclusion.textContent = report.conclusion;

    // Render Key Findings Cards
    repFindingsContainer.innerHTML = "";
    if (report.keyFindings && report.keyFindings.length > 0) {
      report.keyFindings.forEach((f, idx) => {
        const card = document.createElement("div");
        card.className = "finding-card";
        card.innerHTML = `
          <div class="finding-header">
            <div class="finding-claim"><strong>[${idx + 1}]</strong> ${escapeHtml(f.claim)}</div>
            <span class="finding-badge">✓ NON-LLM VERIFIED</span>
          </div>
          <div class="finding-snippet">"${escapeHtml(f.evidenceSnippet)}"</div>
          <a href="${f.sourceUrl}" target="_blank" rel="noopener noreferrer" class="finding-source-link">Source: ${escapeHtml(f.sourceUrl)}</a>
        `;
        repFindingsContainer.appendChild(card);
      });
    } else {
      repFindingsContainer.innerHTML = `<p class="empty-state-small">No specific claims extracted.</p>`;
    }

    // Render Sources List
    repSourcesList.innerHTML = "";
    if (report.sources && report.sources.length > 0) {
      report.sources.forEach((s, idx) => {
        const li = document.createElement("li");
        li.className = "source-item";
        li.innerHTML = `
          <span>[${idx + 1}]</span>
          <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="source-link">${escapeHtml(s.title)}</a>
        `;
        repSourcesList.appendChild(li);
      });
    }

    btnCopyMarkdown.disabled = false;
    btnExportJson.disabled = false;
  }

  // Copy Markdown Report
  btnCopyMarkdown.addEventListener("click", () => {
    if (!currentReportData) return;
    const md = buildMarkdownReport(currentReportData);
    navigator.clipboard.writeText(md).then(() => {
      const origText = btnCopyMarkdown.textContent;
      btnCopyMarkdown.textContent = "✅ Copied!";
      setTimeout(() => (btnCopyMarkdown.textContent = origText), 2000);
    });
  });

  // Export JSON Report
  btnExportJson.addEventListener("click", () => {
    if (!currentReportData) return;
    const blob = new Blob([JSON.stringify(currentReportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  function buildMarkdownReport(r) {
    return `# RESEARCH REPORT: ${r.topic}

**Generated At:** ${r.generatedAt}
**Loops Used:** ${r.loopsUsed}

## Executive Summary
${r.summary}

## Key Findings & Sourced Ground Truth
${(r.keyFindings || []).map((f, i) => `### [${i + 1}] ${f.claim}
- **Source:** ${f.sourceUrl}
- **Snippet:** "${f.evidenceSnippet}"`).join("\n\n")}

## Referenced Sources
${(r.sources || []).map((s, i) => `[${i + 1}] [${s.title}](${s.url})`).join("\n")}

## Conclusion
${r.conclusion}
`;
  }

  // ==========================================
  // TAB 2: PRIVATE KNOWLEDGE BASE (RAG)
  // ==========================================
  async function loadKnowledgeDocuments() {
    tbodyKbDocuments.innerHTML = `<tr><td colspan="4" class="table-loading">Loading documents...</td></tr>`;
    try {
      const res = await fetch("/api/v1/knowledge");
      const data = await res.json();
      if (!data.success || !data.documents || data.documents.length === 0) {
        tbodyKbDocuments.innerHTML = `<tr><td colspan="4" class="empty-state-small">No private knowledge documents indexed yet. Use the form on the left to ingest.</td></tr>`;
        return;
      }

      tbodyKbDocuments.innerHTML = "";
      data.documents.forEach((doc) => {
        const tr = document.createElement("tr");
        const dateStr = new Date(doc.createdAt).toLocaleDateString();
        tr.innerHTML = `
          <td><strong>${escapeHtml(doc.title)}</strong></td>
          <td><small>${escapeHtml(doc.sourceUrl || "internal-kb")}</small></td>
          <td>${(doc.tags || []).map((t) => `<span class="evidence-badge">${escapeHtml(t)}</span>`).join(" ")}</td>
          <td>${dateStr}</td>
        `;
        tbodyKbDocuments.appendChild(tr);
      });
    } catch (err) {
      tbodyKbDocuments.innerHTML = `<tr><td colspan="4" class="log-error">Error loading documents: ${err.message}</td></tr>`;
    }
  }

  formRagIngest.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("rag-doc-title").value.trim();
    const sourceUrl = document.getElementById("rag-doc-url").value.trim() || undefined;
    const tagsRaw = document.getElementById("rag-doc-tags").value.trim();
    const content = document.getElementById("rag-doc-content").value.trim();

    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];

    const submitBtn = document.getElementById("btn-submit-rag-doc");
    submitBtn.disabled = true;
    submitBtn.textContent = "Ingesting & Chunking...";

    try {
      const res = await fetch("/api/v1/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceUrl, tags, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to ingest document");

      appendLog(`[RAG INGESTION] Indexed internal document: "${title}"`, "verifier");
      formRagIngest.reset();
      loadKnowledgeDocuments();
      alert("Document ingested successfully with automated chunking and indexing!");
    } catch (err) {
      alert(`Ingestion error: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "📥 Ingest & Index Document";
    }
  });

  btnReloadDocs.addEventListener("click", loadKnowledgeDocuments);

  // Test RAG Search Probe
  btnTestRagSearch.addEventListener("click", async () => {
    const q = inputRagSearchProbe.value.trim();
    if (!q) return;

    ragProbeResults.classList.remove("hidden");
    ragProbeCards.innerHTML = `<div class="empty-state-small">Searching private knowledge...</div>`;

    try {
      const res = await fetch(`/api/v1/knowledge/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        ragProbeCards.innerHTML = `<div class="empty-state-small">No internal matches found for "${escapeHtml(q)}".</div>`;
        return;
      }

      ragProbeCards.innerHTML = "";
      data.results.forEach((match) => {
        const card = document.createElement("div");
        card.className = "finding-card";
        card.innerHTML = `
          <div class="finding-header">
            <strong>${escapeHtml(match.title)}</strong>
            <span class="evidence-badge">Match URL: ${escapeHtml(match.url)}</span>
          </div>
          <div class="finding-snippet">"${escapeHtml(match.content)}"</div>
        `;
        ragProbeCards.appendChild(card);
      });
    } catch (err) {
      ragProbeCards.innerHTML = `<div class="log-error">Search error: ${err.message}</div>`;
    }
  });

  // ==========================================
  // TAB 3: TELEMETRY & CIRCUIT BREAKERS
  // ==========================================
  async function loadTelemetry() {
    try {
      const [overviewRes, breakersRes] = await Promise.all([
        fetch("/api/v1/telemetry/overview"),
        fetch("/api/v1/telemetry/circuit-breakers"),
      ]);

      const overviewData = await overviewRes.json();
      const breakersData = await breakersRes.json();

      if (overviewData.success && overviewData.telemetry) {
        const t = overviewData.telemetry;
        telTotalSessions.textContent = t.totalSessions || 0;
        telCompletedSessions.textContent = t.completedSessions || 0;
        telTotalTokens.textContent = Number(t.totalTokens || 0).toLocaleString();
        telTotalCost.textContent = `$${Number(t.estimatedCostUsd || 0).toFixed(4)}`;
        headerTokensCount.textContent = Number(t.totalTokens || 0).toLocaleString();
      }

      breakersContainer.innerHTML = "";
      if (breakersData.breakers && breakersData.breakers.length > 0) {
        breakersData.breakers.forEach((b) => {
          const card = document.createElement("div");
          card.className = "breaker-card";
          const isClosed = b.state === "CLOSED";
          card.innerHTML = `
            <div class="breaker-header">
              <span class="breaker-name">${escapeHtml(b.name)}</span>
              <span class="breaker-status-badge ${isClosed ? 'breaker-status-closed' : 'breaker-status-open'}">${b.state}</span>
            </div>
            <div class="breaker-metric-row">
              <span>Failure Count:</span>
              <strong>${b.failureCount}</strong>
            </div>
            <div class="breaker-metric-row">
              <span>Success Count:</span>
              <strong>${b.successCount}</strong>
            </div>
            <div class="breaker-metric-row">
              <span>Last Failure:</span>
              <span>${b.lastFailureTime > 0 ? new Date(b.lastFailureTime).toLocaleTimeString() : 'None'}</span>
            </div>
          `;
          breakersContainer.appendChild(card);
        });
      } else {
        breakersContainer.innerHTML = `
          <div class="breaker-card">
            <div class="breaker-header">
              <span class="breaker-name">gemini-llm</span>
              <span class="breaker-status-badge breaker-status-closed">CLOSED</span>
            </div>
            <div class="breaker-metric-row"><span>Status:</span><span>Operational</span></div>
          </div>
          <div class="breaker-card">
            <div class="breaker-header">
              <span class="breaker-name">web-search</span>
              <span class="breaker-status-badge breaker-status-closed">CLOSED</span>
            </div>
            <div class="breaker-metric-row"><span>Status:</span><span>Operational</span></div>
          </div>
        `;
      }
    } catch (err) {
      console.error("Telemetry load error:", err);
    }
  }

  btnResetAllBreakers.addEventListener("click", async () => {
    try {
      await fetch("/api/v1/telemetry/circuit-breakers/reset", { method: "POST" });
      loadTelemetry();
      alert("All circuit breakers successfully reset to CLOSED.");
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  });

  // ==========================================
  // TAB 4: SESSIONS & CHECKPOINTS
  // ==========================================
  async function loadSessionsList() {
    tbodySessions.innerHTML = `<tr><td colspan="7" class="table-loading">Loading sessions from PostgreSQL...</td></tr>`;
    try {
      const res = await fetch("/api/v1/sessions");
      const data = await res.json();
      if (!data.success || !data.sessions || data.sessions.length === 0) {
        tbodySessions.innerHTML = `<tr><td colspan="7" class="empty-state-small">No research sessions recorded yet.</td></tr>`;
        return;
      }

      tbodySessions.innerHTML = "";
      data.sessions.forEach((s) => {
        const tr = document.createElement("tr");
        const statusBadge = `<span class="badge ${s.status === 'COMPLETED' ? 'badge-success' : 'badge-enterprise'}">${s.status}</span>`;
        const dateStr = new Date(s.createdAt).toLocaleString();

        tr.innerHTML = `
          <td><strong>${escapeHtml(s.topic)}</strong></td>
          <td>${statusBadge}</td>
          <td><small>${escapeHtml(s.modelProvider)} (${escapeHtml(s.modelName)})</small></td>
          <td>${s.loopsUsed || 1}</td>
          <td>${s._count?.evidence || 0}</td>
          <td><small>${dateStr}</small></td>
          <td>
            <button class="btn btn-xs btn-secondary btn-view-session" data-id="${s.id}">View Report</button>
          </td>
        `;
        tbodySessions.appendChild(tr);
      });

      // Attach view session handlers
      document.querySelectorAll(".btn-view-session").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sid = btn.getAttribute("data-id");
          viewSavedSession(sid);
        });
      });
    } catch (err) {
      tbodySessions.innerHTML = `<tr><td colspan="7" class="log-error">Error loading sessions: ${err.message}</td></tr>`;
    }
  }

  async function viewSavedSession(sessionId) {
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}`);
      const data = await res.json();
      if (!data.success || !data.session) throw new Error("Session not found");

      const s = data.session;
      if (s.report) {
        const formattedReport = {
          topic: s.topic,
          summary: s.report.summary,
          conclusion: s.report.conclusion,
          generatedAt: s.report.generatedAt,
          loopsUsed: s.loopsUsed || 1,
          keyFindings: (s.report.findings || []).map((f) => ({
            claim: f.claim,
            sourceUrl: f.sourceUrl,
            evidenceSnippet: f.evidenceSnippet,
          })),
          sources: (s.evidence || []).map((e) => ({
            title: e.title,
            url: e.url,
          })),
        };

        // Switch to Research tab and render
        document.getElementById("tab-btn-research").click();
        renderFinalReport(formattedReport, sessionId);
        appendLog(`[SESSION RESTORED] Loaded session ${sessionId} from PostgreSQL checkpointer`, "system");
      } else {
        alert("This session does not have a compiled final report.");
      }
    } catch (err) {
      alert(`Could not load session: ${err.message}`);
    }
  }

  btnRefreshSessions.addEventListener("click", loadSessionsList);

  // ==========================================
  // TAB 5: PROMPT REGISTRY STUDIO
  // ==========================================
  async function loadPrompts() {
    try {
      const res = await fetch("/api/v1/prompts");
      const data = await res.json();
      if (data.success && data.prompts) {
        promptPlannerPersona.value = data.prompts.planner?.personaInstructions || "";
        promptReviewerPersona.value = data.prompts.reviewer?.evaluationCriteria || "";
        promptReporterPersona.value = data.prompts.reporter?.synthesisTone || "";
      }
    } catch (err) {
      console.error("Failed to load prompts:", err);
    }
  }

  btnSavePrompts.addEventListener("click", async () => {
    btnSavePrompts.disabled = true;
    btnSavePrompts.textContent = "Saving...";

    try {
      const body = {
        planner: { personaInstructions: promptPlannerPersona.value.trim() },
        reviewer: { evaluationCriteria: promptReviewerPersona.value.trim() },
        reporter: { synthesisTone: promptReporterPersona.value.trim() },
      };

      const res = await fetch("/api/v1/prompts/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update prompts");

      alert("Prompt customizations saved live! Subsequent research graph nodes will use updated instructions.");
      appendLog(`[PROMPT REGISTRY] Prompt guidelines updated dynamically.`, "system");
    } catch (err) {
      alert(`Save error: ${err.message}`);
    } finally {
      btnSavePrompts.disabled = false;
      btnSavePrompts.textContent = "💾 Save Custom Prompts";
    }
  });

  // ==========================================
  // HEALTH & TELEMETRY INITIALIZATION
  // ==========================================
  async function refreshHealthOverview() {
    try {
      const res = await fetch("/api/v1/health");
      const data = await res.json();
      if (data.status === "ok") {
        activeModelDisplay.textContent = `${data.provider} (${data.model})`;
      }
    } catch {
      activeModelDisplay.textContent = "Offline";
    }
  }

  btnRefreshHealth.addEventListener("click", refreshHealthOverview);

  // HTML escaping helper
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initial Boot
  refreshHealthOverview();
});
