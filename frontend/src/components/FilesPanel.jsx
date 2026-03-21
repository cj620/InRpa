import React, { useMemo, useState } from "react";
import "./FilesPanel.css";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(isoString) {
  if (!isoString) return "—";
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
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

function countLines(size) {
  // Rough estimate: ~40 bytes per line for Python
  return `~${Math.max(1, Math.round(size / 40))} 行`;
}

export default function FilesPanel({ folders, selectedFolder, onEdit }) {
  const [selectedScripts, setSelectedScripts] = useState(new Set());

  const scripts = useMemo(() => {
    if (!selectedFolder || selectedFolder === "all") {
      return (folders || []).flatMap((f) => f.scripts || []);
    }
    const folder = (folders || []).find((f) => f.name === selectedFolder);
    return folder ? (folder.scripts || []) : [];
  }, [folders, selectedFolder]);

  const title = (!selectedFolder || selectedFolder === "all") ? "全部文件" : selectedFolder;

  return (
    <div className="files-panel">
      <div className="files-panel-header">
        <div className="files-panel-title">
          <h3>{title}</h3>
          <span className="files-panel-count">{scripts.length} 个文件</span>
        </div>
      </div>
      <div className="files-panel-content">
        {scripts.length === 0 ? (
          <div className="files-empty">
            <div className="files-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="files-empty-text">scripts/ 目录下没有找到脚本</div>
          </div>
        ) : (
          <table className="files-table">
            <thead>
              <tr>
                <th className="files-th-check" style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    className="files-checkbox"
                    checked={scripts.length > 0 && selectedScripts.size === scripts.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedScripts(new Set(scripts.map((s) => s.name)));
                      } else {
                        setSelectedScripts(new Set());
                      }
                    }}
                  />
                </th>
                <th className="files-th-name">文件名</th>
                <th className="files-th-status">状态</th>
                <th className="files-th-size">大小</th>
                <th className="files-th-lines">行数</th>
                <th className="files-th-modified">修改时间</th>
                <th className="files-th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => (
                <tr key={s.name} className={`files-row ${s.is_draft ? "files-row-draft" : ""}`}>
                  <td className="files-check">
                    <input
                      type="checkbox"
                      className="files-checkbox"
                      checked={selectedScripts.has(s.name)}
                      onChange={(e) => {
                        setSelectedScripts((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.name);
                          else next.delete(s.name);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="files-name">
                    <span className="files-name-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                      </svg>
                    </span>
                    <span className="files-name-text">{s.name}.py</span>
                  </td>
                  <td className="files-status">
                    {s.is_draft ? (
                      <span className="files-draft-badge">
                        <span className="files-draft-dot" />
                        草稿
                      </span>
                    ) : (
                      <span className="files-published-badge">正式</span>
                    )}
                  </td>
                  <td className="files-size">{formatSize(s.size)}</td>
                  <td className="files-lines">{countLines(s.size)}</td>
                  <td className="files-date" title={s.modified_at}>{formatTime(s.modified_at)}</td>
                  <td className="files-actions">
                    <button
                      className="files-edit-btn"
                      onClick={() => onEdit?.(s.is_draft ? s.parent_name : s.name)}
                      title={s.is_draft ? "编辑草稿" : "编辑脚本"}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      编辑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
