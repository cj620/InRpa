import React, { useState, useRef, useEffect } from "react";
import "./MoveToDialog.css";
import "./EditTagsDialog.css";

export default function EditTagsDialog({ script, mode = "tags", allTags = [], onSave, onCancel }) {
  const isDescription = mode === "description";

  const [tags, setTags] = useState(
    isDescription ? [] : Array.isArray(script.tags) ? [...script.tags] : []
  );
  const [description, setDescription] = useState(
    isDescription ? (script.description || "") : ""
  );
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isDescription && inputRef.current) inputRef.current.focus();
  }, []);

  const addTag = (tag) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setInputValue("");
  };

  const removeTag = (tag) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleSave = () => {
    if (isDescription) {
      onSave(description.trim());
    } else {
      onSave(tags);
    }
  };

  const suggestTags = allTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">
            {isDescription ? "编辑描述" : "编辑标签"} — {script.name}
          </span>
          <button className="dialog-close" onClick={onCancel} title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="edit-dialog-body">
          {isDescription ? (
            <textarea
              className="edit-dialog-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="脚本描述（可选）"
              rows={3}
              autoFocus
            />
          ) : (
            <>
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
                  ref={inputRef}
                  className="edit-dialog-tag-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={tags.length === 0 ? "输入标签，按 Enter 或逗号添加" : "添加标签…"}
                />
              </div>
              {inputValue && suggestTags.length > 0 && (
                <div className="edit-dialog-suggestions">
                  {suggestTags.slice(0, 5).map((t) => (
                    <button
                      key={t}
                      className="edit-dialog-suggest-item"
                      onMouseDown={(e) => { e.preventDefault(); addTag(t); }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <p className="edit-dialog-hint">Enter 或逗号分隔，Backspace 删除最后一个标签</p>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn dialog-btn--cancel" onClick={onCancel}>
            取消
          </button>
          <button className="dialog-btn dialog-btn--confirm" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
