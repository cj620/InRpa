import React from "react";
import { openExternal } from "../../api";
import "./EditorActionBar.css";

export default function EditorActionBar({
  isDirty,
  saving,
  hasDraft,
  publishing,
  onSaveDraft,
  onPublish,
  onDiscard,
  selectedScript,
}) {
  const handleOpenExternal = async () => {
    try {
      await openExternal(selectedScript);
    } catch (err) {
      console.error("Failed to open externally:", err);
    }
  };

  return (
    <div className="editor-action-bar">
      <div className="editor-action-bar-left">
        <button
          className="eab-btn eab-btn-primary"
          onClick={onSaveDraft}
          disabled={!isDirty || saving}
        >
          {saving && <span className="eab-spinner" />}
          保存草稿
        </button>

        <button
          className="eab-btn eab-btn-outlined"
          onClick={onPublish}
          disabled={(!hasDraft && !isDirty) || publishing}
        >
          {publishing && <span className="eab-spinner" />}
          发布到正式版
        </button>

        {hasDraft && (
          <button className="eab-btn eab-btn-danger" onClick={onDiscard}>
            放弃草稿
          </button>
        )}
      </div>

      <div className="editor-action-bar-right">
        <button className="eab-btn eab-btn-subtle" onClick={handleOpenExternal}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          在外部编辑器中打开
        </button>
      </div>
    </div>
  );
}
