import React from "react";
import "./ScriptCard.css";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHr < 24) return `${diffHr}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export default function ScriptCard({ script, status, selected, onClick, onEdit }) {
  const isDraft = script.is_draft;
  const statusClass = isDraft ? "idle" : (status || "idle");

  const handleEdit = (e) => {
    e.stopPropagation();
    // For draft scripts, open the parent script in editor
    onEdit?.(isDraft ? script.parent_name : script.name);
  };

  return (
    <div
      className={`script-card ${selected ? "selected" : ""} ${isDraft ? "is-draft" : ""} status-${statusClass}`}
      onClick={onClick}
    >
      <div className="script-card-indicator" />
      <div className="script-card-content">
        <div className="script-card-top">
          <div className="script-card-name">
            {isDraft ? script.parent_name : script.name}
          </div>
          {isDraft ? (
            <span className="script-card-draft-badge" title="草稿文件">
              <span className="script-card-draft-dot" />
              草稿
            </span>
          ) : script.has_draft ? (
            <span className="script-card-has-draft-badge" title="有草稿">
              有草稿
            </span>
          ) : null}
        </div>
        <div className="script-card-meta">
          {isDraft ? (
            <span className="script-card-status status-draft">draft</span>
          ) : (
            <span className={`script-card-status status-${statusClass}`}>
              {statusClass}
            </span>
          )}
          <span className="script-card-sep">·</span>
          <span className="script-card-size">{formatSize(script.size)}</span>
          {script.modified_at && (
            <>
              <span className="script-card-sep">·</span>
              <span className="script-card-time" title={script.modified_at}>
                {formatTime(script.modified_at)}
              </span>
            </>
          )}
        </div>
      </div>
      <button className="script-card-edit" onClick={handleEdit} title={isDraft ? "编辑草稿" : "编辑脚本"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>
  );
}
