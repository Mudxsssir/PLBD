
import { useCallback, useEffect, useMemo, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import type { editor } from "monaco-editor";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  FileCode2,
  Files,
  History,
  Lightbulb,
  Play,
  RefreshCw,
  Search,
  Settings,
  X,
  Trash2,
} from "lucide-react";
import "./App.css";
import TerminalPanel from "./TerminalPanel";
import WorkspaceExplorer from "./WorkspaceExplorer";

const API_URL = "http://127.0.0.1:8000";
const ANALYZE_URL = `${API_URL}/analyze`;
const HEALTH_URL = `${API_URL}/health`;

const STARTER_CODE = `#include <stdio.h>

int main(void) {
    int numbers[5] = {10, 20, 30, 40, 50};
    int sum = 0;

    for (int i = 0; i <= 5; i++) {
        sum += numbers[i];
    }

    printf("Sum = %d\\n", sum);
    return 0;
}`;

type Diagnostic = {
  line: number;
  column: number;
  severity: string;
  message: string;
};

type LogicFinding = {
  rule_id: string;
  line: number;
  column?: number;
  severity?: string;
  title?: string;
  message: string;
  explanation?: string;
  suggestion?: string;
  confidence?: string;
};

type Misconception = {
  rule_id?: string;
  category_id?: string;
  category: string;
  concept?: string;
  title?: string;
  description?: string;
  misconception?: string;
  learning_explanation?: string;
  recommended_action?: string;
  confidence?: number | string;
};

type Exercise = {
  id: string;
  title: string;
  difficulty?: string;
  description?: string;
  question?: string;
  hint?: string;
  answer?: string;
};

type Recommendation = {
  category_id?: string;
  triggered_by?: string;
  title?: string;
  category?: string;
  focus?: string;
  lesson?: string;
  description?: string;
  exercises?: Exercise[];
};

type AnalysisResult = {
  success: boolean;
  diagnostics: Diagnostic[];
  logic_findings: LogicFinding[];
  misconceptions: Misconception[];
  recommendations: Recommendation[];
  compiler?: string;
  duration_ms?: number;
};

type HistoryEntry = {
  id: number;
  code: string;
  date: string;
  errors: number;
  warnings: number;
  findings: number;
  result?: AnalysisResult;
};

type PanelTab = "Problems" | "Output";
type AssistantTab = "Explain" | "Problems" | "Practice";
type ActivityTab = "explorer" | "search" | "history" | "learning";

const emptyResult: AnalysisResult = {
  success: true,
  diagnostics: [],
  logic_findings: [],
  misconceptions: [],
  recommendations: [],
};

