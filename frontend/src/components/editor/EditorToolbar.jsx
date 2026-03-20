import React, { useState, useRef, useEffect, useMemo } from "react";
import "./EditorToolbar.css";

function formatRelativeDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString();
}

function ScriptSelector({ scripts, selectedScript, onSelectScript }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return scripts;
    const q = search.toLowerCase();
    return scripts.filter((s) => s.name.toLowerCase().includes(q));
  }, [scripts, search]);

  const handleSelect = (name) => {
    onSelectScript(name);
    setOpen(false);
  };

  return (
    <div className="script-selector" ref={containerRef}>
      <button
        className={`script-selector-trigger${open ? " open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span>{selectedScript || "选择脚本..."}</span>
        <svg className="script-selector-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && <div className="script-selector-backdrop" onClick={() => setOpen(false)} />}

      <div className={`script-selector-dropdown${open ? " visible" : ""}`}>
        <div className="script-selector-search">
          <svg className="script-selector-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索脚本..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="script-selector-list">
          {filtered.length === 0 ? (
            <div className="script-selector-empty">没有匹配的脚本</div>
          ) : (
            filtered.map((script) => (
              <div
                key={script.name}
                className={`script-selector-item${script.name === selectedScript ? " selected" : ""}`}
                onClick={() => handleSelect(script.name)}
              >
                <div className="script-selector-item-left">
                  <span className="script-selector-item-name">{script.name}</span>
                  {script.has_draft && <span className="script-selector-draft-dot" title="有草稿" />}
                </div>
                <span className="script-selector-item-date">
                  {formatRelativeDate(script.modified)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ hasDraft, isDirty }) {
  if (!hasDraft && !isDirty) return null;

  return (
    <div className={`status-badge ${hasDraft ? "status-badge-draft" : ""}`}>
      {hasDraft && <span>草稿</span>}
      {isDirty && <span className="status-badge-dirty-dot" title="未保存的更改" />}
    </div>
  );
}

export default function EditorToolbar({
  scripts,
  selectedScript,
  onSelectScript,
  hasDraft,
  isDirty,
  viewMode,
  onToggleDiff,
  draftStatus,
  onRunTest,
  onStopTest,
  panelOpen,
  onTogglePanel,
}) {
  const isRunning = draftStatus === "running";

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar-left">
        <ScriptSelector
          scripts={scripts}
          selectedScript={selectedScript}
          onSelectScript={onSelectScript}
        />
        {selectedScript && (
          <StatusBadge hasDraft={hasDraft} isDirty={isDirty} />
        )}
      </div>

      <div className="editor-toolbar-right">
        <button
          className={`toolbar-btn${viewMode === "diff" ? " active" : ""}`}
          onClick={onToggleDiff}
          disabled={!selectedScript}
          title="对比差异"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18" />
            <path d="M6 8l-3 3 3 3" />
            <path d="M18 8l3 3-3 3" />
          </svg>
        </button>

        <div className="toolbar-divider" />

        {isRunning ? (
          <button className="toolbar-run-btn stop" onClick={onStopTest}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            停止
          </button>
        ) : (
          <button
            className="toolbar-run-btn run"
            onClick={onRunTest}
            disabled={!selectedScript}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            测试
          </button>
        )}

        <div className="toolbar-divider" />

        <button
          className={`toolbar-btn${panelOpen ? " active" : ""}`}
          onClick={onTogglePanel}
          title="侧面板"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
      </div>
    </div>
  );
}
