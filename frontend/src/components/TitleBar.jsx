import React from "react";
import "./TitleBar.css";

export default function TitleBar({ isMac }) {
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <div className={`titlebar ${isMac ? "titlebar-mac" : ""}`}>
      <div className="titlebar-title">
        <img src="/assets/logo.png" alt="logo" className="titlebar-logo" />
        <span>InRpa</span>
      </div>
      {!isMac && (
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={handleMinimize}>
            <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="2" fill="currentColor"/></svg>
          </button>
          <button className="titlebar-btn" onClick={handleMaximize}>
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
          <button className="titlebar-btn titlebar-btn-close" onClick={handleClose}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