function safeParseArray<T>(value: string | null): T[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadArrayFromStorage<T>(key: string): T[] {
  try {
    return safeParseArray<T>(localStorage.getItem(key));
  } catch {
    return [];
  }
}

function App() {
  const [code, setCode] = useState(STARTER_CODE);
  const [activeFile, setActiveFile] = useState("");
  const [fileReady, setFileReady] = useState(false);
  const [outlineExpanded, setOutlineExpanded] = useState(true);

  const openWorkspaceFile = useCallback((path: string, content: string) => {
    setActiveFile(path);
    setCode(content);
    setFileReady(true);
    setResult(emptyResult);
    setSelectedFinding(null);
    setAnalysisError("");
  }, []);

  useEffect(() => {
    if (!fileReady || !activeFile) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(API_URL + "/workspace/file", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: activeFile, content: code }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail || "Unable to save file.");
        }
      } catch (error) {
        setOutput(error instanceof Error ? error.message : "Unable to save file.");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [code, activeFile, fileReady]);

  const outlineItems = useMemo(() => {
    return code.split("\n").flatMap((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      if (!trimmed || trimmed.startsWith("//")) return [];

      const include = trimmed.match(/^#include\s+[<"]([^>"]+)[>"]/);
      if (include) {
        return [{ label: include[1], kind: "Include", line: lineNumber }];
      }

      const struct = trimmed.match(/^\s*(?:typedef\s+)?struct\s+([A-Za-z_]\w*)?/);
      if (struct) {
        return [{ label: struct[1] || "struct", kind: "Structure", line: lineNumber }];
      }

      const enumMatch = trimmed.match(/^\s*(?:typedef\s+)?enum\s+([A-Za-z_]\w*)?/);
      if (enumMatch) {
        return [{ label: enumMatch[1] || "enum", kind: "Enumeration", line: lineNumber }];
      }

      const functionMatch = trimmed.match(
        /^\s*(?:static\s+)?(?:inline\s+)?(?:const\s+)?[A-Za-z_]\w*(?:\s*\*)?\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/
      );
      if (functionMatch) {
        return [{ label: functionMatch[1], kind: "Function", line: lineNumber }];
      }

      return [];
    });
  }, [code]);
  const [result, setResult] = useState<AnalysisResult>(emptyResult);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [terminalRunId, setTerminalRunId] = useState(0);
  const [analysisError, setAnalysisError] = useState("");
  const [backendOnline, setBackendOnline] = useState(false);

  const [activeActivity, setActiveActivity] =
    useState<ActivityTab>("explorer");

  const [assistantTab, setAssistantTab] =
    useState<AssistantTab>("Explain");

  const [bottomTab, setBottomTab] = useState<PanelTab>("Problems");
  const [panelOpen, setPanelOpen] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [selectedFinding, setSelectedFinding] =
    useState<LogicFinding | null>(null);

  const [editorInstance, setEditorInstance] =
    useState<editor.IStandaloneCodeEditor | null>(null);

  const [completedExercises, setCompletedExercises] =
    useState<string[]>(() => loadArrayFromStorage("plbd-completed"));

  const [expandedExercise, setExpandedExercise] =
    useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    loadArrayFromStorage<HistoryEntry>("plbd-history")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [analysisVersion, setAnalysisVersion] = useState(0);

  const [output, setOutput] = useState(
    "PLBD is ready. Your code will be analyzed automatically."
  );

  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  const diagnostics = result.diagnostics;
  const findings = result.logic_findings;
  const misconceptions = result.misconceptions;
  const recommendations = result.recommendations;

  const exercises = useMemo(
    () => recommendations.flatMap((item) => item.exercises || []),
    [recommendations]
  );

  const totalProblems = diagnostics.length + findings.length;

  const errorCount = diagnostics.filter(
    (item) =>
      item.severity === "error" ||
      item.severity === "fatal error"
  ).length;

  const warningCount = diagnostics.filter(
    (item) => item.severity === "warning"
  ).length;

  const completedCount = exercises.filter((exercise) =>
    completedExercises.includes(exercise.id)
  ).length;

  const progressPercentage = exercises.length
    ? Math.round((completedCount / exercises.length) * 100)
    : 0;

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return [];

    return code
      .split("\n")
      .map((line, index) => ({
        line: index + 1,
        text: line,
      }))
      .filter((item) => item.text.toLowerCase().includes(query));
  }, [code, searchQuery]);

  const learningCategories = useMemo(() => {
    const unique = new Map<string, Misconception>();

    misconceptions.forEach((item) => {
      const key = item.category_id || item.category;
      if (key && !unique.has(key)) {
        unique.set(key, item);
      }
    });

    return Array.from(unique.values());
  }, [misconceptions]);

  // Persist locally restored learning progress and analysis history.
  useEffect(() => {
    try {
      localStorage.setItem(
        "plbd-completed",
        JSON.stringify(completedExercises)
      );

      localStorage.setItem(
        "plbd-history",
        JSON.stringify(history)
      );
    } catch {
      // Keep the application usable if browser storage is unavailable.
    }
  }, [completedExercises, history]);

  // Check the real backend health endpoint.
  useEffect(() => {
    let active = true;

    const checkBackend = async () => {
      try {
        const response = await fetch(HEALTH_URL, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Backend unavailable");
        }

        const data = await response.json();

        if (active) {
          setBackendOnline(data.status === "healthy");
        }
      } catch {
        if (active) {
          setBackendOnline(false);
        }
      }
    };

    checkBackend();

    const interval = window.setInterval(checkBackend, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Automatic analysis, with manual refresh support.
  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      if (!activeFile.toLowerCase().endsWith(".c")) {
        setResult(emptyResult);
        setAnalysisError("");
        setIsAnalyzing(false);
        setSelectedFinding(null);
        return;
      }

      if (!code.trim()) {
        setResult(emptyResult);
        setAnalysisError("");
        setIsAnalyzing(false);
        setSelectedFinding(null);
        return;
      }

      setIsAnalyzing(true);
      setAnalysisError("");

      try {
        const response = await fetch(ANALYZE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Analysis failed (${response.status})`);
        }

        const data: AnalysisResult = await response.json();

        const normalized: AnalysisResult = {
          success: Boolean(data.success),
          diagnostics: data.diagnostics || [],
          logic_findings: data.logic_findings || [],
          misconceptions: data.misconceptions || [],
          recommendations: data.recommendations || [],
          compiler: data.compiler || "Clang",
          duration_ms: data.duration_ms,
        };

        if (controller.signal.aborted) return;

        setResult(normalized);
        setSelectedFinding(null);
        setBackendOnline(true);

        const entry: HistoryEntry = {
          id: Date.now(),
          code,
          date: new Date().toLocaleString(),
          errors: normalized.diagnostics.filter(
            (item) =>
              item.severity === "error" ||
              item.severity === "fatal error"
          ).length,
          warnings: normalized.diagnostics.filter(
            (item) => item.severity === "warning"
          ).length,
          findings: normalized.logic_findings.length,
          result: normalized,
        };

        setHistory((previous) => {
          const existing = previous.filter(
            (item) => item.code !== code
          );

          return [entry, ...existing].slice(0, 50);
        });

        setOutput(
          `Analysis completed successfully.
Compiler: ${normalized.compiler}
Duration: ${normalized.duration_ms ?? "—"} ms

${
  normalized.success
    ? "No compiler errors detected."
    : "Compiler errors detected. Review the Problems panel."
}

Logic findings: ${normalized.logic_findings.length}
Learning concepts: ${normalized.misconceptions.length}
Recommended exercises: ${normalized.recommendations.reduce(
            (total, item) => total + (item.exercises?.length || 0),
            0
          )}`
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        if (controller.signal.aborted) return;

        const message =
          error instanceof Error
            ? error.message
            : "Unable to connect to the backend.";

        setAnalysisError(message);
        setBackendOnline(false);

        setOutput(
          "Unable to reach the PLBD backend.\nCheck that the FastAPI server is running on port 8000."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsAnalyzing(false);
        }
      }
    }, analysisVersion > 0 ? 0 : 600);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [code, analysisVersion, activeFile]);

  // Display compiler diagnostics and highlight affected source lines.
  useEffect(() => {
    if (!editorInstance) return;

    const model = editorInstance.getModel();
    if (!model) return;

    const markers: monaco.editor.IMarkerData[] = [
      ...diagnostics.map((item) => ({
        startLineNumber: Math.max(1, item.line),
        startColumn: Math.max(1, item.column || 1),
        endLineNumber: Math.max(1, item.line),
        endColumn: Math.max(2, (item.column || 1) + 1),
        message: item.message,
        severity:
          item.severity === "warning"
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Error,
      })),

      ...findings.map((item) => ({
        startLineNumber: Math.max(1, item.line),
        startColumn: Math.max(1, item.column || 1),
        endLineNumber: Math.max(1, item.line),
        endColumn: Math.max(2, (item.column || 1) + 1),
        message: item.message,
        severity: monaco.MarkerSeverity.Warning,
      })),
    ];

    monaco.editor.setModelMarkers(model, "plbd", markers);

    const decorations = [
      ...diagnostics.map((item) => ({
        range: new monaco.Range(
          Math.max(1, item.line),
          1,
          Math.max(1, item.line),
          1
        ),
        options: {
          isWholeLine: true,
          className:
            item.severity === "warning"
              ? "plbd-warning-line"
              : "plbd-error-line",
        },
      })),
      ...findings.map((item) => ({
        range: new monaco.Range(
          Math.max(1, item.line),
          1,
          Math.max(1, item.line),
          1
        ),
        options: {
          isWholeLine: true,
          className: "plbd-warning-line",
        },
      })),
    ];

    const decorationIds = editorInstance.deltaDecorations(
      [],
      decorations
    );

    return () => {
      monaco.editor.setModelMarkers(model, "plbd", []);
      editorInstance.deltaDecorations(decorationIds, []);
    };
  }, [diagnostics, findings, editorInstance]);

  const handleEditorMount: OnMount = (editor) => {
    setEditorInstance(editor);

    editor.onDidChangeCursorPosition((event) => {
      setCursorLine(event.position.lineNumber);
      setCursorColumn(event.position.column);
    });
  };

  const goToLine = (line: number, column = 1) => {
    if (!editorInstance) return;

    editorInstance.revealLineInCenter(line);
    editorInstance.setPosition({
      lineNumber: line,
      column,
    });
    editorInstance.focus();
  };

  const analyzeNow = () => {
    setBottomTab("Problems");
    setPanelOpen(true);
    setAnalysisVersion((previous) => previous + 1);
  };

  // Start an interactive C execution session in the terminal.
  const runCode = () => {
    if (!activeFile.toLowerCase().endsWith(".c") || !code.trim() || isRunning) return;

    setBottomTab("Output");
    setPanelOpen(true);
    setTerminalRunId((previous) => previous + 1);
  };

  const loadHistory = (entry: HistoryEntry) => {
    setCode(entry.code);
    setFileReady(false);
    setActiveActivity("explorer");
    setSidebarOpen(true);

    if (entry.result) {
      setResult(entry.result);
      setAnalysisError("");
      setSelectedFinding(null);

      setOutput(
        `Restored saved analysis.
Original date: ${entry.date}
Compiler: ${entry.result.compiler || "Clang"}
Logic findings: ${entry.findings}`
      );
    } else {
      setOutput(
        `Restored source code from ${entry.date}.\nA new analysis will run automatically.`
      );
    }

    setBottomTab("Output");
    setPanelOpen(true);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("plbd-history");
  };

  const toggleExercise = (id: string) => {
    setCompletedExercises((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const selectFinding = (finding: LogicFinding) => {
    setSelectedFinding(finding);
    setAssistantTab("Problems");
    setAssistantOpen(true);
    goToLine(finding.line, finding.column || 1);
  };

  const activityItems = [
    { id: "explorer" as const, icon: Files, label: "Explorer" },
    { id: "search" as const, icon: Search, label: "Search" },
    { id: "history" as const, icon: History, label: "History" },
    { id: "learning" as const, icon: BookOpen, label: "Learning" },
  ];

  void output;
  void cursorLine;
  void cursorColumn;

  return (
    <div className="plbd-app">
      <header className="titlebar">
        <div className="titlebar-brand">
          <div className="brand-mark">
            <Code2 size={19} />
          </div>

          <span className="brand-name">PLBD</span>
          <span className="brand-divider">/</span>

          <span className="brand-subtitle">
            Programming Logic Blind Spot Detector
          </span>
        </div>

        <div className="titlebar-center">
          <span className="titlebar-project">PLBD Workspace</span>
        </div>

        <div className="titlebar-actions">
          <span className="connection-indicator">
            <span
              className={`status-dot ${
                backendOnline ? "" : "offline"
              }`}
            />
            {backendOnline ? "Backend connected" : "Backend offline"}
          </span>

          <button
            className="icon-button"
            title="Settings"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={17} />
          </button>
        </div>
      </header>

      <div className="workbench">
        <aside className="activity-bar">
          <div className="activity-top">
            {activityItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`activity-button ${
                  activeActivity === id ? "active" : ""
                }`}
                title={label}
                onClick={() => {
                  setActiveActivity(id);
                  setSidebarOpen(true);
                }}
              >
                <Icon size={21} strokeWidth={1.7} />
              </button>
            ))}
          </div>

          <div className="activity-bottom">
            <button
              className="activity-button"
              title="Learning assistant"
              onClick={() => setAssistantOpen(!assistantOpen)}
            >
              <Lightbulb size={21} strokeWidth={1.7} />
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <aside className="sidebar">
            <div className="sidebar-heading">
              <span>
                {activeActivity === "explorer"
                  ? "EXPLORER"
                  : activeActivity === "search"
                    ? "SEARCH"
                    : activeActivity === "history"
                      ? "HISTORY"
                      : "LEARNING"}
              </span>

              <button
                className="subtle-icon"
                onClick={() => setSidebarOpen(false)}
                title="Close sidebar"
              >
                <X size={15} />
              </button>
            </div>

            {activeActivity === "explorer" && (
              <div className="explorer-content">
                <WorkspaceExplorer
                  activeFile={activeFile}
                  onOpenFile={openWorkspaceFile}
                  onPathRenamed={(oldPath, newPath) => {
                    setActiveFile((current) =>
                      current === oldPath || current.startsWith(oldPath + "/")
                        ? current.replace(oldPath, newPath)
                        : current
                    );
                  }}
                  onFileDeleted={() => {
                    setActiveFile("");
                    setCode("");
                    setFileReady(false);
                  }}
                />
                {activeFile.toLowerCase().endsWith(".c") && (
                  <div className="explorer-section">
                    <button
                      type="button"
                      className="section-label explorer-toggle"
                      onClick={() => setOutlineExpanded(!outlineExpanded)}
                    >
                      {outlineExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span>OUTLINE</span>
                    </button>
                    {outlineExpanded && (
                      <div className="outline-list">
                        {outlineItems.length === 0 ? (
                          <div className="outline-empty">
                            <span>No code structures detected.</span>
                          </div>
                        ) : (
                          outlineItems.map((item, index) => (
                            <button
                              type="button"
                              className="outline-item"
                              key={item.kind + "-" + item.line + "-" + index}
                              onClick={() => goToLine(item.line)}
                              title={"Go to line " + item.line}
                            >
                              <Code2 size={13} />
                              <span>{item.label}</span>
                              <small>{item.kind}</small>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeActivity === "search" && (
              <div className="sidebar-content">
                <div className="sidebar-description">
                  Search within your current code.
                </div>

                <div className="search-input">
                  <Search size={14} />

                  <input
                    value={searchQuery}
                    placeholder="Search code..."
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                  />
                </div>

                {searchQuery.trim() && (
                  <div className="search-results">
                    <div className="sidebar-description">
                      {searchResults.length} matching lines
                    </div>

                    {searchResults.map((item) => (
                      <button
                        className="history-item"
                        key={item.line}
                        onClick={() => goToLine(item.line)}
                      >
                        <FileCode2 size={14} />
                        <div>
                          <strong>Line {item.line}</strong>
                          <small>{item.text.trim() || "(empty line)"}</small>
                        </div>
                      </button>
                    ))}

                    {searchResults.length === 0 && (
                      <div className="empty-state">
                        No matches found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeActivity === "history" && (
              <div className="sidebar-content">
                <div className="sidebar-description">
                  Recent code analyses · {history.length} saved
                </div>

                {history.length === 0 ? (
                  <div className="empty-state">
                    <History size={25} />
                    <span>No analysis history yet.</span>
                  </div>
                ) : (
                  <>
                    {history.map((entry) => (
                      <button
                        className="history-item"
                        key={entry.id}
                        onClick={() => loadHistory(entry)}
                      >
                        <FileCode2 size={15} />

                        <div>
                          <strong>main.c</strong>
                          <small>{entry.date}</small>
                          <small>
                            {entry.errors} errors · {entry.warnings} warnings
                          </small>
                          <small>
                            {entry.findings} logic findings
                          </small>
                        </div>
                      </button>
                    ))}

                    <button
                      className="text-action"
                      onClick={clearHistory}
                    >
                      <Trash2 size={13} />
                      Clear history
                    </button>
                  </>
                )}
              </div>
            )}

            {activeActivity === "learning" && (
              <div className="sidebar-content">
                <div className="learning-sidebar-card">
                  <BookOpen size={22} />

                  <strong>Your learning progress</strong>

                  <p>
                    Complete exercises generated from your detected
                    programming misconceptions.
                  </p>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  <small>
                    {completedCount} / {exercises.length} exercises completed
                  </small>
                </div>

                {learningCategories.map((item, index) => (
                  <div className="misconception-sidebar" key={index}>
                    <AlertTriangle size={15} />
                    <span>
                      {item.category || item.category_id}
                    </span>
                  </div>
                ))}

                {learningCategories.length === 0 && (
                  <div className="empty-state">
                    <BookOpen size={22} />
                    <span>
                      Learning concepts will appear after code analysis.
                    </span>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}

        <main className="main-area">
          <div className="editor-tabs">
            <div className="editor-tab active">
              <FileCode2 size={15} />
              <span>{activeFile.split("/").pop() || "No file open"}</span>
              {activeFile && <span className="tab-unsaved" />}

              {activeFile && (
                <button
                  className="tab-close"
                  title="Clear editor"
                  onClick={() => setCode("")}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="editor-tab-actions">
              <button
                className="run-button"
                onClick={runCode}
                disabled={!activeFile.toLowerCase().endsWith(".c") || isRunning || !code.trim()}
                title="Compile and run C program"
              >
                <Play size={13} />
                <span>{isRunning ? "Running..." : "Run"}</span>
              </button>

              <button
                className="icon-button"
                title="Analyze now"
                onClick={analyzeNow}
                disabled={activeFile !== "main.c" || isAnalyzing}
              >
                <RefreshCw
                  size={15}
                  className={isAnalyzing ? "spin" : ""}
                />
              </button>

              <button
                className="icon-button"
                title="Toggle assistant"
                onClick={() => setAssistantOpen(!assistantOpen)}
              >
                <Lightbulb size={16} />
              </button>
            </div>
          </div>

          <div className="breadcrumb">
            <span>PLBD</span>
            <ChevronRight size={13} />
            {activeFile.split("/").slice(0, -1).map((part) => (
              <span key={part}>{part} / </span>
            ))}
            <FileCode2 size={13} />
            <span>{activeFile.split("/").pop() || "No file open"}</span>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              language={activeFile.toLowerCase().endsWith(".c") || activeFile.toLowerCase().endsWith(".h") ? "c" : activeFile.toLowerCase().endsWith(".md") ? "markdown" : activeFile.toLowerCase().endsWith(".json") ? "json" : "plaintext"}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || "")}
              onMount={handleEditorMount}
              options={{
                fontSize: 14,
                fontFamily:
                  "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
                minimap: { enabled: false },
                padding: { top: 18, bottom: 18 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                lineNumbers: "on",
                renderLineHighlight: "all",
                roundedSelection: false,
                tabSize: 4,
                wordWrap: "on",
                smoothScrolling: true,
                cursorBlinking: "smooth",
                bracketPairColorization: { enabled: true },
                guides: {
                  indentation: true,
                  bracketPairs: true,
                },
              }}
            />
          </div>

          {panelOpen && (
            <section className="bottom-panel">
              <div className="panel-header">
                <div className="panel-tabs">
                  <button
                    className={bottomTab === "Problems" ? "active" : ""}
                    onClick={() => setBottomTab("Problems")}
                  >
                    PROBLEMS

                    {totalProblems > 0 && (
                      <span className="count-pill">
                        {totalProblems}
                      </span>
                    )}
                  </button>

                  <button
                    className={bottomTab === "Output" ? "active" : ""}
                    onClick={() => setBottomTab("Output")}
                  >
                    OUTPUT
                  </button>
                </div>

                <button
                  className="subtle-icon"
                  onClick={() => setPanelOpen(false)}
                  title="Close panel"
                >
                  <X size={15} />
                </button>
              </div>

              {bottomTab === "Problems" ? (
                <div className="problems-list">
                  {analysisError && (
                    <div className="problem-row error-row">
                      <AlertCircle size={15} />
                      <span>{analysisError}</span>
                    </div>
                  )}

                  {diagnostics.map((item, index) => (
                    <button
                      key={`diagnostic-${index}`}
                      className="problem-row"
                      onClick={() =>
                        goToLine(item.line, item.column)
                      }
                    >
                      {item.severity === "warning" ? (
                        <AlertTriangle size={15} />
                      ) : (
                        <AlertCircle size={15} />
                      )}

                      <span className="problem-message">
                        {item.message}
                      </span>

                      <span className="problem-location">
                        main.c ({item.line}, {item.column})
                      </span>
                    </button>
                  ))}

                  {findings.map((item, index) => (
                    <button
                      key={`logic-${index}`}
                      className="problem-row logic-row"
                      onClick={() => selectFinding(item)}
                    >
                      <Lightbulb size={15} />

                      <span className="problem-message">
                        {item.message}
                      </span>

                      <span className="problem-location">
                        main.c ({item.line})
                      </span>
                    </button>
                  ))}

                  {!isAnalyzing &&
                    !analysisError &&
                    totalProblems === 0 && (
                      <div className="no-problems">
                        <Check size={17} />
                        No problems detected.
                      </div>
                    )}

                  {isAnalyzing && (
                    <div className="no-problems">
                      <RefreshCw size={15} className="spin" />
                      Analyzing code...
                    </div>
                  )}
                </div>
              ) : (
                <div className="execution-output-panel">
                  <TerminalPanel
                    code={code}
                    runId={terminalRunId}
                    onRunningChange={setIsRunning}
                  />
                </div>
              )}
            </section>
          )}
        </main>

        {assistantOpen && (
          <aside className="assistant-panel">
            <div className="assistant-header">
              <div className="assistant-title">
                <div className="assistant-icon">
                  <Lightbulb size={16} />
                </div>
                <div>
                  <strong>Learning Assistant</strong>
                  <small>Understand and improve your logic</small>
                </div>
              </div>
              <button
                className="subtle-icon"
                title="Close assistant"
                onClick={() => setAssistantOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="assistant-tabs">
              {(["Explain", "Problems", "Practice"] as AssistantTab[]).map((tab) => (
                <button
                  key={tab}
                  className={assistantTab === tab ? "active" : ""}
                  onClick={() => setAssistantTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="assistant-content">
              {assistantTab === "Explain" && (
                <>
                  <div className="assistant-intro">
                    <div className="assistant-section-icon">
                      <BookOpen size={17} />
                    </div>
                    <h3>Your learning overview</h3>
                    <p>
                      Review your analysis results and focus on the concepts
                      that need attention.
                    </p>
                  </div>

                  <div className="assistant-card">
                    <div className="card-heading">
                      ANALYSIS SUMMARY
                      <span className="live-tag">LIVE</span>
                    </div>
                    <div className="analysis-stat">
                      Compiler errors <strong>{errorCount}</strong>
                    </div>
                    <div className="analysis-stat">
                      Warnings <strong>{warningCount}</strong>
                    </div>
                    <div className="analysis-stat">
                      Logic findings <strong>{findings.length}</strong>
                    </div>
                    <div className="analysis-stat">
                      Learning concepts <strong>{misconceptions.length}</strong>
                    </div>
                  </div>

                  {misconceptions.length > 0 ? (
                    misconceptions.map((item, index) => (
                      <div className="assistant-card" key={`${item.category}-${index}`}>
                        <div className="card-heading">CONCEPT TO REVIEW</div>
                        <strong>{item.title || item.concept || item.category}</strong>
                        <p>{item.learning_explanation || item.description || item.misconception}</p>
                        {item.recommended_action && (
                          <div className="suggestion-box">
                            <Lightbulb size={14} />
                            <span>{item.recommended_action}</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="assistant-card muted-card">
                      <Check size={17} />
                      <p>
                        No specific misconceptions have been identified yet.
                        Analyze a C program to receive learning guidance.
                      </p>
                    </div>
                  )}

                  {findings.length > 0 && (
                    <div className="assistant-card">
                      <div className="card-heading">SUGGESTED FOCUS</div>
                      {findings.slice(0, 5).map((item, index) => (
                        <button
                          className="focus-item"
                          key={`${item.rule_id}-${index}`}
                          onClick={() => selectFinding(item)}
                        >
                          <Lightbulb size={14} />
                          <span>{item.title || item.message}</span>
                          <ChevronRight size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {assistantTab === "Problems" && (
                <>
                  <div className="assistant-intro">
                    <div className="assistant-section-icon">
                      <AlertCircle size={17} />
                    </div>
                    <h3>Logic analysis</h3>
                    <p>
                      Select a finding to understand why it occurs and how
                      to improve your code.
                    </p>
                  </div>

                  {selectedFinding && (
                    <div className="assistant-card selected-problem">
                      <div className="card-heading">SELECTED FINDING</div>
                      <strong>
                        {selectedFinding.title || selectedFinding.message}
                      </strong>
                      <p>{selectedFinding.explanation || selectedFinding.message}</p>
                      {selectedFinding.suggestion && (
                        <div className="suggestion-box">
                          <Lightbulb size={14} />
                          <span>{selectedFinding.suggestion}</span>
                        </div>
                      )}
                      <div className="assistant-note">
                        <Code2 size={14} />
                        Line {selectedFinding.line}
                        {selectedFinding.confidence
                          ? ` · Confidence: ${selectedFinding.confidence}`
                          : ""}
                      </div>
                    </div>
                  )}

                  {findings.length > 0 ? (
                    findings.map((item, index) => (
                      <button
                        className="finding-card"
                        key={`${item.rule_id}-${index}`}
                        onClick={() => selectFinding(item)}
                      >
                        <div className="finding-card-heading">
                          <Lightbulb size={14} />
                          <strong>{item.title || item.rule_id}</strong>
                          <span>Line {item.line}</span>
                        </div>
                        <p>{item.message}</p>
                        <small>
                          {selectedFinding === item ? "Currently selected" : "View explanation"}
                        </small>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state">
                      <Check size={20} />
                      No logic findings are available. Analyze your code to
                      see potential problems here.
                    </div>
                  )}
                </>
              )}

              {assistantTab === "Practice" && (
                <>
                  <div className="assistant-intro">
                    <div className="assistant-section-icon">
                      <BookOpen size={17} />
                    </div>
                    <h3>Practice and improve</h3>
                    <p>
                      Work through recommended exercises to strengthen
                      the concepts identified by the analyzer.
                    </p>
                  </div>

                  {recommendations.some((item) => (item.exercises || []).length > 0) ? (
                    recommendations.map((recommendation, index) => (
                      <div key={`${recommendation.category_id || recommendation.title || "topic"}-${index}`}>
                        <div className="card-heading">
                          {recommendation.title || recommendation.focus || recommendation.category || "RECOMMENDED PRACTICE"}
                        </div>

                        {(recommendation.exercises || []).map((exercise) => {
                          const isExpanded = expandedExercise === exercise.id;
                          const isCompleted = completedExercises.includes(exercise.id);

                          return (
                            <div className="exercise-card" key={exercise.id}>
                              <div className="exercise-heading">
                                <span>{exercise.difficulty || "PRACTICE"}</span>
                                <button
                                  title={isExpanded ? "Collapse exercise" : "Expand exercise"}
                                  onClick={() =>
                                    setExpandedExercise(isExpanded ? null : exercise.id)
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={15} />
                                  ) : (
                                    <ChevronRight size={15} />
                                  )}
                                </button>
                              </div>

                              <strong>{exercise.title}</strong>
                              <p>{exercise.description || exercise.question || "Complete this exercise to strengthen your understanding."}</p>

                              {isExpanded && (
                                <div className="exercise-details">
                                  {exercise.question && <p>{exercise.question}</p>}
                                  {exercise.hint && (
                                    <div className="hint-box">
                                      <Lightbulb size={14} />
                                      <span>{exercise.hint}</span>
                                    </div>
                                  )}
                                  {exercise.answer && (
                                    <details>
                                      <summary>Show suggested answer</summary>
                                      <p>{exercise.answer}</p>
                                    </details>
                                  )}
                                </div>
                              )}

                              <button
                                className={`complete-button ${isCompleted ? "completed" : ""}`}
                                onClick={() => toggleExercise(exercise.id)}
                              >
                                <Check size={14} />
                                {isCompleted ? "Completed" : "Mark as completed"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <BookOpen size={20} />
                      No practice exercises are available yet. Analyze a
                      program to receive recommendations.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="assistant-footer">
              <span className={`assistant-footer-dot ${backendOnline ? "" : "offline"}`} />
              {backendOnline ? "Analyzer connected" : "Analyzer offline"}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;
