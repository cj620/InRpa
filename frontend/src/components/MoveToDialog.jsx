import React, { useState } from "react";
import "./MoveToDialog.css";

const UNSORTED_KEY = "_unsorted";

export default function MoveToDialog({ folders = [], scriptCount = 1, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null);

  const realFolders = folders.filter((f) => f.name !== UNSORTED_KEY);
  const hasUnsorted = folders.some((f) => f.name === UNSORTED_KEY);

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box move-to-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">移动到文件夹</span>
          <button className="dialog-close" onClick={onCancel} title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="dialog-sub">
          {scriptCount === 1 ? "选择目标文件夹：" : `移动 ${scriptCount} 个脚本到：`}
        </p>

        <div className="move-to-folder-list">
          {/* Unsorted option */}
          <button
            className={`move-to-folder-item${selected === UNSORTED_KEY ? " selected" : ""}`}
            onClick={() => setSelected(UNSORTED_KEY)}
          >
            <span className="move-to-folder-icon">📁</span>
            <span className="move-to-folder-name">未分类</span>
          </button>

          {realFolders.map((f) => (
            <button
              key={f.name}
              className={`move-to-folder-item${selected === f.name ? " selected" : ""}`}
              onClick={() => setSelected(f.name)}
            >
              <span className="move-to-folder-icon">{f.icon || "📁"}</span>
              <span className="move-to-folder-name">{f.name}</span>
              <span className="move-to-folder-count">{f.scripts?.length ?? 0}</span>
            </button>
          ))}

          {realFolders.length === 0 && (
            <p className="move-to-folder-empty">还没有创建任何文件夹</p>
          )}
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn dialog-btn--cancel" onClick={onCancel}>
            取消
          </button>
          <button
            className="dialog-btn dialog-btn--confirm"
            disabled={selected === null}
            onClick={() => selected !== null && onConfirm(selected)}
          >
            移动
          </button>
        </div>
      </div>
    </div>
  );
}
