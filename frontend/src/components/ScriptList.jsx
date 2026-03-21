import React, { useRef, useEffect, useMemo, useState } from "react";
import ScriptCard from "./ScriptCard";
import "./ScriptList.css";

export default function ScriptList({
  folders = [],
  tags = [],
  selectedFolder,
  statuses = {},
  selectedScript,
  onSelect,
  onRefresh,
  onEdit,
  onTagClick,
  onScriptAction,
  onDragStart,
}) {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef(null);
  const tagBtnRef = useRef(null);

  // Close tag dropdown on outside click
  useEffect(() => {
    if (!tagDropdownOpen) return;
    const handler = (e) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target) &&
        tagBtnRef.current &&
        !tagBtnRef.current.contains(e.target)
      ) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagDropdownOpen]);

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearTagFilter = () => setSelectedTags([]);

  const matchesFilters = (script) => {
    const term = search.toLowerCase().trim();
    if (term) {
      const nameMatch = script.name.toLowerCase().includes(term);
      const descMatch = script.description && script.description.toLowerCase().includes(term);
      const tagMatch = Array.isArray(script.tags) && script.tags.some((t) => t.toLowerCase().includes(term));
      if (!nameMatch && !descMatch && !tagMatch) return false;
    }
    if (selectedTags.length > 0) {
      const scriptTags = Array.isArray(script.tags) ? script.tags : [];
      if (!selectedTags.every((t) => scriptTags.includes(t))) return false;
    }
    return true;
  };

  const isSearchActive = search.trim().length > 0 || selectedTags.length > 0;

  const groups = useMemo(() => {
    if (isSearchActive) {
      const allScripts = folders.flatMap((f) =>
        (f.scripts || []).map((s) => ({ ...s, _folderName: f.name }))
      );
      const matched = allScripts.filter(matchesFilters);
      return [{ folderName: null, scripts: matched, isEmpty: false }];
    } else if (selectedFolder && selectedFolder !== "all") {
      const folder = folders.find((f) => f.name === selectedFolder);
      const scripts = folder ? (folder.scripts || []) : [];
      return [{ folderName: null, scripts, isEmpty: scripts.length === 0, folder }];
    } else {
      return folders.map((f) => ({
        folderName: f.name,
        scripts: f.scripts || [],
        isEmpty: !f.scripts || f.scripts.length === 0,
        folder: f,
      }));
    }
  }, [folders, search, selectedTags, selectedFolder]);

  const visibleScripts = useMemo(
    () => groups.flatMap((g) => g.scripts),
    [groups]
  );
  const totalVisible = visibleScripts.length;

  const totalScripts = folders.reduce((n, f) => n + (f.scripts?.length || 0), 0);

  return (
    <div className="script-list">
      <div className="script-list-header">
        <input
          className="script-list-search"
          type="text"
          placeholder="搜索脚本、标签、描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="搜索脚本"
        />
        <div className="script-list-tag-filter-wrap">
          <button
            ref={tagBtnRef}
            className={`script-list-tag-filter ${selectedTags.length > 0 ? "active" : ""}`}
            onClick={() => setTagDropdownOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Escape") setTagDropdownOpen(false); }}
            title="按标签筛选"
            aria-haspopup="listbox"
            aria-expanded={tagDropdownOpen}
          >
            {selectedTags.length > 0 ? `标签 (${selectedTags.length})` : "标签▾"}
          </button>
          {tagDropdownOpen && (
            <div
              className="script-list-tag-dropdown"
              ref={tagDropdownRef}
              role="listbox"
              onKeyDown={(e) => { if (e.key === "Escape") setTagDropdownOpen(false); }}
            >
              <div className="script-list-tag-dropdown-head">
                <span className="script-list-tag-dropdown-title">标签筛选</span>
                {selectedTags.length > 0 && (
                  <button className="script-list-tag-clear" onClick={clearTagFilter}>
                    清除筛选
                  </button>
                )}
              </div>
              {tags.length === 0 ? (
                <div className="script-list-tag-empty">暂无标签</div>
              ) : (
                tags.map((tag) => (
                  <label key={tag} className="script-list-tag-item">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                    />
                    <span>{tag}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
        <button className="script-list-refresh" onClick={onRefresh} title="刷新">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <div className="script-list-items">
        {/* Empty state: no scripts at all */}
        {totalScripts === 0 && !isSearchActive ? (
          <div className="script-list-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="script-list-empty-icon">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            <p className="script-list-empty-title">暂无脚本</p>
            <p className="script-list-empty-hint">将 Python 脚本放入 <code>scripts/</code> 目录，然后刷新。</p>
          </div>
        ) : isSearchActive && totalVisible === 0 ? (
          <div className="script-list-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="script-list-empty-icon">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="script-list-empty-title">未找到匹配脚本</p>
            <p className="script-list-empty-hint">尝试调整搜索词或筛选条件</p>
          </div>
        ) : (
          groups.map((group, gi) => (
            <div key={group.folderName ?? `group-${gi}`} className="script-list-group">
              {group.folderName !== null && (
                <div className="script-list-group-header">
                  <span className="script-list-group-name">
                    {group.folderName === "_unsorted" ? "未分类" : group.folderName}
                  </span>
                  <span className="script-list-group-count">{group.scripts.length}</span>
                </div>
              )}
              {group.isEmpty ? (
                <div className="script-list-group-empty">此文件夹暂无脚本</div>
              ) : (
                group.scripts.map((script) => (
                  <ScriptCard
                    key={isSearchActive ? `${script.folder || ""}/${script.path}` : script.path}
                    script={script}
                    status={statuses[script.name]}
                    selected={selectedScript === script.name}
                    onClick={() => onSelect(script.name)}
                    onEdit={onEdit}
                    onTagClick={onTagClick}
                    onContextMenu={onScriptAction}
                    draggable={true}
                    onDragStart={() => onDragStart?.(script)}
                  />
                ))
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
