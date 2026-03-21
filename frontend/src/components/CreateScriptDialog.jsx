import React, { useState, useEffect, useRef } from "react";
import "./CreateScriptDialog.css";

export default function CreateScriptDialog({ folders = [], onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownBtnRef = useRef(null);

  const realFolders = folders.filter((f) => f.name !== "_unsorted");
  const selectedFolderObj = folders.find((f) => f.name === selectedFolder);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!folderDropdownOpen) return;
    const handler = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !dropdownBtnRef.current?.contains(e.target)
      ) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [folderDropdownOpen]);

  const handleSubmit = () => {
    if (!name.trim() || !selectedFolder) return;
    onConfirm(name.trim(), selectedFolder);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      if (folderDropdownOpen) {
        setFolderDropdownOpen(false);
      } else {
        onCancel();
      }
    } else if (e.key === "Enter" && name.trim() && selectedFolder && !folderDropdownOpen) {
      handleSubmit();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box create-script-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">新建脚本</span>
          <button className="dialog-close" onClick={onCancel} title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dialog-body">
          <div className="form-field">
            <label className="form-label" htmlFor="script-name">脚本名称</label>
            <input
              ref={inputRef}
              id="script-name"
              className="form-input"
              type="text"
              placeholder="例如: my_scraper"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="folder-select">保存到</label>
            <div className="dropdown-wrap">
              <button
                ref={dropdownBtnRef}
                id="folder-select"
                className={`dropdown-btn ${selectedFolder ? "" : "dropdown-btn--placeholder"}`}
                onClick={() => setFolderDropdownOpen((v) => !v)}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={folderDropdownOpen}
              >
                <span className="dropdown-btn-icon">
                  {selectedFolderObj ? (selectedFolderObj.icon || "📁") : "📁"}
                </span>
                <span className="dropdown-btn-text">
                  {selectedFolderObj ? selectedFolderObj.name : "请选择文件夹"}
                </span>
                <span className="dropdown-btn-arrow">▾</span>
              </button>

              {folderDropdownOpen && (
                <div ref={dropdownRef} className="dropdown-list" role="listbox">
                  {realFolders.length === 0 ? (
                    <div className="dropdown-empty">还没有创建任何文件夹</div>
                  ) : (
                    realFolders.map((f) => (
                      <button
                        key={f.name}
                        className={`dropdown-item ${selectedFolder === f.name ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedFolder(f.name);
                          setFolderDropdownOpen(false);
                        }}
                        type="button"
                        role="option"
                      >
                        <span className="dropdown-item-icon">{f.icon || "📁"}</span>
                        <span className="dropdown-item-text">{f.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button type="button" className="dialog-btn dialog-btn--cancel" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="dialog-btn dialog-btn--confirm"
            disabled={!name.trim() || !selectedFolder}
            onClick={handleSubmit}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}