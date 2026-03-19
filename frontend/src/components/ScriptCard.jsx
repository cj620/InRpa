import React from "react";
import "./ScriptCard.css";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ScriptCard({ script, status, selected, onClick }) {
  const statusClass = status || "idle";

  return (
    <div
      className={`script-card ${selected ? "selected" : ""} status-${statusClass}`}
      onClick={onClick}
    >
      <div className="script-card-indicator" />
      <div className="script-card-content">
        <div className="script-card-name">{script.name}</div>
        <div className="script-card-meta">
          <span className={`script-card-status status-${statusClass}`}>
            {statusClass}
          </span>
          <span className="script-card-size">{formatSize(script.size)}</span>
        </div>
      </div>
    </div>
  );
}
