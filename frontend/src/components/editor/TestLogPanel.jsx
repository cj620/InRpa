import React, { useRef, useEffect } from "react";
import "./TestLogPanel.css";

function LogLine({ line }) {
  const level = (line.level || "info").toLowerCase();
  return (
    <div className={`test-log-line test-log-${level}`}>
      <span className="test-log-time">
        {line.timestamp ? new Date(line.timestamp).toLocaleTimeString() : ""}
      </span>
      <span className="test-log-text">{line.message || line}</span>
    </div>
  );
}

function StatusIndicator({ status }) {
  const labels = {
    idle: "空闲",
    running: "运行中",
    completed: "已完成",
    failed: "失败",
  };

  return (
    <div className={`test-log-status test-log-status-${status}`}>
      {status === "running" && <span className="test-log-spinner" />}
      <span>{labels[status] || status}</span>
    </div>
  );
}

export default function TestLogPanel({ status, logs }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [logs]);

  const hasLogs = logs && logs.length > 0;

  return (
    <div className="test-log-panel">
      <div className="test-log-header">
        <StatusIndicator status={status || "idle"} />
        {hasLogs && (
          <span className="test-log-count">{logs.length} 行</span>
        )}
      </div>
      <div ref={scrollRef} className="test-log-body">
        {!hasLogs ? (
          <div className="test-log-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>点击工具栏的测试按钮运行草稿</span>
          </div>
        ) : (
          logs.map((line, i) => <LogLine key={i} line={line} />)
        )}
      </div>
    </div>
  );
}
