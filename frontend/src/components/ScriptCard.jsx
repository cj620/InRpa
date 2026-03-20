import React, { useState, useEffect, useRef } from "react";
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

// Prop note:
//   selected   — single-selection highlight (from ScriptList); mutually exclusive with isSelected
//   isSelected — batch-selection state (from batch mode); mutually exclusive with selected
export default function ScriptCard({
  script,
  status,
  selected,
  onClick,
  onEdit,
  onTagClick,
  onContextMenu,
  draggable,
  onDragStart,
  selectable,
  isSelected,
  onSelectToggle,
}) {
  const isDraft = script.is_draft;
  const statusClass = isDraft ? "idle" : (status || "idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit?.(isDraft ? script.parent_name : script.name);
  };

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  const handleMenuAction = (e, action) => {
    e.stopPropagation();
    setMenuOpen(false);
    onContextMenu?.(action, script);
  };

  const handleTagClick = (e, tag) => {
    e.stopPropagation();
    onTagClick?.(tag);
  };

  const handleCardClick = () => {
    if (selectable) {
      onSelectToggle?.();
    } else {
      onClick?.();
    }
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onSelectToggle?.();
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const hasTags = Array.isArray(script.tags) && script.tags.length > 0;
  const hasDescription = script.description && script.description.trim().length > 0;

  return (
    <div
      className={`script-card ${selected ? "selected" : ""} ${isDraft ? "is-draft" : ""} status-${statusClass} ${selectable ? "is-selectable" : ""} ${isSelected ? "is-batch-selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
      draggable={draggable || false}
      onDragStart={onDragStart}
    >
      {selectable && (
        <div className="script-card-checkbox" onClick={handleCheckboxClick}>
          <div className={`script-card-checkbox-inner ${isSelected ? "checked" : ""}`}>
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      )}
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
        {hasDescription && (
          <div className="script-card-description" title={script.description}>
            {script.description}
          </div>
        )}
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
      <div className="script-card-actions">
        <button className="script-card-edit" onClick={handleEdit} title={isDraft ? "编辑草稿" : "编辑脚本"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <div className="script-card-menu-wrap">
          <button
            ref={menuBtnRef}
            className="script-card-menu-btn"
            onClick={handleMenuToggle}
            title="更多操作"
            aria-label="更多操作"
          >
            ···
          </button>
          {menuOpen && (
            <div className="script-card-menu" ref={menuRef}>
              <button
                className="script-card-menu-item"
                onClick={(e) => handleMenuAction(e, "move")}
              >
                移动到...
              </button>
              <button
                className="script-card-menu-item"
                onClick={(e) => handleMenuAction(e, "editTags")}
              >
                编辑标签
              </button>
              <button
                className="script-card-menu-item"
                onClick={(e) => handleMenuAction(e, "editDescription")}
              >
                编辑描述
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
