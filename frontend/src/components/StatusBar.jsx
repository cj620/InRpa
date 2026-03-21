import React from "react";
import { useSettings } from "../contexts/SettingsContext";
import "./StatusBar.css";

export default function StatusBar({ connected, scripts, statuses, onNavigate, syncStatus, syncMessage }) {
  const { settings } = useSettings();
  const runningCount = Object.values(statuses).filter((s) => s === "running").length;

  const aiModel = settings?.ai?.model;
  const aiKey = settings?.ai?.api_key;
  const hasKey = aiKey && aiKey.length > 0;

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span className={`statusbar-dot ${connected ? "connected" : ""}`} />
        <span className="statusbar-text">
          {connected ? "Connected" : "Disconnected"}
        </span>
        {syncStatus === "syncing" && (
          <>
            <span className="statusbar-separator" />
            <span className="statusbar-text statusbar-syncing">⟳ 同步中...</span>
          </>
        )}
        {syncStatus === "offline" && (
          <>
            <span className="statusbar-separator" />
            <span className="statusbar-text statusbar-offline" title={syncMessage}>本地缓存</span>
          </>
        )}
        {syncStatus === "ok" && syncMessage && (
          <>
            <span className="statusbar-separator" />
            <span className="statusbar-text statusbar-synced" title={syncMessage}>✓ 已同步</span>
          </>
        )}
        <span className="statusbar-separator" />
        <span
          className="statusbar-ai"
          onClick={() => onNavigate?.("settings")}
          title="打开 AI 设置"
        >
          <svg className="statusbar-ai-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="9" cy="16" r="1" />
            <circle cx="15" cy="16" r="1" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="statusbar-ai-model">
            {hasKey ? (aiModel || "未设置模型") : "未配置"}
          </span>
          <span className={`statusbar-dot-small ${hasKey ? "configured" : ""}`} />
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
