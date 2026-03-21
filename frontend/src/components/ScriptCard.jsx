import React from "react";
import "./ScriptCard.css";

function formatSize(bytes) {
  if (bytes == null) return "—";
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

export default function ScriptCard({
  script,
  status,
  selected,
  onClick,
  onTagClick,
  draggable,
  onDragStart,
}) {
  const isDraft = script.is_draft;
  const statusClass = isDraft ? "idle" : (status || "idle");

  const handleTagClick = (e, tag) => {
    e.stopPropagation();
    onTagClick?.(tag);
  };

  const handleCardClick = () => {
    onClick?.();
  };

  const hasTags = Array.isArray(script.tags) && script.tags.length > 0;

  return (
    <div
      className={`script-card ${selected ? "selected" : ""} ${isDraft ? "is-draft" : ""} status-${statusClass}`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
      draggable={draggable || false}
      onDragStart={onDragStart}
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
          ) : (
            <span className="script-card-official-badge" title="正式版本">
              正式
            </span>
          )}
        </div>
        {hasTags && (
          <div className="script-card-tags">
            {script.tags.map((tag) => (
              <span
                key={tag}
                className="script-card-tag"
                role="button"
                tabIndex={0}
                onClick={(e) => handleTagClick(e, tag)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTagClick(e, tag); } }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
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
    </div>
  );
}
