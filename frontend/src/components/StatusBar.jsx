import React from "react";
import "./StatusBar.css";

export default function StatusBar({ connected, scripts, statuses }) {
  const runningCount = Object.values(statuses).filter((s) => s === "running").length;

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span className={`statusbar-dot ${connected ? "connected" : ""}`} />
        <span className="statusbar-text">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      <div className="statusbar-right">
        <span className="statusbar-text">
          {runningCount > 0 ? `${runningCount} running / ` : ""}
          {scripts.length} scripts
        </span>
      </div>
    </div>
  );
}
