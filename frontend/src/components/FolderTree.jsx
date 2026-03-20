import React, { useState, useEffect, useRef } from "react";
import "./FolderTree.css";
import ConfirmDialog from "./ConfirmDialog";

const UNSORTED_KEY = "_unsorted";

export default function FolderTree({
  folders = [],
  selectedFolder = "all",
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  collapsed = false,
  onToggleCollapse,
  draggingScript = null,
  onFolderDrop,
}) {
  const [dropTarget, setDropTarget] = useState(null); // folder name being hovered during drag
  const [inlineRename, setInlineRename] = useState(null); // { name: string, value: string }
  const [newFolderInput, setNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [openMenu, setOpenMenu] = useState(null); // folder name or null
  const [confirmDelete, setConfirmDelete] = useState(null); // folder name or null

  const menuRef = useRef(null);
  const renameInputRef = useRef(null);
  const newFolderInputRef = useRef(null);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  // Focus rename input when opened
  useEffect(() => {
    if (inlineRename && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [inlineRename]);

  // Focus new folder input when opened
  useEffect(() => {
    if (newFolderInput && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [newFolderInput]);

  const totalCount = folders.reduce((sum, f) => sum + (f.scripts?.length ?? 0), 0);

  const handleRenameStart = (folder) => {
    setOpenMenu(null);
    setInlineRename({ name: folder.name, value: folder.name });
  };

  const handleRenameConfirm = () => {
    if (!inlineRename) return;
    const trimmed = inlineRename.value.trim();
    if (trimmed && trimmed !== inlineRename.name) {
      onRenameFolder?.(inlineRename.name, trimmed);
    }
    setInlineRename(null);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameConfirm();
    } else if (e.key === "Escape") {
      setInlineRename(null);
    }
  };

  const handleDeleteFolder = (folder) => {
    setOpenMenu(null);
    setConfirmDelete(folder.name);
  };

  const handleNewFolderConfirm = () => {
    const trimmed = newFolderName.trim();
    if (trimmed) {
      onCreateFolder?.(trimmed);
    }
    setNewFolderInput(false);
    setNewFolderName("");
  };

  const handleNewFolderKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNewFolderConfirm();
    } else if (e.key === "Escape") {
      setNewFolderInput(false);
      setNewFolderName("");
    }
  };

  const handleMenuToggle = (e, folderName) => {
    e.stopPropagation();
    setOpenMenu((prev) => (prev === folderName ? null : folderName));
  };

  const isUnsorted = (name) => name === UNSORTED_KEY;

  return (
    <div className={`folder-tree${collapsed ? " folder-tree--collapsed" : ""}`}>
      {/* Collapsed strip — just shows toggle button */}
      {collapsed ? (
        <button
          className="folder-tree__collapse-btn folder-tree__collapse-btn--strip"
          onClick={onToggleCollapse}
          title="展开文件夹面板"
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </svg>
        </button>
      ) : (
        <>
          {/* Header */}
          <div className="folder-tree__header">
            <span className="folder-tree__title">脚本管理</span>
            <button
              className="folder-tree__collapse-btn"
              onClick={onToggleCollapse}
              title="收起文件夹面板"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
            </button>
          </div>

          {/* Folder list */}
          <div className="folder-tree__list">
            {/* "全部" virtual node */}
            <div
              className={`folder-tree__row${selectedFolder === "all" ? " folder-tree__row--active" : ""}${dropTarget === "_unsorted" && draggingScript ? " folder-tree__row--drop-target" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectFolder?.("all")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectFolder?.("all");
                }
              }}
              onDragOver={draggingScript ? (e) => { e.preventDefault(); setDropTarget("_unsorted"); } : undefined}
              onDragLeave={draggingScript ? () => setDropTarget(null) : undefined}
              onDrop={draggingScript ? (e) => { e.preventDefault(); setDropTarget(null); onFolderDrop?.("_unsorted"); } : undefined}
            >
              <span className="folder-tree__icon">🗂️</span>
              <span className="folder-tree__name">全部</span>
              <span className="folder-tree__badge">{totalCount}</span>
            </div>

            {/* Real folders */}
            {folders.map((folder) => {
              const isRenaming = inlineRename?.name === folder.name;
              const isMenuOpen = openMenu === folder.name;
              const count = folder.scripts?.length ?? 0;
              const active = selectedFolder === folder.name;

              return (
                <div
                  key={folder.name}
                  className={`folder-tree__row${active ? " folder-tree__row--active" : ""}${isMenuOpen ? " folder-tree__row--menu-open" : ""}${dropTarget === folder.name && draggingScript ? " folder-tree__row--drop-target" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!isRenaming) onSelectFolder?.(folder.name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!isRenaming) onSelectFolder?.(folder.name);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!isRenaming) handleRenameStart(folder);
                  }}
                  onDragOver={draggingScript ? (e) => { e.preventDefault(); setDropTarget(folder.name); } : undefined}
                  onDragLeave={draggingScript ? () => setDropTarget(null) : undefined}
                  onDrop={draggingScript ? (e) => { e.preventDefault(); setDropTarget(null); onFolderDrop?.(folder.name); } : undefined}
                >
                  <span className="folder-tree__icon">{folder.icon || "📁"}</span>

                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      className="folder-tree__rename-input"
                      value={inlineRename.value}
                      onChange={(e) =>
                        setInlineRename((prev) => ({ ...prev, value: e.target.value }))
                      }
                      onKeyDown={handleRenameKeyDown}
                      onBlur={handleRenameConfirm}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="folder-tree__name">{folder.name}</span>
                  )}

                  {!isRenaming && (
                    <>
                      <span className="folder-tree__badge">{count}</span>

                      {/* Ellipsis menu button */}
                      <div className="folder-tree__menu-wrap" ref={isMenuOpen ? menuRef : null}>
                        <button
                          className="folder-tree__menu-btn"
                          onClick={(e) => handleMenuToggle(e, folder.name)}
                          title="更多操作"
                        >
                          ···
                        </button>

                        {isMenuOpen && (
                          <div className="folder-tree__menu">
                            <button
                              className="folder-tree__menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameStart(folder);
                              }}
                            >
                              重命名
                            </button>
                            {!isUnsorted(folder.name) && (
                              <button
                                className="folder-tree__menu-item folder-tree__menu-item--danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(folder);
                                }}
                              >
                                删除
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Inline new folder input */}
            {newFolderInput && (
              <div className="folder-tree__row folder-tree__row--new">
                <span className="folder-tree__icon">📁</span>
                <input
                  ref={newFolderInputRef}
                  className="folder-tree__rename-input"
                  value={newFolderName}
                  placeholder="文件夹名称"
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleNewFolderKeyDown}
                  onBlur={handleNewFolderConfirm}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>

          {/* New folder button */}
          <div className="folder-tree__footer">
            <button
              className="folder-tree__new-btn"
              onClick={() => {
                setNewFolderInput(true);
                setNewFolderName("");
              }}
            >
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              新建文件夹
            </button>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete !== null && (
        <ConfirmDialog
          title={`删除文件夹「${confirmDelete}」`}
          message="此操作不可撤销。"
          confirmText="删除"
          confirmVariant="danger"
          onConfirm={() => {
            onDeleteFolder?.(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
