import React, { useState, useEffect, useCallback, useRef } from "react";
import "./Toast.css";

const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M5 9.5L7.5 12L13 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M6 6L12 12M12 6L6 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="5.75" r="0.75" fill="currentColor" />
    </svg>
  ),
};

function ToastItem({ id, message, type = "info", onClose }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onClose(id), 250);
  }, [id, onClose]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, 3000);
    return () => clearTimeout(timerRef.current);
  }, [dismiss]);

  return (
    <div className={`toast toast-${type}${exiting ? " toast-exiting" : ""}`}>
      <span className="toast-icon">{ICONS[type]}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={dismiss} aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// Global toast state
let toastListeners = [];
let toastId = 0;

export function toast(message, type = "info") {
  const id = ++toastId;
  toastListeners.forEach((fn) => fn({ id, message, type }));
  return id;
}

toast.success = (message) => toast(message, "success");
toast.error = (message) => toast(message, "error");
toast.info = (message) => toast(message, "info");

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (t) => setToasts((prev) => [...prev, t]);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== listener);
    };
  }, []);

  const handleClose = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onClose={handleClose} />
      ))}
    </div>
  );
}
