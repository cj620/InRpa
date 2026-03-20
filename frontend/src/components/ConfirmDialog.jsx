import React, { useState, useCallback, useEffect } from "react";
import "./ConfirmDialog.css";

export default function ConfirmDialog({
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  confirmVariant = "primary", // "primary" | "danger"
  onConfirm,
  onCancel,
  extraAction, // optional: { text, onClick, variant }
}) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback((callback) => {
    setExiting(true);
    setTimeout(() => {
      if (callback) callback();
    }, 150);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss(onCancel);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dismiss, onCancel]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      dismiss(onCancel);
    }
  };

  return (
    <div
      className={`confirm-overlay${exiting ? " confirm-exiting" : ""}`}
      onClick={handleBackdropClick}
    >
      <div className="confirm-dialog">
        <div className="confirm-body">
          <div className="confirm-title">{title}</div>
          {message && <div className="confirm-message">{message}</div>}
        </div>
        <div className="confirm-footer">
          <button
            className="confirm-btn confirm-btn-cancel"
            onClick={() => dismiss(onCancel)}
          >
            {cancelText}
          </button>
          {extraAction && (
            <button
              className={`confirm-btn confirm-btn-${extraAction.variant || "secondary"}`}
              onClick={() => dismiss(extraAction.onClick)}
            >
              {extraAction.text}
            </button>
          )}
          <button
            className={`confirm-btn confirm-btn-${confirmVariant}`}
            onClick={() => dismiss(onConfirm)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
