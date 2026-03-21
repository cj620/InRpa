import React, { useState, useRef, useEffect } from "react";
import "./MoveToDialog.css";
import "./EditMetaDialog.css";

export default function EditMetaDialog({ script, scriptCount, onSave, onCancel }) {
  const isBatch = scriptCount != null && scriptCount > 1;

  // Tags state
  const [tags, setTags] = useState(
    isBatch ? [] : Array.isArray(script?.tags) ? [...script.tags] : []
  );
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef(null);

  // Description state
  const [description, setDescription] = useState(
    isBatch ? "" : (script?.description || "")
  );

  // Focus tag input on mount (for single mode)
  useEffect(() => {
    if (!isBatch && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isBatch]);

  const addTag = (tag) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleSave = () => {
    onSave({ tags, description: description.trim() });
  };

  const handleTagInputChange = (e) => {
    // Auto-add on comma
    const value = e.target.value;
    if (value.endsWith(",")) {
      addTag(value.slice(0, -1));
    } else {
      setTagInput(value);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">
            {isBatch ? `编辑元信息 — 已选择 ${scriptCount} 个脚本` : `编辑元信息 — ${script?.name}`}
          </span>
          <button className="dialog-close" onClick={onCancel} title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="edit-meta-dialog-body">
          {/* Tags section */}
          <div className="edit-meta-section">
            <label className="edit-meta-label">标签</label>
            <div className="edit-dialog-tags">
              {tags.map((tag) => (
                <span key={tag} className="edit-dialog-tag">
                  {tag}
                  <button
                    className="edit-dialog-tag-remove"
                    onClick={() => removeTag(tag)}
                    title="移除"
                  >×</button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                className="edit-dialog-tag-input"
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyDown={handleTagInputKeyDown}
                placeholder={tags.length === 0 ? "输入标签，按 Enter 或逗号添加" : "添加标签…"}
              />
            </div>
            <p className="edit-dialog-hint">Enter 或逗号分隔，Backspace 删除最后一个标签</p>
          </div>

          {/* Description section */}
          <div className="edit-meta-section">
            <label className="edit-meta-label">描述</label>
            <textarea
              className="edit-dialog-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="脚本描述（可选）"
              rows={3}
            />
          </div>
        </div>

        <div className="dialog-footer">
          <button type="button" className="dialog-btn dialog-btn--cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="dialog-btn dialog-btn--confirm" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
