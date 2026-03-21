import React, { useRef, useEffect, useState } from "react";
import "./LogPanel.css";

export default function LogPanel({ scriptName, logs, status, onRun, onStop, onClearLogs }) {
  const logEndRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const lines = logs || [];

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines.length, autoScroll]);

  if (!scriptName) {
    return (
      <div className="log-panel empty">
        <div className="log-panel-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
          <p>Select a script to view details</p>
        </div>
      </div>
    );
  }

  const isRunning = status === "running";

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <div className="log-panel-title">
          <span className="log-panel-filename">{scriptName}.py</span>
          {status && (
            <span className={`log-panel-status status-${status}`}>
              {status}
            </span>
          )}
        </div>
        <div className="log-panel-header-actions">
          <button
            className="log-panel-scroll-btn"
            onClick={() => {
              const text = lines.join("\n");
              navigator.clipboard.writeText(text);
            }}
            title="Copy logs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <button
            className={`log-panel-scroll-btn ${autoScroll ? "active" : ""}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="log-panel-terminal">
        {lines.length === 0 ? (
          <div className="log-panel-no-logs">No output yet. Click Run to start.</div>
        ) : (
          lines.map((line, i) => {
            let level = "info";
            if (/warning|warn/i.test(line)) level = "warn";
            if (/error|fail|exception|traceback/i.test(line)) level = "error";

            return (
              <div key={i} className={`log-line log-${level}`}>
                <span className="log-line-text">{line}</span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>

      <div className="log-panel-actions">
        {isRunning ? (
          <button className="action-btn action-stop" onClick={onStop}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop
          </button>
        ) : (
          <button className="action-btn action-run" onClick={onRun}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run
          </button>
        )}
        <button className="action-btn action-clear" onClick={onClearLogs}>
          Clear
        </button>
      </div>
    </div>
  );
}
